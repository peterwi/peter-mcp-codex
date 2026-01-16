/**
 * perf_file_trace tool
 * Trace file operations using BCC tools (fileslower, filelife, opensnoop)
 */

import { z } from 'zod';
import { TOOL_VERSION, ErrorCode } from '../lib/constants.js';
import { safeExec } from '../lib/exec.js';
import { detectCapabilities } from '../lib/detect.js';
import { parseFileslower, parseFilelife, parseOpensnoop } from '../parse/bcc.js';
import type { PerfResponse } from '../lib/schemas.js';

export const FileTraceInputSchema = z.object({
  duration_seconds: z
    .number()
    .min(1)
    .max(30)
    .default(5)
    .describe('Duration in seconds (1-30)'),
  pid: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Filter by process ID'),
  min_latency_ms: z
    .number()
    .min(0)
    .max(10000)
    .default(10)
    .describe('Minimum latency threshold in ms for slow operations'),
  mode: z
    .enum(['slow_ops', 'file_lifecycle', 'opens', 'all'])
    .default('slow_ops')
    .describe('Trace mode: slow_ops (fileslower), file_lifecycle (filelife), opens (opensnoop), or all'),
  include_all_files: z
    .boolean()
    .default(false)
    .describe('Include all file types (not just regular files)'),
});

export type FileTraceInput = z.infer<typeof FileTraceInputSchema>;
export type FileTraceRawInput = z.input<typeof FileTraceInputSchema>;

export interface SlowFileOp {
  timestamp: number;
  pid: number;
  comm: string;
  direction: 'R' | 'W';
  bytes: number;
  latency_ms: number;
  filename: string;
}

export interface ShortLivedFile {
  timestamp: string;
  pid: number;
  comm: string;
  age_seconds: number;
  filename: string;
}

export interface FileOpen {
  timestamp?: string;
  pid: number;
  comm: string;
  fd: number;
  error: number;
  path: string;
  failed: boolean;
}

export interface FileTraceData {
  method: string;
  duration_seconds: number;
  filters?: {
    pid?: number;
    min_latency_ms?: number;
  };
  slow_ops?: {
    operations: SlowFileOp[];
    summary: {
      total_ops: number;
      avg_latency_ms: number;
      p95_latency_ms: number;
      max_latency_ms: number;
      read_ops: number;
      write_ops: number;
      by_file: Record<string, { count: number; avg_latency_ms: number }>;
      by_process: Record<string, { count: number; avg_latency_ms: number }>;
    };
  };
  file_lifecycle?: {
    files: ShortLivedFile[];
    summary: {
      total_files: number;
      avg_age_seconds: number;
      short_lived_count: number;
      by_process: Record<string, number>;
    };
  };
  opens?: {
    operations: FileOpen[];
    summary: {
      total_opens: number;
      failed_opens: number;
      by_process: Record<string, number>;
      by_path: Record<string, number>;
    };
  };
  truncated: boolean;
  notes: string[];
}

const MAX_OPS = 300;
const MAX_FILES = 200;
const MAX_OPENS = 300;

