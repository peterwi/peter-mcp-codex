/**
 * perf_fd_trace tool
 * File descriptor usage and leak detection
 * Monitors FD counts over time to identify potential leaks
 * Works without BCC - uses procfs only
 */
import { z } from 'zod';
import { readdir, readlink } from 'node:fs/promises';
import { TOOL_VERSION, ErrorCode } from '../lib/constants.js';
import { safeReadFile } from '../lib/exec.js';
export const FdTraceInputSchema = z.object({
    pid: z
        .number()
        .int()
        .positive()
        .describe('Process ID to analyze'),
    duration_seconds: z
        .number()
        .int()
        .min(1)
        .max(60)
        .default(5)
        .describe('Duration for leak detection (1-60 seconds)'),
    interval_sec: z
        .number()
        .int()
        .min(1)
        .max(10)
        .default(1)
        .describe('Sampling interval in seconds (1-10)'),
    include_fd_list: z
        .boolean()
        .default(true)
        .describe('Include list of open FDs'),
    max_fds_listed: z
        .number()
        .int()
        .min(10)
        .max(1000)
        .default(100)
        .describe('Maximum number of FDs to list (10-1000)'),
});
/**
 * Get process name from /proc/[pid]/comm
 */
async function getProcessName(pid) {
    const result = await safeReadFile(`/proc/${pid}/comm`);
    return result.success ? result.content.trim() : 'unknown';
}
/**
 * Get FD limits from /proc/[pid]/limits
 */
async function getFdLimits(pid) {
    const result = await safeReadFile(`/proc/${pid}/limits`);
    if (!result.success) {
        return { soft: 1024, hard: 4096 }; // Default values
    }
    const match = result.content.match(/Max open files\s+(\d+)\s+(\d+)/);
    if (match) {
        return {
            soft: parseInt(match[1], 10),
            hard: parseInt(match[2], 10),
        };
    }
    return { soft: 1024, hard: 4096 };
}
/**
 * Classify FD type based on link target
 */
function classifyFdType(target) {
    if (target.startsWith('socket:'))
        return 'socket';
    if (target.startsWith('pipe:'))
        return 'pipe';
    if (target.startsWith('anon_inode:[eventfd]'))
        return 'eventfd';
    if (target.startsWith('anon_inode:[timerfd]'))
        return 'timerfd';
    if (target.startsWith('anon_inode:[signalfd]'))
        return 'signalfd';
    if (target.startsWith('anon_inode:[eventpoll]'))
        return 'epoll';
    if (target.startsWith('anon_inode:'))
        return 'anon_inode';
    if (target.startsWith('/dev/'))
        return 'device';
    if (target.startsWith('/') || target.includes('/'))
        return 'file';
    return 'unknown';
}
/**
 * Get list of open FDs for a process
 */
