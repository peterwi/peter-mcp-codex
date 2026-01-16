/**
 * perf_thread_profile tool
 * Per-thread CPU analysis using pidstat and optionally offcputime
 */

import { z } from 'zod';
import { TOOL_VERSION, ErrorCode } from '../lib/constants.js';
import { safeExec, safeReadFile } from '../lib/exec.js';
import { detectCapabilities } from '../lib/detect.js';
import { parseOffcputime } from '../parse/bcc.js';
import type { PerfResponse } from '../lib/schemas.js';

export const ThreadProfileInputSchema = z.object({
  pid: z
    .number()
    .int()
    .positive()
    .describe('Process ID to analyze (required)'),
  duration_seconds: z
    .number()
    .min(1)
    .max(30)
    .default(5)
    .describe('Duration in seconds (1-30)'),
  include_offcpu: z
    .boolean()
    .default(false)
    .describe('Include off-CPU time analysis (requires BCC)'),
});

export type ThreadProfileInput = z.infer<typeof ThreadProfileInputSchema>;
export type ThreadProfileRawInput = z.input<typeof ThreadProfileInputSchema>;

export interface ThreadState {
  tid: number;
  name: string;
  state: 'R' | 'S' | 'D' | 'Z' | 'T' | 'X' | 'unknown';
  cpu_user_percent: number;
  cpu_system_percent: number;
  cpu_total_percent: number;
  voluntary_ctx_switches?: number;
  involuntary_ctx_switches?: number;
  offcpu_time_us?: number;
  offcpu_percent?: number;
}

export interface ThreadProfileData {
  method: string;
  pid: number;
  process_name: string;
  duration_seconds: number;
  threads: ThreadState[];
  process_total: {
    cpu_user_percent: number;
    cpu_system_percent: number;
    cpu_total_percent: number;
    total_threads: number;
    running_threads: number;
    blocked_threads: number;
  };
  offcpu_summary?: {
    total_offcpu_us: number;
    top_blockers: Array<{ function: string; total_us: number; percent: number }>;
  };
  notes: string[];
}

interface PidstatThreadEntry {
  tid: number;
  user: number;
  system: number;
  guest: number;
  wait: number;
  cpu: number;
  command: string;
}

/**
 * Parse pidstat -t output
 * Format:
 * Average:      UID      TGID       TID    %usr %system  %guest   %wait    %CPU   CPU  Command
 * Average:        0      1234         -    0.20    0.10    0.00    0.05    0.30     -  myapp
 * Average:        0         -      1234    0.10    0.05    0.00    0.02    0.15     -  |__myapp
 * Average:        0         -      1235    0.10    0.05    0.00    0.03    0.15     -  |__worker
 */
function parsePidstatThreads(output: string): PidstatThreadEntry[] {
  const lines = output.trim().split('\n');
  const entries: PidstatThreadEntry[] = [];

  for (const line of lines) {
    // Skip non-average lines and headers
    if (!line.startsWith('Average:') || line.includes('%usr') || line.includes('UID')) continue;

    const parts = line.replace('Average:', '').trim().split(/\s+/);
    if (parts.length < 10) continue;

    // Format: UID TGID TID %usr %system %guest %wait %CPU CPU Command
    // Skip TGID (parts[1]) as we don't need it
    const tid = parts[2];
    const user = parseFloat(parts[3]);
    const system = parseFloat(parts[4]);
    const guest = parseFloat(parts[5]);
    const wait = parseFloat(parts[6]);
    const cpu = parseFloat(parts[7]);
    const command = parts.slice(9).join(' ').replace('|__', '');

    // Skip the process summary line (TID = -)
    if (tid === '-') continue;

    const tidNum = parseInt(tid, 10);
    if (isNaN(tidNum)) continue;

    entries.push({
      tid: tidNum,
      user,
      system,
      guest,
      wait,
      cpu,
      command,
    });
  }

  return entries;
}

/**
 * Get thread state from /proc/[pid]/task/[tid]/stat
 */
