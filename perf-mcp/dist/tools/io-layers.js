/**
 * perf_io_layers tool
 * VFS vs block I/O ratio measurement
 * Shows how much file system activity reaches the block layer
 */
import { z } from 'zod';
import { DURATION_LIMITS, TIMEOUTS, TOOL_VERSION, ErrorCode } from '../lib/constants.js';
import { safeExec, safeReadFile } from '../lib/exec.js';
import { detectCapabilities } from '../lib/detect.js';
import { parseVfsstat } from '../parse/bcc.js';
export const IoLayersInputSchema = z.object({
    duration_seconds: z
        .number()
        .int()
        .min(DURATION_LIMITS.MIN)
        .max(30)
        .default(5)
        .describe('Duration in seconds (1-30)'),
    include_details: z
        .boolean()
        .default(true)
        .describe('Include per-operation breakdown'),
});
function parseProcDiskstats(content) {
    const lines = content.trim().split('\n');
    let totalReads = 0;
    let totalWrites = 0;
    let totalReadSectors = 0;
    let totalWriteSectors = 0;
    for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 14)
            continue;
        const name = parts[2];
        // Skip partition devices (like sda1, sda2), only count whole devices
        // Skip loop, ram, dm devices for cleaner stats
        if (name.match(/^(loop|ram|dm-)/))
            continue;
        if (name.match(/\d+$/) && name.match(/^[hs]d/))
            continue;
        const rdIos = parseInt(parts[3], 10);
        const rdSectors = parseInt(parts[5], 10);
        const wrIos = parseInt(parts[7], 10);
        const wrSectors = parseInt(parts[9], 10);
        if (!isNaN(rdIos))
            totalReads += rdIos;
        if (!isNaN(wrIos))
            totalWrites += wrIos;
        if (!isNaN(rdSectors))
            totalReadSectors += rdSectors;
        if (!isNaN(wrSectors))
            totalWriteSectors += wrSectors;
    }
    return {
        reads: totalReads,
        writes: totalWrites,
        readSectors: totalReadSectors,
        writeSectors: totalWriteSectors,
    };
}
/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
export async function perfIoLayers(input = {}) {
    const startTime = Date.now();
    try {
        const params = IoLayersInputSchema.parse(input);
        const caps = await detectCapabilities();
        const notes = [];
        let method = 'procfs+bcc';
        // Check if we can use vfsstat (requires BCC)
        const canUseVfsstat = caps.canUseBpf && caps.bccTools.vfsstat;
        if (!canUseVfsstat) {
            // Fallback to procfs-only estimation
            method = 'procfs_only';
            notes.push('vfsstat not available - using procfs estimation (less accurate)');
        }
        // Sample block I/O at start and end
        const diskStatsStartResult = await safeReadFile('/proc/diskstats');
        if (!diskStatsStartResult.success) {
            return {
                success: false,
                tool: 'perf_io_layers',
                tool_version: TOOL_VERSION,
                timestamp: new Date().toISOString(),
                duration_ms: Date.now() - startTime,
                host: process.env.HOSTNAME || 'unknown',
                error: {
                    code: ErrorCode.FILE_NOT_FOUND,
                    message: 'Cannot read /proc/diskstats',
                    recoverable: false,
                },
            };
        }
        const diskStatsStart = parseProcDiskstats(diskStatsStartResult.content);
        // Collect VFS stats
        let vfsReads = 0;
        let vfsWrites = 0;
        let vfsFsyncs = 0;
        let vfsOpens = 0;
        let vfsCreates = 0;
        let vfsUnlinks = 0;
        if (canUseVfsstat) {
            // Run vfsstat for the duration
            const vfsstatResult = await safeExec('vfsstat', [String(params.duration_seconds), '1'], {
                timeout: (params.duration_seconds * 1000) + TIMEOUTS.DEFAULT,
            });
            if (vfsstatResult.success && vfsstatResult.stdout) {
                const parsed = parseVfsstat(vfsstatResult.stdout);
                vfsReads = parsed.totals.reads;
                vfsWrites = parsed.totals.writes;
                vfsFsyncs = parsed.totals.fsyncs;
                vfsOpens = parsed.totals.opens;
                vfsCreates = parsed.totals.creates;
                vfsUnlinks = parsed.totals.unlinks;
            }
            else {
                notes.push('vfsstat execution failed - using fallback');
                method = 'procfs_only';
            }
        }
        else {
            // Wait for duration without vfsstat
            await sleep(params.duration_seconds * 1000);
        }
        // Sample block I/O at end
        const diskStatsEndResult = await safeReadFile('/proc/diskstats');
        if (!diskStatsEndResult.success) {
            return {
                success: false,
                tool: 'perf_io_layers',
                tool_version: TOOL_VERSION,
                timestamp: new Date().toISOString(),
                duration_ms: Date.now() - startTime,
                host: process.env.HOSTNAME || 'unknown',
                error: {
                    code: ErrorCode.FILE_NOT_FOUND,
                    message: 'Cannot read /proc/diskstats',
                    recoverable: false,
                },
            };
        }
        const diskStatsEnd = parseProcDiskstats(diskStatsEndResult.content);
        // Calculate block I/O delta
        const blockReads = diskStatsEnd.reads - diskStatsStart.reads;
        const blockWrites = diskStatsEnd.writes - diskStatsStart.writes;
        const blockTotal = blockReads + blockWrites;
        // For procfs-only mode, estimate VFS from block stats
        // This is a rough estimate assuming some cache hit ratio
        if (method === 'procfs_only') {
            // Assume typical cache hit rate of 80-90%
            // Real VFS ops would be higher than block ops
            const estimatedMultiplier = 5; // Conservative estimate
            vfsReads = blockReads * estimatedMultiplier;
            vfsWrites = blockWrites * estimatedMultiplier;
            notes.push('VFS stats estimated from block I/O (assumes typical cache behavior)');
        }
        const vfsTotal = vfsReads + vfsWrites + vfsFsyncs;
        // Calculate per-second rates
        const duration = params.duration_seconds;
        const vfsReadsPerSec = vfsReads / duration;
        const vfsWritesPerSec = vfsWrites / duration;
        const vfsFsyncsPerSec = vfsFsyncs / duration;
        const vfsOpensPerSec = vfsOpens / duration;
        const vfsCreatesPerSec = vfsCreates / duration;
        const vfsUnlinksPerSec = vfsUnlinks / duration;
        const blockReadsPerSec = blockReads / duration;
        const blockWritesPerSec = blockWrites / duration;
        // Calculate ratios
        const vfsToBlock = blockTotal > 0 ? vfsTotal / blockTotal : Infinity;
        // Estimate cache hit rates
        // Read hit rate: how many VFS reads didn't go to disk
        const readHitRate = vfsReads > 0 && blockReads < vfsReads
            ? ((vfsReads - blockReads) / vfsReads) * 100
            : vfsReads > 0 ? 95 : 0; // Default high if no block reads
        // Write coalesce rate: how many VFS writes were coalesced
        const writeCoalesceRate = vfsWrites > 0 && blockWrites < vfsWrites
            ? ((vfsWrites - blockWrites) / vfsWrites) * 100
            : vfsWrites > 0 ? 50 : 0; // Default moderate
        // Determine cache effectiveness
        let cacheEffectiveness;
        let interpretation;
        if (vfsToBlock >= 10 || (readHitRate >= 95 && writeCoalesceRate >= 80)) {
            cacheEffectiveness = 'excellent';
            interpretation = 'Very high cache hit rate - most I/O served from memory';
        }
        else if (vfsToBlock >= 5 || (readHitRate >= 80 && writeCoalesceRate >= 50)) {
            cacheEffectiveness = 'good';
            interpretation = 'Good caching - majority of I/O cached';
        }
        else if (vfsToBlock >= 2 || readHitRate >= 50) {
            cacheEffectiveness = 'fair';
            interpretation = 'Moderate caching - significant disk activity';
        }
        else {
            cacheEffectiveness = 'poor';
            interpretation = 'Low cache effectiveness - most I/O hitting disk';
        }
        // Add analysis notes
        if (blockTotal === 0 && vfsTotal > 0) {
            notes.push('No block I/O detected - all operations served from cache');
        }
        if (vfsFsyncs > vfsWrites * 0.5 && vfsFsyncs > 10) {
            notes.push('High fsync rate - consider batching writes');
        }
        if (blockReadsPerSec > 1000) {
            notes.push('High block read rate - may indicate working set exceeds cache');
        }
        return {
            success: true,
            tool: 'perf_io_layers',
            tool_version: TOOL_VERSION,
            timestamp: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
            host: process.env.HOSTNAME || 'unknown',
            data: {
                method,
                duration_seconds: params.duration_seconds,
                vfs: {
                    total_ops: vfsTotal,
                    reads_per_sec: Math.round(vfsReadsPerSec * 100) / 100,
                    writes_per_sec: Math.round(vfsWritesPerSec * 100) / 100,
                    fsyncs_per_sec: Math.round(vfsFsyncsPerSec * 100) / 100,
                    opens_per_sec: Math.round(vfsOpensPerSec * 100) / 100,
                    creates_per_sec: Math.round(vfsCreatesPerSec * 100) / 100,
                    unlinks_per_sec: Math.round(vfsUnlinksPerSec * 100) / 100,
                },
                block: {
                    total_ios: blockTotal,
                    reads_per_sec: Math.round(blockReadsPerSec * 100) / 100,
                    writes_per_sec: Math.round(blockWritesPerSec * 100) / 100,
                },
                ratios: {
                    vfs_to_block: Math.round(vfsToBlock * 100) / 100,
                    read_hit_rate: Math.round(readHitRate * 10) / 10,
                    write_coalesce_rate: Math.round(writeCoalesceRate * 10) / 10,
                },
                analysis: {
                    cache_effectiveness: cacheEffectiveness,
                    interpretation,
                },
                notes,
            },
        };
    }
    catch (error) {
        return {
            success: false,
            tool: 'perf_io_layers',
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
//# sourceMappingURL=io-layers.js.map