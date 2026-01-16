/**
 * perf_vfs_latency tool
 * VFS (Virtual File System) layer latency distribution
 * Shows which file operations are slow and their latency distribution
 */
import { z } from 'zod';
import { DURATION_LIMITS, TIMEOUTS, TOOL_VERSION, ErrorCode } from '../lib/constants.js';
import { safeExec } from '../lib/exec.js';
import { detectCapabilities } from '../lib/detect.js';
import { parseFileslower } from '../parse/bcc.js';
export const VfsLatencyInputSchema = z.object({
    duration_seconds: z
        .number()
        .int()
        .min(DURATION_LIMITS.MIN)
        .max(30)
        .default(5)
        .describe('Duration in seconds (1-30)'),
    min_latency_ms: z
        .number()
        .min(0)
        .max(10000)
        .default(10)
        .describe('Minimum latency threshold in ms to report (0-10000, default: 10)'),
    pid: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Filter to specific process ID'),
    include_all_files: z
        .boolean()
        .default(false)
        .describe('Include non-regular files (sockets, FIFOs)'),
});
/**
 * Calculate percentile from sorted array
 */
function percentile(sorted, p) {
    if (sorted.length === 0)
        return 0;
    const idx = Math.floor(sorted.length * p);
    return sorted[Math.min(idx, sorted.length - 1)];
}
/**
 * Build bpftrace script for VFS latency when fileslower is unavailable
 */
function buildVfsLatencyScript(minLatencyMs, durationSec, pid) {
    const pidFilter = pid ? `if (pid == ${pid})` : '';
    const minLatencyUs = minLatencyMs * 1000;
    return `
tracepoint:syscalls:sys_enter_read,
tracepoint:syscalls:sys_enter_write {
  ${pidFilter} {
    @start[tid] = nsecs;
    @op[tid] = probe == "tracepoint:syscalls:sys_enter_read" ? "R" : "W";
  }
}

tracepoint:syscalls:sys_exit_read,
tracepoint:syscalls:sys_exit_write {
  $s = @start[tid];
  if ($s > 0) {
    $delta_us = (nsecs - $s) / 1000;
    if ($delta_us >= ${minLatencyUs}) {
      printf("%d %s %d %s %d %d\\n",
        nsecs / 1000000,
        comm,
        pid,
        @op[tid],
        args->ret > 0 ? args->ret : 0,
        $delta_us / 1000);
    }
    delete(@start[tid]);
    delete(@op[tid]);
  }
}

interval:s:${durationSec} {
  exit();
}

END {
  clear(@start);
  clear(@op);
}
`.trim();
}
/**
 * Parse bpftrace output for VFS latency
 * Format: timestamp_ms comm pid op bytes latency_ms
 */