async function getThreadState(pid: number, tid: number): Promise<'R' | 'S' | 'D' | 'Z' | 'T' | 'X' | 'unknown'> {
  const path = `/proc/${pid}/task/${tid}/stat`;
  const result = await safeReadFile(path);

  if (!result.success) return 'unknown';

  // stat format: pid (comm) state ...
  const match = result.content.match(/\)\s+([RSDZTX])/);
  if (match) {
    return match[1] as 'R' | 'S' | 'D' | 'Z' | 'T' | 'X';
  }
  return 'unknown';
}

/**
 * Get context switch counts from /proc/[pid]/task/[tid]/status
 */
async function getThreadContextSwitches(pid: number, tid: number): Promise<{ voluntary: number; involuntary: number } | null> {
  const path = `/proc/${pid}/task/${tid}/status`;
  const result = await safeReadFile(path);

  if (!result.success) return null;

  const volMatch = result.content.match(/voluntary_ctxt_switches:\s+(\d+)/);
  const involMatch = result.content.match(/nonvoluntary_ctxt_switches:\s+(\d+)/);

  if (volMatch && involMatch) {
    return {
      voluntary: parseInt(volMatch[1], 10),
      involuntary: parseInt(involMatch[1], 10),
    };
  }
  return null;
}

/**
 * Get process name from /proc/[pid]/comm
 */
async function getProcessName(pid: number): Promise<string> {
  const path = `/proc/${pid}/comm`;
  const result = await safeReadFile(path);
  return result.success ? result.content.trim() : 'unknown';
}

