/**
 * perf_offcpu_profile tool
 * Off-CPU analysis using BCC offcputime or perf sched
 * Shows where processes are blocking/sleeping
 */

import { z } from 'zod';
import { DURATION_LIMITS, TIMEOUTS, TOOL_VERSION, ErrorCode } from '../lib/constants.js';
import { safeExec } from '../lib/exec.js';
import { detectCapabilities } from '../lib/detect.js';
import { parseOffcputime } from '../parse/bcc.js';
import { parsePerfSchedLatency } from '../parse/perf.js';
import type { PerfResponse } from '../lib/schemas.js';

export const OffcpuProfileInputSchema = z.object({
  duration_seconds: z
    .number()
    .min(DURATION_LIMITS.MIN)
    .max(DURATION_LIMITS.MAX)
    .default(DURATION_LIMITS.DEFAULT)
    .describe('Duration in seconds (1-60)'),
  pid: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Profile specific process'),
  min_block_us: z
    .number()
    .int()
    .min(1)
    .default(1000)
    .describe('Minimum block time to record in microseconds'),
  kernel_stacks: z
    .boolean()
    .default(true)
    .describe('Include kernel stack traces'),
  user_stacks: z
    .boolean()
    .default(true)
    .describe('Include user stack traces'),
});

export type OffcpuProfileInput = z.infer<typeof OffcpuProfileInputSchema>;
export type OffcpuProfileRawInput = z.input<typeof OffcpuProfileInputSchema>;

export interface OffcpuProfileData {
  method: 'bcc_offcputime' | 'perf_sched';
  duration_seconds: number;
  pid?: number;
  total_blocked_us: number;
  total_blocked_ms: number;
  top_blockers: Array<{
    function: string;
    blocked_us: number;
    blocked_ms: number;
    percent: number;
  }>;
  sample_stacks?: Array<{
    stack: string[];
    blocked_us: number;
  }>;
  notes: string[];
}

