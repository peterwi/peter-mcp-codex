/**
 * perf_bio_latency tool
 * Block I/O latency histogram using BCC biolatency or bpftrace
 * Shows distribution of storage I/O latencies
 * Supports both log2 (default) and linear histogram modes
 */
import { z } from 'zod';
import { DURATION_LIMITS, TIMEOUTS, TOOL_VERSION, ErrorCode } from '../lib/constants.js';
import { safeExec } from '../lib/exec.js';
import { detectCapabilities } from '../lib/detect.js';
import { parseBiolatency, parseBpftraceLinearHistogram } from '../parse/bcc.js';
export const BioLatencyInputSchema = z.object({
    duration_seconds: z
        .number()
        .min(DURATION_LIMITS.MIN)
        .max(30)
        .default(DURATION_LIMITS.DEFAULT)
        .describe('Duration in seconds (1-30)'),
    device: z
        .string()
        .optional()
        .describe('Filter by device name (e.g., sda, nvme0n1)'),
    per_device: z
        .boolean()
        .default(false)
        .describe('Show histogram per device'),
    queued: z
        .boolean()
        .default(false)
        .describe('Include block I/O queue time'),
    milliseconds: z
        .boolean()
        .default(false)
        .describe('Show in milliseconds (default: microseconds)'),
    histogram_type: z
        .enum(['log2', 'linear'])
        .default('log2')
        .describe('Histogram type: log2 (power-of-2 buckets) or linear (fixed-size buckets)'),
    linear_bucket_ms: z
        .number()
        .min(1)
        .max(100)
        .default(10)
        .describe('Bucket size in milliseconds for linear histograms (1-100, default: 10)'),
});
/**
 * Build bpftrace script for linear histogram block I/O latency
 */