export async function perfThreadProfile(
  input: ThreadProfileRawInput
): Promise<PerfResponse<ThreadProfileData>> {
  const startTime = Date.now();

  try {
    const params = ThreadProfileInputSchema.parse(input);
    const caps = await detectCapabilities();

    // Check if process exists
    const procExists = await safeReadFile(`/proc/${params.pid}/stat`);
    if (!procExists.success) {
      return {
        success: false,
        tool: 'perf_thread_profile',
        tool_version: TOOL_VERSION,
        timestamp: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        host: process.env.HOSTNAME || 'unknown',
        error: {
          code: ErrorCode.PID_NOT_FOUND,
          message: `Process ${params.pid} not found`,
          recoverable: false,
        },
      };
    }

    const notes: string[] = [];
    const methods: string[] = ['pidstat'];

    // Get process name
    const processName = await getProcessName(params.pid);

    // Run pidstat with per-thread breakdown
    const pidstatArgs = ['-t', '-u', '-w', '-p', String(params.pid), '1', String(params.duration_seconds)];
    const pidstatResult = await safeExec('pidstat', pidstatArgs, {
      timeout: (params.duration_seconds + 5) * 1000,
    });

    if (!pidstatResult.success) {
      return {
        success: false,
        tool: 'perf_thread_profile',
        tool_version: TOOL_VERSION,
        timestamp: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        host: process.env.HOSTNAME || 'unknown',
        error: {
          code: pidstatResult.error?.code || ErrorCode.EXECUTION_FAILED,
          message: pidstatResult.error?.message || 'pidstat execution failed',
          recoverable: true,
          suggestion: pidstatResult.error?.suggestion,
        },
      };
    }

    // Parse pidstat output
    const threadStats = parsePidstatThreads(pidstatResult.stdout);

    if (threadStats.length === 0) {
      notes.push('No thread data collected - process may have exited');
    }

    // Gather additional per-thread info
    const threads: ThreadState[] = [];
    let runningCount = 0;
    let blockedCount = 0;

    for (const ts of threadStats) {
      const state = await getThreadState(params.pid, ts.tid);
      const ctxSwitches = await getThreadContextSwitches(params.pid, ts.tid);

      if (state === 'R') runningCount++;
      if (state === 'D') blockedCount++;

      threads.push({
        tid: ts.tid,
        name: ts.command,
        state,
        cpu_user_percent: ts.user,
        cpu_system_percent: ts.system,
        cpu_total_percent: ts.cpu,
        voluntary_ctx_switches: ctxSwitches?.voluntary,
        involuntary_ctx_switches: ctxSwitches?.involuntary,
      });
    }

    // Sort by CPU usage
    threads.sort((a, b) => b.cpu_total_percent - a.cpu_total_percent);

    // Calculate process totals
    const totalUser = threads.reduce((sum, t) => sum + t.cpu_user_percent, 0);
    const totalSystem = threads.reduce((sum, t) => sum + t.cpu_system_percent, 0);
    const totalCpu = threads.reduce((sum, t) => sum + t.cpu_total_percent, 0);

    // Off-CPU analysis if requested
    let offcpuSummary: ThreadProfileData['offcpu_summary'];

    if (params.include_offcpu && caps.canUseBpf && caps.bccTools.offcputime) {
      methods.push('offcputime');
      notes.push('Including off-CPU analysis');

      const offcpuArgs = ['-p', String(params.pid), '-f', String(params.duration_seconds)];
      const offcpuResult = await safeExec('offcputime', offcpuArgs, {
        timeout: (params.duration_seconds + 10) * 1000,
      });

      if (offcpuResult.success && offcpuResult.stdout) {
        const parsed = parseOffcputime(offcpuResult.stdout);

        offcpuSummary = {
          total_offcpu_us: parsed.totalBlockedUs,
          top_blockers: parsed.topFunctions.slice(0, 10).map((f) => ({
            function: f.function,
            total_us: f.totalUs,
            percent: f.percent,
          })),
        };

        // Correlate off-CPU time to threads if possible
        // (offcputime aggregates by function, not by thread, so this is approximate)
        if (parsed.totalBlockedUs > 0) {
          const offcpuPercent = (parsed.totalBlockedUs / (params.duration_seconds * 1000000)) * 100;
          notes.push(`Total off-CPU: ${(parsed.totalBlockedUs / 1000000).toFixed(2)}s (${offcpuPercent.toFixed(1)}%)`);
        }
      } else if (!offcpuResult.success) {
        notes.push('Off-CPU analysis failed - continuing without');
      }
    } else if (params.include_offcpu && !caps.canUseBpf) {
      notes.push('Off-CPU analysis requested but BCC not available');
    }

    // Analysis notes
    if (blockedCount > 0) {
      notes.push(`${blockedCount} thread(s) in D (uninterruptible) state - may indicate I/O blocking`);
    }

    const hotThreads = threads.filter((t) => t.cpu_total_percent > 50);
    if (hotThreads.length > 0) {
      notes.push(`Hot thread(s): ${hotThreads.map((t) => `${t.name}(${t.tid}): ${t.cpu_total_percent.toFixed(1)}%`).join(', ')}`);
    }

    const idleProcess = totalCpu < 1 && threads.length > 0;
    if (idleProcess) {
      notes.push('Process appears idle - check if waiting on I/O or locks');
    }

    return {
      success: true,
      tool: 'perf_thread_profile',
      tool_version: TOOL_VERSION,
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      host: process.env.HOSTNAME || 'unknown',
      data: {
        method: methods.join('+'),
        pid: params.pid,
        process_name: processName,
        duration_seconds: params.duration_seconds,
        threads,
        process_total: {
          cpu_user_percent: totalUser,
          cpu_system_percent: totalSystem,
          cpu_total_percent: totalCpu,
          total_threads: threads.length,
          running_threads: runningCount,
          blocked_threads: blockedCount,
        },
        offcpu_summary: offcpuSummary,
        notes,
      },
    };
  } catch (error) {
    return {
      success: false,
      tool: 'perf_thread_profile',
      tool_version: TOOL_VERSION,
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      host: process.env.HOSTNAME || 'unknown',
      error: {
        code: ErrorCode.EXECUTION_FAILED,
        message: error instanceof Error ? error.message : String(error),
        recoverable: false,
      },
    };
  }
}