async function getFdList(pid, maxFds) {
    const fdDir = `/proc/${pid}/fd`;
    const byType = {
        file: 0,
        socket: 0,
        pipe: 0,
        eventfd: 0,
        timerfd: 0,
        signalfd: 0,
        epoll: 0,
        anon_inode: 0,
        device: 0,
        unknown: 0,
    };
    try {
        const entries = await readdir(fdDir);
        const fds = [];
        let listed = 0;
        for (const entry of entries) {
            const fdNum = parseInt(entry, 10);
            if (isNaN(fdNum))
                continue;
            try {
                const target = await readlink(`${fdDir}/${entry}`);
                const type = classifyFdType(target);
                byType[type] = (byType[type] || 0) + 1;
                if (listed < maxFds) {
                    fds.push({ fd: fdNum, type, target });
                    listed++;
                }
            }
            catch {
                // FD may have been closed - count as unknown
                byType['unknown'] = (byType['unknown'] || 0) + 1;
            }
        }
        // Sort by FD number
        fds.sort((a, b) => a.fd - b.fd);
        return {
            fds,
            total: entries.length,
            byType,
        };
    }
    catch (err) {
        // Process may have exited or permission denied
        return { fds: [], total: 0, byType };
    }
}
/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
export async function perfFdTrace(input) {
    const startTime = Date.now();
    try {
        const params = FdTraceInputSchema.parse(input);
        const notes = [];
        // Check if process exists
        const procExists = await safeReadFile(`/proc/${params.pid}/stat`);
        if (!procExists.success) {
            return {
                success: false,
                tool: 'perf_fd_trace',
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
        const processName = await getProcessName(params.pid);
        const limits = await getFdLimits(params.pid);
        // Collect samples over the duration
        const samples = [];
        const numSamples = Math.ceil(params.duration_seconds / params.interval_sec) + 1;
        for (let i = 0; i < numSamples; i++) {
            const { total, byType } = await getFdList(params.pid, 0);
            samples.push({
                timestamp: new Date().toISOString(),
                total_fds: total,
                by_type: { ...byType },
            });
            // Sleep between samples (except after last)
            if (i < numSamples - 1) {
                await sleep(params.interval_sec * 1000);
            }
        }
        // Get final detailed FD list
        const { fds, total, byType } = await getFdList(params.pid, params.max_fds_listed);
        // Calculate leak detection metrics
        const firstSample = samples[0];
        const lastSample = samples[samples.length - 1];
        const fdChange = lastSample.total_fds - firstSample.total_fds;
        const duration = params.duration_seconds;
        const growthRate = fdChange / duration;
        // Determine if this looks like a leak
        let isLikelyLeak = false;
        let interpretation = '';
        if (fdChange > 50 || growthRate > 10) {
            isLikelyLeak = true;
            interpretation = `Rapid FD growth detected: ${fdChange} new FDs in ${duration}s (${growthRate.toFixed(1)}/s)`;
        }
        else if (fdChange > 10 || growthRate > 2) {
            isLikelyLeak = true;
            interpretation = `Moderate FD growth: ${fdChange} new FDs - potential slow leak`;
        }
        else if (fdChange > 0) {
            interpretation = `Minor FD growth: ${fdChange} new FDs - likely normal activity`;
        }
        else if (fdChange < 0) {
            interpretation = `FD count decreased by ${Math.abs(fdChange)} - normal cleanup`;
        }
        else {
            interpretation = 'Stable FD count - no leak detected';
        }
        // Add warnings
        const usagePercent = (total / limits.soft) * 100;
        if (usagePercent > 90) {
            notes.push(`WARNING: FD usage at ${usagePercent.toFixed(1)}% of soft limit (${limits.soft})`);
        }
        else if (usagePercent > 70) {
            notes.push(`High FD usage: ${usagePercent.toFixed(1)}% of soft limit`);
        }
        if (byType.socket > total * 0.5 && total > 100) {
            notes.push('High socket count - check for connection pooling or leaks');
        }
        if (byType.pipe > 50) {
            notes.push('Many open pipes - check for subprocess communication issues');
        }
        return {
            success: true,
            tool: 'perf_fd_trace',
            tool_version: TOOL_VERSION,
            timestamp: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
            host: process.env.HOSTNAME || 'unknown',
            data: {
                pid: params.pid,
                process_name: processName,
                duration_seconds: params.duration_seconds,
                samples,
                current: {
                    total_fds: total,
                    soft_limit: limits.soft,
                    hard_limit: limits.hard,
                    usage_percent: Math.round(usagePercent * 10) / 10,
                    by_type: byType,
                },
                leak_detection: {
                    fd_growth_rate: Math.round(growthRate * 100) / 100,
                    is_likely_leak: isLikelyLeak,
                    fd_change: fdChange,
                    interpretation,
                },
                fd_list: params.include_fd_list ? fds : undefined,
                notes,
            },
        };
    }
    catch (error) {
        return {
            success: false,
            tool: 'perf_fd_trace',
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
//# sourceMappingURL=fd-trace.js.map