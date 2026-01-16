/**
 * perf_syscall_count tool
 * Count syscalls per process with latency distribution using BCC syscount
 * With bpftrace fallback for improved reliability
 */
import { z } from 'zod';
import { DURATION_LIMITS, TOOL_VERSION, ErrorCode } from '../lib/constants.js';
import { detectCapabilities } from '../lib/detect.js';
import { executeBcc } from '../lib/bcc-runtime.js';
import { getSyscountScript } from '../lib/bpftrace-fallbacks.js';
import { parseSyscount, parseSyscountWithLatency } from '../parse/bcc.js';
import { createFinding, createEvidence } from '../lib/output-schema.js';
export const SyscallCountInputSchema = z.object({
    duration_seconds: z
        .number()
        .min(DURATION_LIMITS.MIN)
        .max(DURATION_LIMITS.MAX)
        .default(10)
        .describe('Duration in seconds (1-60)'),
    pid: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Filter by process ID'),
    comm: z
        .string()
        .max(16)
        .optional()
        .describe('Filter by process command name'),
    top_n: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(20)
        .describe('Number of top syscalls to return (1-50)'),
    include_latency: z
        .boolean()
        .default(true)
        .describe('Include syscall latency distribution (requires more overhead)'),
    per_process: z
        .boolean()
        .default(false)
        .describe('Show syscall counts per process'),
    include_errors: z
        .boolean()
        .default(false)
        .describe('Count syscall errors (-x flag)'),
});
/**
 * Parse bpftrace syscount fallback output
 */