export async function perfFileTrace(
  input: FileTraceRawInput = {}
): Promise<PerfResponse<FileTraceData>> {
  const startTime = Date.now();

  try {
    const params = FileTraceInputSchema.parse(input);
    const caps = await detectCapabilities();

    // Check tool availability based on mode
    const hasFileslower = caps.canUseBpf && caps.bccTools.fileslower;
    const hasFilelife = caps.canUseBpf && caps.bccTools.filelife;
    const hasOpensnoop = caps.canUseBpf && caps.bccTools.opensnoop;

    const needsFileslower = params.mode === 'slow_ops' || params.mode === 'all';
    const needsFilelife = params.mode === 'file_lifecycle' || params.mode === 'all';
    const needsOpensnoop = params.mode === 'opens' || params.mode === 'all';

    if (needsFileslower && !hasFileslower) {
      return {
        success: false,
        tool: 'perf_file_trace',
        tool_version: TOOL_VERSION,
        timestamp: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        host: process.env.HOSTNAME || 'unknown',
        error: {
          code: ErrorCode.CAPABILITY_MISSING,
          message: 'File latency tracing requires BCC fileslower tool',
          recoverable: true,
          suggestion: 'Install bcc-tools package and run as root.',
        },
      };
    }

    if (needsFilelife && !hasFilelife) {
      return {
        success: false,
        tool: 'perf_file_trace',
        tool_version: TOOL_VERSION,
        timestamp: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        host: process.env.HOSTNAME || 'unknown',
        error: {
          code: ErrorCode.CAPABILITY_MISSING,
          message: 'File lifecycle tracing requires BCC filelife tool',
          recoverable: true,
          suggestion: 'Install bcc-tools package and run as root.',
        },
      };
    }

    if (needsOpensnoop && !hasOpensnoop) {
      return {
        success: false,
        tool: 'perf_file_trace',
        tool_version: TOOL_VERSION,
        timestamp: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        host: process.env.HOSTNAME || 'unknown',
        error: {
          code: ErrorCode.CAPABILITY_MISSING,
          message: 'File open tracing requires BCC opensnoop tool',
          recoverable: true,
          suggestion: 'Install bcc-tools package and run as root.',
        },
      };
    }

    const notes: string[] = [];
    const timeout = params.duration_seconds * 1000;
    let truncated = false;
    const methods: string[] = [];

    // Results containers
    let slowOpsData: FileTraceData['slow_ops'];
    let fileLifecycleData: FileTraceData['file_lifecycle'];
    let opensData: FileTraceData['opens'];

    // Run fileslower for slow operations
    if (needsFileslower && hasFileslower) {
      methods.push('fileslower');
      const args: string[] = [];

      if (params.pid) {
        args.push('-p', String(params.pid));
      }

      if (params.include_all_files) {
        args.push('-a');
      }

      // Min latency threshold (positional argument)
      args.push(String(params.min_latency_ms));

      const result = await safeExec('fileslower', args, { timeout });

      if (result.stdout) {
        const parsed = parseFileslower(result.stdout);

        let operations: SlowFileOp[] = parsed.operations.map((op) => ({
          timestamp: op.timeSeconds,
          pid: op.pid,
          comm: op.comm,
          direction: op.direction,
          bytes: op.bytes,
          latency_ms: op.latencyMs,
          filename: op.filename,
        }));

        if (operations.length > MAX_OPS) {
          operations = operations.slice(0, MAX_OPS);
          truncated = true;
        }

        // Limit summary maps
        const byFile: Record<string, { count: number; avg_latency_ms: number }> = {};
        const fileEntries = Object.entries(parsed.byFile)
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 20);
        for (const [file, stats] of fileEntries) {
          byFile[file] = { count: stats.count, avg_latency_ms: stats.avgLatencyMs };
        }

        const byProcess: Record<string, { count: number; avg_latency_ms: number }> = {};
        const procEntries = Object.entries(parsed.byProcess)
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 20);
        for (const [proc, stats] of procEntries) {
          byProcess[proc] = { count: stats.count, avg_latency_ms: stats.avgLatencyMs };
        }

        slowOpsData = {
          operations,
          summary: {
            total_ops: parsed.totalOps,
            avg_latency_ms: parsed.avgLatencyMs,
            p95_latency_ms: parsed.p95LatencyMs,
            max_latency_ms: parsed.maxLatencyMs,
            read_ops: parsed.readOps,
            write_ops: parsed.writeOps,
            by_file: byFile,
            by_process: byProcess,
          },
        };

        if (parsed.maxLatencyMs > 100) {
          notes.push(`High file latency detected: max ${parsed.maxLatencyMs.toFixed(1)}ms`);
        }
      }
    }

    // Run filelife for short-lived files
    if (needsFilelife && hasFilelife) {
      methods.push('filelife');
      const args: string[] = [];

      if (params.pid) {
        args.push('-p', String(params.pid));
      }

      const result = await safeExec('filelife', args, { timeout });

      if (result.stdout) {
        const parsed = parseFilelife(result.stdout);

        let files: ShortLivedFile[] = parsed.files.map((f) => ({
          timestamp: f.timestamp,
          pid: f.pid,
          comm: f.comm,
          age_seconds: f.ageSeconds,
          filename: f.filename,
        }));

        if (files.length > MAX_FILES) {
          files = files.slice(0, MAX_FILES);
          truncated = true;
        }

        // Limit by_process
        const byProcess: Record<string, number> = {};
        const procEntries = Object.entries(parsed.byProcess)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20);
        for (const [proc, count] of procEntries) {
          byProcess[proc] = count;
        }

        fileLifecycleData = {
          files,
          summary: {
            total_files: parsed.totalFiles,
            avg_age_seconds: parsed.avgAgeSeconds,
            short_lived_count: parsed.shortLivedCount,
            by_process: byProcess,
          },
        };

        if (parsed.shortLivedCount > 10) {
          notes.push(`${parsed.shortLivedCount} short-lived files (<1s) - check for temp file churn`);
        }
      }
    }

    // Run opensnoop for file opens
    if (needsOpensnoop && hasOpensnoop) {
      methods.push('opensnoop');
      const args: string[] = ['-T']; // Timestamps

      if (params.pid) {
        args.push('-p', String(params.pid));
      }

      const result = await safeExec('opensnoop', args, { timeout });

      if (result.stdout) {
        const parsed = parseOpensnoop(result.stdout);

        let operations: FileOpen[] = parsed.opens.map((o) => ({
          timestamp: o.timestamp,
          pid: o.pid,
          comm: o.comm,
          fd: o.fd,
          error: o.err,
          path: o.path,
          failed: o.err !== 0 || o.fd < 0,
        }));

        if (operations.length > MAX_OPENS) {
          operations = operations.slice(0, MAX_OPENS);
          truncated = true;
        }

        // Limit summary maps
        const byProcess: Record<string, number> = {};
        const procEntries = Object.entries(parsed.byProcess)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20);
        for (const [proc, count] of procEntries) {
          byProcess[proc] = count;
        }

        const byPath: Record<string, number> = {};
        const pathEntries = Object.entries(parsed.byPath)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20);
        for (const [path, count] of pathEntries) {
          byPath[path] = count;
        }

        opensData = {
          operations,
          summary: {
            total_opens: parsed.totalOpens,
            failed_opens: parsed.failedOpens,
            by_process: byProcess,
            by_path: byPath,
          },
        };

        if (parsed.failedOpens > 10) {
          const failRate = (parsed.failedOpens / parsed.totalOpens) * 100;
          notes.push(`${parsed.failedOpens} failed opens (${failRate.toFixed(1)}%) - check permissions/paths`);
        }
      }
    }

    // Build filter info
    const filters: FileTraceData['filters'] = {};
    if (params.pid) filters.pid = params.pid;
    if (params.min_latency_ms > 0) filters.min_latency_ms = params.min_latency_ms;

    return {
      success: true,
      tool: 'perf_file_trace',
      tool_version: TOOL_VERSION,
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      host: process.env.HOSTNAME || 'unknown',
      data: {
        method: methods.join('+'),
        duration_seconds: params.duration_seconds,
        filters: Object.keys(filters).length > 0 ? filters : undefined,
        slow_ops: slowOpsData,
        file_lifecycle: fileLifecycleData,
        opens: opensData,
        truncated,
        notes,
      },
    };
  } catch (error) {
    return {
      success: false,
      tool: 'perf_file_trace',
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