function parseBpftraceVfsLatency(output) {
    const operations = [];
    const lines = output.trim().split('\n');
    for (const line of lines) {
        // Skip non-data lines
        if (line.startsWith('Attaching') || line.startsWith('@') || !line.trim())
            continue;
        const parts = line.trim().split(/\s+/);
        if (parts.length < 6)
            continue;
        const timestamp = parseInt(parts[0], 10);
        const process = parts[1];
        const pid = parseInt(parts[2], 10);
        const operation = parts[3];
        const bytes = parseInt(parts[4], 10);
        const latency_ms = parseInt(parts[5], 10);
        if (isNaN(timestamp) || isNaN(pid) || isNaN(bytes) || isNaN(latency_ms))
            continue;
        operations.push({
            timestamp,
            process,
            pid,
            operation,
            bytes,
            latency_ms,
            filename: 'unknown', // bpftrace doesn't give us filename easily
        });
    }
    return operations;
}
export async function perfVfsLatency(input = {}) {
    const startTime = Date.now();
    try {
        const params = VfsLatencyInputSchema.parse(input);
        const caps = await detectCapabilities();
        const notes = [];
        let method = 'bcc_fileslower';
        let operations = [];
        // Try fileslower first (preferred - gives us filenames)
        const canUseFileslower = caps.canUseBpf && caps.bccTools.fileslower;
        if (canUseFileslower) {
            const args = [];
            if (params.pid) {
                args.push('-p', String(params.pid));
            }
            if (params.include_all_files) {
                args.push('-a');
            }
            // min_ms as positional arg
            args.push(String(params.min_latency_ms));
            // Duration is tricky - fileslower runs until killed
            // We'll use timeout to stop it
            const timeout = (params.duration_seconds * 1000) + TIMEOUTS.DEFAULT;
            const result = await safeExec('fileslower', args, {
                timeout,
            });
            if (result.success || (result.stdout && result.stdout.length > 0)) {
                const parsed = parseFileslower(result.stdout);
                operations = parsed.operations.map((op) => ({
                    timestamp: Math.round(op.timeSeconds * 1000),
                    process: op.comm,
                    pid: op.pid,
                    operation: op.direction,
                    bytes: op.bytes,
                    latency_ms: op.latencyMs,
                    filename: op.filename,
                }));
            }
            else {
                notes.push('fileslower returned no data - trying bpftrace fallback');
                method = 'bpftrace';
            }
        }
        else {
            method = 'bpftrace';
        }
        // Fallback to bpftrace if fileslower not available or failed
        if (method === 'bpftrace' && caps.canUseBpf) {
            notes.push('Using bpftrace (filenames not available)');
            const script = buildVfsLatencyScript(params.min_latency_ms, params.duration_seconds, params.pid);
            const timeout = (params.duration_seconds * 1000) + TIMEOUTS.DEFAULT + 5000;
            const result = await safeExec('bpftrace', ['-e', script], { timeout });
            if (result.success && result.stdout) {
                operations = parseBpftraceVfsLatency(result.stdout);
            }
            else if (!result.success) {
                return {
                    success: false,
                    tool: 'perf_vfs_latency',
                    tool_version: TOOL_VERSION,
                    timestamp: new Date().toISOString(),
                    duration_ms: Date.now() - startTime,
                    host: process.env.HOSTNAME || 'unknown',
                    error: {
                        code: result.error?.code || ErrorCode.EXECUTION_FAILED,
                        message: result.error?.message || 'bpftrace execution failed',
                        recoverable: true,
                        suggestion: 'Ensure bpftrace is installed and you have root/BPF capabilities',
                    },
                };
            }
        }
        else if (method === 'bpftrace' && !caps.canUseBpf) {
            return {
                success: false,
                tool: 'perf_vfs_latency',
                tool_version: TOOL_VERSION,
                timestamp: new Date().toISOString(),
                duration_ms: Date.now() - startTime,
                host: process.env.HOSTNAME || 'unknown',
                error: {
                    code: ErrorCode.CAPABILITY_MISSING,
                    message: 'VFS latency tracing requires BCC fileslower or bpftrace with BPF capabilities',
                    recoverable: true,
                    suggestion: 'Install bcc-tools and run as root',
                },
            };
        }
        // Calculate statistics
        const latencies = operations.map((op) => op.latency_ms).sort((a, b) => a - b);
        const totalBytes = operations.reduce((sum, op) => sum + op.bytes, 0);
        const readOps = operations.filter((op) => op.operation === 'R').length;
        const writeOps = operations.filter((op) => op.operation === 'W').length;
        const avgLatency = latencies.length > 0
            ? latencies.reduce((a, b) => a + b, 0) / latencies.length
            : 0;
        // Aggregate by file
        const byFileMap = new Map();
        for (const op of operations) {
            const key = op.filename;
            const existing = byFileMap.get(key) || { count: 0, totalLatency: 0, totalBytes: 0 };
            existing.count++;
            existing.totalLatency += op.latency_ms;
            existing.totalBytes += op.bytes;
            byFileMap.set(key, existing);
        }
        const byFile = Array.from(byFileMap.entries())
            .map(([filename, stats]) => ({
            filename,
            count: stats.count,
            avg_latency_ms: Math.round((stats.totalLatency / stats.count) * 10) / 10,
            total_bytes: stats.totalBytes,
        }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 20);
        // Aggregate by process
        const byProcessMap = new Map();
        for (const op of operations) {
            const key = `${op.process}:${op.pid}`;
            const existing = byProcessMap.get(key) || { pid: op.pid, count: 0, totalLatency: 0 };
            existing.count++;
            existing.totalLatency += op.latency_ms;
            byProcessMap.set(key, existing);
        }
        const byProcess = Array.from(byProcessMap.entries())
            .map(([key, stats]) => ({
            process: key.split(':')[0],
            pid: stats.pid,
            count: stats.count,
            avg_latency_ms: Math.round((stats.totalLatency / stats.count) * 10) / 10,
        }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 20);
        // Analysis notes
        if (operations.length === 0) {
            notes.push(`No VFS operations exceeded ${params.min_latency_ms}ms threshold`);
        }
        else {
            if (percentile(latencies, 0.99) > 100) {
                notes.push(`High tail latency: p99=${percentile(latencies, 0.99).toFixed(1)}ms`);
            }
            if (readOps > writeOps * 3 && readOps > 10) {
                notes.push('Read-heavy workload - check for cache misses');
            }
            if (writeOps > readOps * 3 && writeOps > 10) {
                notes.push('Write-heavy workload - check for fsync frequency');
            }
        }
        return {
            success: true,
            tool: 'perf_vfs_latency',
            tool_version: TOOL_VERSION,
            timestamp: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
            host: process.env.HOSTNAME || 'unknown',
            data: {
                method,
                duration_seconds: params.duration_seconds,
                min_latency_ms: params.min_latency_ms,
                operations: operations.slice(0, 100), // Limit to 100 operations
                summary: {
                    total_slow_ops: operations.length,
                    read_ops: readOps,
                    write_ops: writeOps,
                    avg_latency_ms: Math.round(avgLatency * 10) / 10,
                    p50_latency_ms: Math.round(percentile(latencies, 0.5) * 10) / 10,
                    p95_latency_ms: Math.round(percentile(latencies, 0.95) * 10) / 10,
                    p99_latency_ms: Math.round(percentile(latencies, 0.99) * 10) / 10,
                    max_latency_ms: Math.round((latencies[latencies.length - 1] || 0) * 10) / 10,
                    total_bytes: totalBytes,
                },
                by_file: byFile,
                by_process: byProcess,
                notes,
            },
        };
    }
    catch (error) {
        return {
            success: false,
            tool: 'perf_vfs_latency',
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
//# sourceMappingURL=vfs-latency.js.map