export async function perfOffcpuProfile(
  input: OffcpuProfileRawInput = {}
): Promise<PerfResponse<OffcpuProfileData>> {
  const startTime = Date.now();

  try {
    const params = OffcpuProfileInputSchema.parse(input);
    const caps = await detectCapabilities();

    // Check if we can use BCC offcputime (preferred)
    const canUseBcc = caps.canUseBpf && caps.bccTools.offcputime;
    // Fallback: perf sched (requires CAP_PERFMON)
    const canUsePerfSched = caps.canUsePerf;

    if (!canUseBcc && !canUsePerfSched) {
      return {
        success: false,
        tool: 'perf_offcpu_profile',
        tool_version: TOOL_VERSION,
        timestamp: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        host: process.env.HOSTNAME || 'unknown',
        error: {
          code: ErrorCode.CAPABILITY_MISSING,
          message: 'Off-CPU profiling requires BCC tools (offcputime) or perf with CAP_PERFMON',
          recoverable: true,
          suggestion: 'Install bcc-tools package and run as root, or enable perf access',
        },
      };
    }

    const notes: string[] = [];

    if (canUseBcc) {
      // Use BCC offcputime (most detailed)
      return await runBccOffcputime(params, startTime, notes);
    } else {
      // Fallback to perf sched
      notes.push('Using perf sched fallback (BCC offcputime not available)');
      return await runPerfSched(params, startTime, notes);
    }
  } catch (error) {
    return {
      success: false,
      tool: 'perf_offcpu_profile',
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

async function runBccOffcputime(
  params: OffcpuProfileInput,
  startTime: number,
  notes: string[]
): Promise<PerfResponse<OffcpuProfileData>> {
  const args: string[] = [
    '-d', String(params.duration_seconds),
    '-f', // Folded output for easier parsing
  ];

  if (params.pid) {
    args.push('-p', String(params.pid));
  }

  if (params.min_block_us && params.min_block_us > 1) {
    args.push('-m', String(params.min_block_us));
  }

  // Stack type selection
  if (params.kernel_stacks && !params.user_stacks) {
    args.push('-k'); // Kernel stacks only
  } else if (params.user_stacks && !params.kernel_stacks) {
    args.push('-u'); // User stacks only
  }
  // Default: both stacks

  const timeout = (params.duration_seconds * 1000) + TIMEOUTS.DEFAULT;
  const result = await safeExec('offcputime', args, { timeout });

  if (!result.success) {
    return {
      success: false,
      tool: 'perf_offcpu_profile',
      tool_version: TOOL_VERSION,
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      host: process.env.HOSTNAME || 'unknown',
      error: {
        code: result.error?.code || ErrorCode.EXECUTION_FAILED,
        message: result.error?.message || 'offcputime execution failed',
        recoverable: true,
        suggestion: result.error?.suggestion,
      },
    };
  }

  // Parse output
  const parsed = parseOffcputime(result.stdout);

  // Generate analysis notes
  if (parsed.totalBlockedUs > 0) {
    const topFunc = parsed.topFunctions[0];
    if (topFunc) {
      if (topFunc.function.includes('futex') || topFunc.function.includes('mutex')) {
        notes.push(`Lock contention detected: ${topFunc.function} accounts for ${topFunc.percent.toFixed(1)}% of blocked time`);
      }
      if (topFunc.function.includes('nanosleep') || topFunc.function.includes('sleep')) {
        notes.push(`Sleep calls detected: ${topFunc.function} - may be intentional throttling`);
      }
      if (topFunc.function.includes('read') || topFunc.function.includes('write') || topFunc.function.includes('io')) {
        notes.push(`I/O blocking detected: ${topFunc.function} - consider async I/O or buffering`);
      }
      if (topFunc.function.includes('poll') || topFunc.function.includes('epoll') || topFunc.function.includes('select')) {
        notes.push(`Network I/O wait detected: ${topFunc.function} - check for slow backends`);
      }
    }
  }

  return {
    success: true,
    tool: 'perf_offcpu_profile',
    tool_version: TOOL_VERSION,
    timestamp: new Date().toISOString(),
    duration_ms: Date.now() - startTime,
    host: process.env.HOSTNAME || 'unknown',
    data: {
      method: 'bcc_offcputime',
      duration_seconds: params.duration_seconds,
      pid: params.pid,
      total_blocked_us: parsed.totalBlockedUs,
      total_blocked_ms: parsed.totalBlockedUs / 1000,
      top_blockers: parsed.topFunctions.slice(0, 15).map((f) => ({
        function: f.function,
        blocked_us: f.totalUs,
        blocked_ms: f.totalUs / 1000,
        percent: f.percent,
      })),
      sample_stacks: parsed.entries.slice(0, 10).map((e) => ({
        stack: e.stack,
        blocked_us: e.totalUs,
      })),
      notes,
    },
  };
}

async function runPerfSched(
  params: OffcpuProfileInput,
  startTime: number,
  notes: string[]
): Promise<PerfResponse<OffcpuProfileData>> {
  // perf sched record + latency as fallback
  const recordArgs = ['sched', 'record', '--', 'sleep', String(params.duration_seconds)];

  if (params.pid) {
    recordArgs.splice(2, 0, '-p', String(params.pid));
  }

  const timeout = (params.duration_seconds * 1000) + TIMEOUTS.DEFAULT;

  // Run perf sched record
  const recordResult = await safeExec('perf', recordArgs, { timeout });

  if (!recordResult.success) {
    return {
      success: false,
      tool: 'perf_offcpu_profile',
      tool_version: TOOL_VERSION,
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      host: process.env.HOSTNAME || 'unknown',
      error: {
        code: recordResult.error?.code || ErrorCode.EXECUTION_FAILED,
        message: recordResult.error?.message || 'perf sched record failed',
        recoverable: true,
        suggestion: 'Ensure perf_event_paranoid allows access or run as root',
      },
    };
  }

  // Get latency report
  const latencyResult = await safeExec('perf', ['sched', 'latency'], { timeout: TIMEOUTS.DEFAULT });

  if (!latencyResult.success) {
    notes.push('perf sched latency report failed, limited data available');
  }

  // Parse the latency output
  const parsed = latencyResult.success ? parsePerfSchedLatency(latencyResult.stdout) : null;

  return {
    success: true,
    tool: 'perf_offcpu_profile',
    tool_version: TOOL_VERSION,
    timestamp: new Date().toISOString(),
    duration_ms: Date.now() - startTime,
    host: process.env.HOSTNAME || 'unknown',
    data: {
      method: 'perf_sched',
      duration_seconds: params.duration_seconds,
      pid: params.pid,
      total_blocked_us: parsed?.totalDelayUs || 0,
      total_blocked_ms: (parsed?.totalDelayUs || 0) / 1000,
      top_blockers: parsed?.tasks.slice(0, 15).map((t) => ({
        function: t.task,
        blocked_us: t.avgDelayUs * t.count,
        blocked_ms: (t.avgDelayUs * t.count) / 1000,
        percent: parsed.totalDelayUs > 0 ? ((t.avgDelayUs * t.count) / parsed.totalDelayUs) * 100 : 0,
      })) || [],
      notes,
    },
  };
}