function parseBpftraceSyscountOutput(output) {
    const syscalls = [];
    const lines = output.split('\n');
    let inSyscallSection = false;
    for (const line of lines) {
        if (line.includes('=== Syscall Counts ===')) {
            inSyscallSection = true;
            continue;
        }
        if (line.includes('=== By Process ===')) {
            inSyscallSection = false;
            continue;
        }
        if (inSyscallSection && line.includes('@syscalls[')) {
            // Parse: @syscalls[NNN]: COUNT
            const match = line.match(/@syscalls\[(\d+)\]:\s*(\d+)/);
            if (match) {
                const syscallNum = parseInt(match[1], 10);
                const count = parseInt(match[2], 10);
                // Map syscall number to name (simplified - BCC handles this better)
                syscalls.push({
                    name: `syscall_${syscallNum}`,
                    count,
                    rate_per_sec: 0, // Will be calculated later
                });
            }
        }
    }
    return syscalls;
}
export async function perfSyscallCount(input = {}) {
    const startTime = Date.now();
    try {
        const params = SyscallCountInputSchema.parse(input);
        const caps = await detectCapabilities();
        const notes = [];
        const findings = [];
        const evidence = [];
        let target = 'system-wide';
        // Check if we can use BCC syscount
        const canUseBcc = caps.canUseBpf && caps.bccTools.syscount;
        if (!canUseBcc && !caps.hasBpftrace) {
            return {
                success: false,
                tool: 'perf_syscall_count',
                tool_version: TOOL_VERSION,
                timestamp: new Date().toISOString(),
                duration_ms: Date.now() - startTime,
                host: process.env.HOSTNAME || 'unknown',
                error: {
                    code: ErrorCode.CAPABILITY_MISSING,
                    message: 'Syscall counting requires BCC syscount tool or bpftrace',
                    recoverable: true,
                    suggestion: 'Install bcc-tools or bpftrace and run as root. Alternative: use strace for single-process analysis.',
                },
            };
        }
        // Build syscount args
        const args = [];
        // Duration flag
        args.push('-d', String(params.duration_seconds));
        // Top N syscalls
        args.push('-T', String(params.top_n));
        // Process filter
        if (params.pid) {
            args.push('-p', String(params.pid));
            target = `pid:${params.pid}`;
        }
        // Per-process breakdown
        if (params.per_process) {
            args.push('-P');
            notes.push('Showing per-process syscall breakdown');
        }
        // Latency tracking
        if (params.include_latency) {
            args.push('-L');
            notes.push('Including syscall latency (adds overhead)');
        }
        // Error counting
        if (params.include_errors) {
            args.push('-x');
            notes.push('Counting only failed syscalls');
        }
        // Get bpftrace fallback script
        const fallbackScript = getSyscountScript(params.duration_seconds, params.pid);
        // Execute with BCC runtime
        const result = await executeBcc({
            tool: 'syscount',
            args,
            durationSec: params.duration_seconds,
            bpftraceFallback: fallbackScript,
            onProgress: (progress) => {
                // Could emit progress to logs if needed
                if (progress.phase === 'compiling') {
                    notes.push(`BCC compiling... (${progress.message})`);
                }
            },
        });
        // Add any warnings from BCC runtime
        notes.push(...result.warnings);
        if (!result.success) {
            return {
                success: false,
                tool: 'perf_syscall_count',
                tool_version: TOOL_VERSION,
                timestamp: new Date().toISOString(),
                duration_ms: Date.now() - startTime,
                host: process.env.HOSTNAME || 'unknown',
                error: {
                    code: result.error?.code || ErrorCode.EXECUTION_FAILED,
                    message: result.error?.message || 'syscount execution failed',
                    recoverable: result.error?.recoverable ?? true,
                    suggestion: result.error?.suggestion,
                },
            };
        }
        // Parse output based on method and latency flag
        let syscalls;
        let totalLatencyUs;
        const method = result.method === 'bpftrace_fallback' ? 'bpftrace_fallback' : 'bcc_syscount';
        if (result.method === 'bpftrace_fallback') {
            // Parse bpftrace output
            syscalls = parseBpftraceSyscountOutput(result.stdout);
            notes.push('Used bpftrace fallback - syscall names shown as numbers');
        }
        else if (params.include_latency) {
            const parsed = parseSyscountWithLatency(result.stdout);
            totalLatencyUs = parsed.totalTimeUs;
            syscalls = parsed.syscalls.map((s) => ({
                name: s.syscall,
                count: s.count,
                rate_per_sec: params.duration_seconds > 0 ? s.count / params.duration_seconds : 0,
                latency: {
                    total_us: s.totalTimeUs,
                    avg_us: s.avgTimeUs,
                },
            }));
        }
        else {
            const parsed = parseSyscount(result.stdout);
            syscalls = parsed.syscalls.map((s) => ({
                name: s.syscall,
                count: s.count,
                rate_per_sec: params.duration_seconds > 0 ? s.count / params.duration_seconds : 0,
                errors: s.errors,
            }));
        }
        // Calculate rates for bpftrace output
        if (result.method === 'bpftrace_fallback') {
            for (const s of syscalls) {
                s.rate_per_sec = params.duration_seconds > 0 ? s.count / params.duration_seconds : 0;
            }
        }
        // Calculate totals
        const totalSyscalls = syscalls.reduce((sum, s) => sum + s.count, 0);
        // Generate findings
        if (totalSyscalls > 1000000) {
            const rate = totalSyscalls / params.duration_seconds;
            findings.push(createFinding('high_syscall_rate', 'warning', 'High syscall rate', `System is making ${(rate / 1000).toFixed(1)}K syscalls/sec - may indicate busy polling or inefficient I/O`, 'cpu', {
                confidence: 85,
                metrics: { syscalls_per_sec: rate },
                suggestion: 'Check for busy-wait loops, consider using epoll/io_uring for I/O'
            }));
        }
        // Identify suspicious patterns
        const topSyscall = syscalls[0];
        if (topSyscall) {
            const topPercent = (topSyscall.count / totalSyscalls) * 100;
            if (topPercent > 50) {
                findings.push(createFinding('dominant_syscall', 'info', `${topSyscall.name} dominates`, `${topSyscall.name} accounts for ${topPercent.toFixed(1)}% of all syscalls`, 'cpu', {
                    confidence: 90,
                    metrics: { syscall: topSyscall.name, percentage: topPercent },
                    suggestion: topSyscall.name === 'futex'
                        ? 'High futex count may indicate lock contention'
                        : topSyscall.name.includes('read') || topSyscall.name.includes('write')
                            ? 'Consider batching I/O operations'
                            : undefined
                }));
            }
        }
        // Check for high-latency syscalls
        if (params.include_latency) {
            const highLatency = syscalls.filter((s) => s.latency && s.latency.avg_us > 10000);
            if (highLatency.length > 0) {
                for (const s of highLatency.slice(0, 3)) {
                    findings.push(createFinding('high_latency_syscall', 'warning', `High latency: ${s.name}`, `${s.name} has average latency of ${(s.latency.avg_us / 1000).toFixed(1)}ms`, 'io', {
                        confidence: 80,
                        metrics: { avg_latency_us: s.latency.avg_us },
                        suggestion: 'Investigate I/O or lock contention'
                    }));
                }
            }
        }
        // Add evidence
        evidence.push(createEvidence('perf_syscall_count', 'metric', {
            total_syscalls: totalSyscalls,
            duration_seconds: params.duration_seconds,
            method,
            top_syscalls: syscalls.slice(0, 5).map(s => ({ name: s.name, count: s.count })),
        }));
        // Top syscalls lists
        const topByCount = syscalls
            .slice(0, 5)
            .map((s) => s.name);
        const topByLatency = params.include_latency
            ? [...syscalls]
                .sort((a, b) => (b.latency?.total_us || 0) - (a.latency?.total_us || 0))
                .slice(0, 5)
                .map((s) => s.name)
            : undefined;
        return {
            success: true,
            tool: 'perf_syscall_count',
            tool_version: TOOL_VERSION,
            timestamp: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
            host: process.env.HOSTNAME || 'unknown',
            data: {
                method,
                duration_seconds: params.duration_seconds,
                target,
                syscalls: syscalls.slice(0, params.top_n),
                summary: {
                    total_syscalls: totalSyscalls,
                    total_latency_us: totalLatencyUs,
                    unique_syscalls: syscalls.length,
                    top_by_count: topByCount,
                    top_by_latency: topByLatency,
                },
                findings,
                evidence,
                notes,
            },
        };
    }
    catch (error) {
        return {
            success: false,
            tool: 'perf_syscall_count',
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
//# sourceMappingURL=syscall-count.js.map