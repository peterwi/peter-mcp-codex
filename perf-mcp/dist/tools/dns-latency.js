/**
 * perf_dns_latency tool
 * DNS query latency tracing using BCC gethostlatency
 */
import { z } from 'zod';
import { TOOL_VERSION, ErrorCode } from '../lib/constants.js';
import { safeExec } from '../lib/exec.js';
import { detectCapabilities } from '../lib/detect.js';
import { parseGethostlatency } from '../parse/bcc.js';
export const DnsLatencyInputSchema = z.object({
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
});
const MAX_QUERIES = 500;
export async function perfDnsLatency(input = {}) {
    const startTime = Date.now();
    try {
        const params = DnsLatencyInputSchema.parse(input);
        const caps = await detectCapabilities();
        // Check if we can use BCC gethostlatency
        const canUseBcc = caps.canUseBpf && caps.bccTools.gethostlatency;
        if (!canUseBcc) {
            return {
                success: false,
                tool: 'perf_dns_latency',
                tool_version: TOOL_VERSION,
                timestamp: new Date().toISOString(),
                duration_ms: Date.now() - startTime,
                host: process.env.HOSTNAME || 'unknown',
                error: {
                    code: ErrorCode.CAPABILITY_MISSING,
                    message: 'DNS latency tracing requires BCC gethostlatency tool',
                    recoverable: true,
                    suggestion: 'Install bcc-tools package and run as root.',
                },
            };
        }
        const notes = [];
        // Build gethostlatency args
        const args = [];
        if (params.pid) {
            args.push('-p', String(params.pid));
            notes.push(`Filtering by PID: ${params.pid}`);
        }
        // gethostlatency doesn't have a built-in duration, we use timeout
        const timeout = params.duration_seconds * 1000;
        const result = await safeExec('gethostlatency', args, { timeout });
        // gethostlatency may return error due to timeout signal - that's expected
        if (!result.success && !result.stdout) {
            return {
                success: false,
                tool: 'perf_dns_latency',
                tool_version: TOOL_VERSION,
                timestamp: new Date().toISOString(),
                duration_ms: Date.now() - startTime,
                host: process.env.HOSTNAME || 'unknown',
                error: {
                    code: result.error?.code || ErrorCode.EXECUTION_FAILED,
                    message: result.error?.message || 'gethostlatency execution failed',
                    recoverable: true,
                    suggestion: result.error?.suggestion,
                },
            };
        }
        // Parse output
        const parsed = parseGethostlatency(result.stdout);
        // Convert to our format
        let queries = parsed.lookups.map((l) => ({
            timestamp: l.timestamp,
            pid: l.pid,
            comm: l.comm,
            latency_ms: l.latencyMs,
            host: l.host,
        }));
        // Check if truncated
        const truncated = queries.length > MAX_QUERIES;
        if (truncated) {
            queries = queries.slice(0, MAX_QUERIES);
            notes.push(`Output truncated to ${MAX_QUERIES} queries`);
        }
        // Calculate by-process stats
        const processStats = {};
        for (const q of parsed.lookups) {
            if (!processStats[q.comm]) {
                processStats[q.comm] = { count: 0, totalMs: 0 };
            }
            processStats[q.comm].count++;
            processStats[q.comm].totalMs += q.latencyMs;
        }
        // Convert to final format with limits
        const byHost = {};
        const hostEntries = Object.entries(parsed.byHost)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 20);
        for (const [host, stats] of hostEntries) {
            byHost[host] = { count: stats.count, avg_latency_ms: stats.avgLatencyMs };
        }
        const byProcess = {};
        const procEntries = Object.entries(processStats)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 20);
        for (const [proc, stats] of procEntries) {
            byProcess[proc] = {
                count: stats.count,
                avg_latency_ms: stats.count > 0 ? stats.totalMs / stats.count : 0,
            };
        }
        // Generate analysis notes
        if (parsed.maxLatencyMs > 100) {
            notes.push(`High DNS latency detected: max ${parsed.maxLatencyMs.toFixed(1)}ms`);
        }
        if (parsed.p95Ms > 50) {
            notes.push(`Elevated p95 latency: ${parsed.p95Ms.toFixed(1)}ms - check DNS resolver`);
        }
        // Check for slow hosts
        const slowHosts = Object.entries(parsed.byHost)
            .filter(([, stats]) => stats.avgLatencyMs > 100)
            .map(([host]) => host);
        if (slowHosts.length > 0) {
            notes.push(`Slow hosts: ${slowHosts.slice(0, 5).join(', ')}`);
        }
        // Query rate
        const queryRate = parsed.totalLookups / params.duration_seconds;
        if (queryRate > 100) {
            notes.push(`High DNS query rate: ${queryRate.toFixed(1)}/sec`);
        }
        return {
            success: true,
            tool: 'perf_dns_latency',
            tool_version: TOOL_VERSION,
            timestamp: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
            host: process.env.HOSTNAME || 'unknown',
            data: {
                method: 'bcc_gethostlatency',
                duration_seconds: params.duration_seconds,
                filter_pid: params.pid,
                queries,
                summary: {
                    total_queries: parsed.totalLookups,
                    avg_latency_ms: parsed.avgLatencyMs,
                    p50_ms: parsed.p50Ms,
                    p95_ms: parsed.p95Ms,
                    p99_ms: parsed.p99Ms,
                    max_latency_ms: parsed.maxLatencyMs,
                    by_host: byHost,
                    by_process: byProcess,
                },
                truncated,
                notes,
            },
        };
    }
    catch (error) {
        return {
            success: false,
            tool: 'perf_dns_latency',
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
//# sourceMappingURL=dns-latency.js.map