function buildLinearBpftraceScript(bucketMs, durationSec) {
    // Convert bucket size to microseconds for bpftrace
    const bucketUs = bucketMs * 1000;
    // Max range: 1 second (1,000,000 us) - covers most reasonable I/O latencies
    const maxUs = 1000000;
    return `
tracepoint:block:block_rq_issue {
  @start[args->dev, args->sector] = nsecs;
}

tracepoint:block:block_rq_complete {
  $s = @start[args->dev, args->sector];
  if ($s > 0) {
    $delta = (nsecs - $s) / 1000; // Convert to microseconds
    @usecs = lhist($delta, 0, ${maxUs}, ${bucketUs});
    delete(@start[args->dev, args->sector]);
  }
}

interval:s:${durationSec} {
  exit();
}

END {
  clear(@start);
}
`.trim();
}
export async function perfBioLatency(input = {}) {
    const startTime = Date.now();
    try {
        const params = BioLatencyInputSchema.parse(input);
        const caps = await detectCapabilities();
        const notes = [];
        const useLinear = params.histogram_type === 'linear';
        // For linear mode, prefer bpftrace; for log2, use biolatency
        if (useLinear) {
            // Linear histogram requires bpftrace
            if (!caps.canUseBpf) {
                return {
                    success: false,
                    tool: 'perf_bio_latency',
                    tool_version: TOOL_VERSION,
                    timestamp: new Date().toISOString(),
                    duration_ms: Date.now() - startTime,
                    host: process.env.HOSTNAME || 'unknown',
                    error: {
                        code: ErrorCode.CAPABILITY_MISSING,
                        message: 'Linear histogram mode requires bpftrace and root/BPF capabilities',
                        recoverable: true,
                        suggestion: 'Install bpftrace and run as root. Or use histogram_type="log2" for BCC biolatency.',
                    },
                };
            }
            notes.push(`Linear histogram with ${params.linear_bucket_ms}ms buckets`);
            // Build and run bpftrace script
            const script = buildLinearBpftraceScript(params.linear_bucket_ms, params.duration_seconds);
            const timeout = (params.duration_seconds * 1000) + TIMEOUTS.DEFAULT + 5000; // Extra time for bpftrace init
            const result = await safeExec('bpftrace', ['-e', script], { timeout });
            if (!result.success) {
                return {
                    success: false,
                    tool: 'perf_bio_latency',
                    tool_version: TOOL_VERSION,
                    timestamp: new Date().toISOString(),
                    duration_ms: Date.now() - startTime,
                    host: process.env.HOSTNAME || 'unknown',
                    error: {
                        code: result.error?.code || ErrorCode.EXECUTION_FAILED,
                        message: result.error?.message || 'bpftrace execution failed',
                        recoverable: true,
                        suggestion: result.error?.suggestion || 'Ensure bpftrace is installed and you have root/BPF capabilities',
                    },
                };
            }
            // Parse linear histogram output
            const parsed = parseBpftraceLinearHistogram(result.stdout);
            // Generate histogram bars
            const maxCount = Math.max(...parsed.buckets.map((b) => b.count), 1);
            const histogram = parsed.buckets
                .filter((b) => b.count > 0)
                .map((b) => {
                const barLength = Math.round((b.count / maxCount) * 40);
                return {
                    range_start_us: b.rangeStart,
                    range_end_us: b.rangeEnd,
                    count: b.count,
                    bar: '*'.repeat(barLength),
                };
            });
            // Analysis notes
            if (parsed.p99Us > 10000) {
                notes.push(`High tail latency: p99=${(parsed.p99Us / 1000).toFixed(1)}ms - check for disk saturation`);
            }
            if (parsed.avgValueUs > 5000) {
                notes.push(`Elevated average latency: ${(parsed.avgValueUs / 1000).toFixed(1)}ms`);
            }
            return {
                success: true,
                tool: 'perf_bio_latency',
                tool_version: TOOL_VERSION,
                timestamp: new Date().toISOString(),
                duration_ms: Date.now() - startTime,
                host: process.env.HOSTNAME || 'unknown',
                data: {
                    method: 'bpftrace_linear',
                    histogram_type: 'linear',
                    bucket_size_ms: params.linear_bucket_ms,
                    duration_seconds: params.duration_seconds,
                    device: params.device,
                    histogram,
                    summary: {
                        total_ios: parsed.totalOps,
                        avg_latency_us: parsed.avgValueUs,
                        p50_us: parsed.p50Us,
                        p99_us: parsed.p99Us,
                        max_latency_us: parsed.maxValueUs,
                    },
                    notes,
                },
            };
        }
        // Log2 histogram mode (default) - use BCC biolatency
        const canUseBcc = caps.canUseBpf && caps.bccTools.biolatency;
        if (!canUseBcc) {
            return {
                success: false,
                tool: 'perf_bio_latency',
                tool_version: TOOL_VERSION,
                timestamp: new Date().toISOString(),
                duration_ms: Date.now() - startTime,
                host: process.env.HOSTNAME || 'unknown',
                error: {
                    code: ErrorCode.CAPABILITY_MISSING,
                    message: 'Block I/O latency histogram requires BCC biolatency tool',
                    recoverable: true,
                    suggestion: 'Install bcc-tools package and run as root. Use perf_io_latency for basic I/O stats.',
                },
            };
        }
        // Build biolatency args
        const args = [];
        if (params.per_device) {
            args.push('-D'); // Per-disk histograms
        }
        if (params.device) {
            args.push('-d', params.device);
        }
        if (params.queued) {
            args.push('-Q'); // Include queued time
            notes.push('Including block I/O queue time in latency');
        }
        if (params.milliseconds) {
            args.push('-m'); // Milliseconds
        }
        // Duration and interval
        args.push(String(params.duration_seconds), '1');
        const timeout = (params.duration_seconds * 1000) + TIMEOUTS.DEFAULT;
        const result = await safeExec('biolatency', args, { timeout });
        if (!result.success) {
            return {
                success: false,
                tool: 'perf_bio_latency',
                tool_version: TOOL_VERSION,
                timestamp: new Date().toISOString(),
                duration_ms: Date.now() - startTime,
                host: process.env.HOSTNAME || 'unknown',
                error: {
                    code: result.error?.code || ErrorCode.EXECUTION_FAILED,
                    message: result.error?.message || 'biolatency execution failed',
                    recoverable: true,
                    suggestion: result.error?.suggestion,
                },
            };
        }
        // Parse output
        const parsed = parseBiolatency(result.stdout);
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
        // Generate analysis notes
        if (parsed.p99Us > 10000) {
            notes.push(`High tail latency: p99=${(parsed.p99Us / 1000).toFixed(1)}ms - check for disk saturation`);
        }
        if (parsed.avgLatencyUs > 5000) {
            notes.push(`Elevated average latency: ${(parsed.avgLatencyUs / 1000).toFixed(1)}ms`);
        }
        if (parsed.maxLatencyUs > 100000) {
            notes.push(`Outlier detected: max latency=${(parsed.maxLatencyUs / 1000).toFixed(1)}ms - possible disk stall`);
        }
        // Per-device summary if available
        let perDeviceSummary;
        if (parsed.perDevice && Object.keys(parsed.perDevice).length > 0) {
            perDeviceSummary = {};
            for (const [dev, buckets] of Object.entries(parsed.perDevice)) {
                const devTotal = buckets.reduce((sum, b) => sum + b.count, 0);
                const devWeighted = buckets.reduce((sum, b) => sum + ((b.rangeStart + b.rangeEnd) / 2) * b.count, 0);
                perDeviceSummary[dev] = {
                    total_ios: devTotal,
                    avg_latency_us: devTotal > 0 ? devWeighted / devTotal : 0,
                };
            }
        }
        return {
            success: true,
            tool: 'perf_bio_latency',
            tool_version: TOOL_VERSION,
            timestamp: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
            host: process.env.HOSTNAME || 'unknown',
            data: {
                method: 'bcc_biolatency',
                histogram_type: 'log2',
                duration_seconds: params.duration_seconds,
                device: params.device,
                histogram,
                summary: {
                    total_ios: parsed.totalOps,
                    avg_latency_us: parsed.avgLatencyUs,
                    p50_us: parsed.p50Us,
                    p99_us: parsed.p99Us,
                    max_latency_us: parsed.maxLatencyUs,
                },
                per_device: perDeviceSummary,
                notes,
            },
        };
    }
    catch (error) {
        return {
            success: false,
            tool: 'perf_bio_latency',
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
//# sourceMappingURL=bio-latency.js.map