/**
 * perf_runq_latency tool
 * Run queue (scheduler) latency histogram using BCC runqlat
 * Shows how long tasks wait to be scheduled onto a CPU
 */
import { z } from 'zod';
import { DURATION_LIMITS, TIMEOUTS, TOOL_VERSION, ErrorCode } from '../lib/constants.js';
import { safeExec } from '../lib/exec.js';
import { detectCapabilities } from '../lib/detect.js';
import { parseRunqlat } from '../parse/bcc.js';
export const RunqLatencyInputSchema = z.object({
    duration_seconds: z
        .number()
        .min(DURATION_LIMITS.MIN)
        .max(30)
        .default(DURATION_LIMITS.DEFAULT)
        .describe('Duration in seconds (1-30)'),
    pid: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Filter by process ID'),
    per_process: z
        .boolean()
        .default(false)
        .describe('Show histogram per process'),
    per_pidns: z
        .boolean()
        .default(false)
        .describe('Show histogram per PID namespace (container)'),
    milliseconds: z
        .boolean()
        .default(false)
        .describe('Show in milliseconds (default: microseconds)'),
});
export async function perfRunqLatency(input = {}) {
    const startTime = Date.now();
    try {
        const params = RunqLatencyInputSchema.parse(input);
        const caps = await detectCapabilities();
        // Check if we can use BCC runqlat
        const canUseBcc = caps.canUseBpf && caps.bccTools.runqlat;
        if (!canUseBcc) {
            return {
                success: false,
                tool: 'perf_runq_latency',
                tool_version: TOOL_VERSION,
                timestamp: new Date().toISOString(),
                duration_ms: Date.now() - startTime,
                host: process.env.HOSTNAME || 'unknown',
                error: {
                    code: ErrorCode.CAPABILITY_MISSING,
                    message: 'Run queue latency histogram requires BCC runqlat tool',
                    recoverable: true,
                    suggestion: 'Install bcc-tools package and run as root. Check CPU saturation via perf_use_check as fallback.',
                },
            };
        }
        const notes = [];
        // Build runqlat args
        const args = [];
        if (params.pid) {
            args.push('-p', String(params.pid));
        }
        if (params.per_process) {
            args.push('-P'); // Per-process histograms
        }
        if (params.per_pidns) {
            args.push('--pidnss'); // Per-namespace histograms
            notes.push('Showing per-container run queue latency');
        }
        if (params.milliseconds) {
            args.push('-m'); // Milliseconds
        }
        // Duration and interval
        args.push(String(params.duration_seconds), '1');
        const timeout = (params.duration_seconds * 1000) + TIMEOUTS.DEFAULT;
        const result = await safeExec('runqlat', args, { timeout });
        if (!result.success) {
            return {
                success: false,
                tool: 'perf_runq_latency',
                tool_version: TOOL_VERSION,
                timestamp: new Date().toISOString(),
                duration_ms: Date.now() - startTime,
                host: process.env.HOSTNAME || 'unknown',
                error: {
                    code: result.error?.code || ErrorCode.EXECUTION_FAILED,
                    message: result.error?.message || 'runqlat execution failed',
                    recoverable: true,
                    suggestion: result.error?.suggestion,
                },
            };
        }
        // Parse output
        const parsed = parseRunqlat(result.stdout);
        // Generate histogram bars
        const maxCount = Math.max(...parsed.buckets.map((b) => b.count), 1);
        const histogram = parsed.buckets
            .filter((b) => b.count > 0)
            .map((b) => {
            const barLength = Math.round((b.count / maxCount) * 40);
            return {
                range_start_us: params.milliseconds ? b.rangeStart * 1000 : b.rangeStart,
                range_end_us: params.milliseconds ? b.rangeEnd * 1000 : b.rangeEnd,
                count: b.count,
                bar: '*'.repeat(barLength),
            };
        });
        // Interpret results - scheduler latency thresholds
        // < 10us: excellent, 10-100us: good, 100us-1ms: moderate, 1ms-10ms: high, >10ms: critical
        let status = 'healthy';
        let detail = '';
        if (parsed.p99Us > 10000) {
            status = 'critical';
            detail = `Critical scheduler latency: p99=${(parsed.p99Us / 1000).toFixed(1)}ms. CPU severely overloaded.`;
            notes.push('CPU is heavily saturated - consider reducing load or adding CPU capacity');
        }
        else if (parsed.p99Us > 1000) {
            status = 'warning';
            detail = `Elevated scheduler latency: p99=${(parsed.p99Us / 1000).toFixed(2)}ms. CPU moderately loaded.`;
            notes.push('Some CPU saturation detected - may affect latency-sensitive workloads');
        }
        else if (parsed.p99Us > 100) {
            status = 'healthy';
            detail = `Normal scheduler latency: p99=${parsed.p99Us.toFixed(0)}µs. CPU has some headroom.`;
        }
        else {
            status = 'healthy';
            detail = `Excellent scheduler latency: p99=${parsed.p99Us.toFixed(0)}µs. CPU is lightly loaded.`;
        }
        // Additional analysis
        if (parsed.maxLatencyUs > 50000) {
            notes.push(`Outlier detected: max latency=${(parsed.maxLatencyUs / 1000).toFixed(1)}ms - possible scheduling spike`);
        }
        if (parsed.avgLatencyUs < 10 && parsed.p99Us < 100) {
            notes.push('System has excellent CPU scheduling performance');
        }
        return {
            success: true,
            tool: 'perf_runq_latency',
            tool_version: TOOL_VERSION,
            timestamp: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
            host: process.env.HOSTNAME || 'unknown',
            data: {
                method: 'bcc_runqlat',
                duration_seconds: params.duration_seconds,
                pid: params.pid,
                histogram,
                summary: {
                    total_wakeups: parsed.totalWakeups,
                    avg_latency_us: parsed.avgLatencyUs,
                    p50_us: parsed.p50Us,
                    p99_us: parsed.p99Us,
                    max_latency_us: parsed.maxLatencyUs,
                },
                interpretation: { status, detail },
                notes,
            },
        };
    }
    catch (error) {
        return {
            success: false,
            tool: 'perf_runq_latency',
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
//# sourceMappingURL=runq-latency.js.map