/**
 * perf_snapshot tool - Point-in-time system metrics
 * Supports both single snapshot and interval mode for time-series data
 */
import { hostname } from 'node:os';
import { z } from 'zod';
import { getCachedCapabilities, detectCapabilities } from '../lib/detect.js';
import { safeReadFile, safeExec, isExecError } from '../lib/exec.js';
import { TOOL_VERSION } from '../lib/constants.js';
import { parseProcStat, parseProcLoadavg, parseProcMeminfo, parseProcVmstat, parseProcNetDev, parseProcNetSnmp, parseProcPressure, } from '../parse/procfs.js';
import { parseIostat } from '../parse/iostat.js';
export const SnapshotInputSchema = z.object({
    include_per_cpu: z
        .boolean()
        .default(false)
        .describe('Include per-CPU breakdown'),
    include_per_device: z
        .boolean()
        .default(true)
        .describe('Include per-device I/O stats'),
    include_psi: z
        .boolean()
        .default(true)
        .describe('Include PSI metrics (if available)'),
    interval_sec: z
        .number()
        .int()
        .min(1)
        .max(60)
        .optional()
        .describe('Interval between samples in seconds (1-60). If set, enables interval mode.'),
    count: z
        .number()
        .int()
        .min(2)
        .max(60)
        .default(5)
        .describe('Number of samples to collect in interval mode (2-60, default: 5)'),
});
/**
 * Collect a single snapshot sample
 */
async function collectSingleSnapshot(include_per_device, include_psi, caps) {
    // Read procfs files in parallel
    const [statResult, loadavgResult, meminfoResult, vmstatResult, netdevResult, snmpResult] = await Promise.all([
        safeReadFile('/proc/stat'),
        safeReadFile('/proc/loadavg'),
        safeReadFile('/proc/meminfo'),
        safeReadFile('/proc/vmstat'),
        safeReadFile('/proc/net/dev'),
        safeReadFile('/proc/net/snmp'),
    ]);
    // Parse CPU stats
    let cpuStats = {
        cpu: { user: 0, nice: 0, system: 0, idle: 100, iowait: 0, irq: 0, softirq: 0, steal: 0 },
        contextSwitches: 0,
        interrupts: 0,
        runQueue: 0,
        processesRunning: 0,
    };
    if (statResult.success) {
        cpuStats = parseProcStat(statResult.content);
    }
    // Parse load average
    let loadAvg = [0, 0, 0];
    let runQueue = 0;
    if (loadavgResult.success) {
        const parsed = parseProcLoadavg(loadavgResult.content);
        loadAvg = parsed.loadAvg;
        runQueue = parsed.runQueue;
    }
    // Parse memory info
    let memStats = {
        total_bytes: 0,
        available_bytes: 0,
        used_bytes: 0,
        buffers_bytes: 0,
        cached_bytes: 0,
        swap_used_bytes: 0,
        swap_total_bytes: 0,
        page_faults: 0,
        major_faults: 0,
    };
    if (meminfoResult.success) {
        memStats = parseProcMeminfo(meminfoResult.content);
    }
    // Parse vmstat for page faults
    if (vmstatResult.success) {
        const vmstat = parseProcVmstat(vmstatResult.content);
        memStats.page_faults = vmstat.pgfault;
        memStats.major_faults = vmstat.pgmajfault;
    }
    // Parse network interfaces
    let networkInterfaces = [];
    if (netdevResult.success) {
        networkInterfaces = parseProcNetDev(netdevResult.content);
    }
    // Parse TCP stats
    let tcpStats = {
        active_connections: 0,
        passive_connections: 0,
        retransmits: 0,
        in_segs: 0,
        out_segs: 0,
    };
    if (snmpResult.success) {
        tcpStats = parseProcNetSnmp(snmpResult.content);
    }
    // Get I/O device stats
    let ioDevices = [];
    if (include_per_device && caps.hasIostat) {
        const iostatResult = await safeExec('iostat', ['-xz', '-d', '1', '1']);
        if (!isExecError(iostatResult) && iostatResult.success) {
            ioDevices = parseIostat(iostatResult.stdout);
        }
    }
    // Get PSI metrics if available and requested
    let pressure;
    if (include_psi && caps.hasPsi) {
        const [cpuPsi, memPsi, ioPsi] = await Promise.all([
            safeReadFile('/proc/pressure/cpu'),
            safeReadFile('/proc/pressure/memory'),
            safeReadFile('/proc/pressure/io'),
        ]);
        pressure = {
            cpu: cpuPsi.success
                ? parseProcPressure(cpuPsi.content)
                : { some_avg10: 0, some_avg60: 0, some_avg300: 0, full_avg10: 0, full_avg60: 0, full_avg300: 0, some_total: 0, full_total: 0 },
            memory: memPsi.success
                ? parseProcPressure(memPsi.content)
                : { some_avg10: 0, some_avg60: 0, some_avg300: 0, full_avg10: 0, full_avg60: 0, full_avg300: 0, some_total: 0, full_total: 0 },
            io: ioPsi.success
                ? parseProcPressure(ioPsi.content)
                : { some_avg10: 0, some_avg60: 0, some_avg300: 0, full_avg10: 0, full_avg60: 0, full_avg300: 0, some_total: 0, full_total: 0 },
        };
    }
    return {
        cpu: {
            load_avg: loadAvg,
            run_queue: runQueue || cpuStats.runQueue,
            utilization: cpuStats.cpu,
            context_switches: cpuStats.contextSwitches,
            interrupts: cpuStats.interrupts,
        },
        memory: memStats,
        io: {
            devices: ioDevices,
        },
        network: {
            interfaces: networkInterfaces,
            tcp: tcpStats,
        },
        pressure,
    };
}
/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
export async function perfSnapshot(options = {}) {
    const startTime = Date.now();
    const warnings = [];
    const { include_per_device = true, include_psi = true, interval_sec, count = 5, } = options;
    try {
        // Ensure capabilities are detected
        let caps;
        try {
            caps = getCachedCapabilities();
        }
        catch {
            caps = await detectCapabilities();
        }
        // Interval mode: collect multiple samples
        if (interval_sec !== undefined && interval_sec >= 1) {
            const samples = [];
            const intervalMs = interval_sec * 1000;
            for (let i = 0; i < count; i++) {
                const sampleData = await collectSingleSnapshot(include_per_device, include_psi, caps);
                samples.push({
                    timestamp: new Date().toISOString(),
                    sample_index: i,
                    data: sampleData,
                });
                // Sleep between samples (except after the last one)
                if (i < count - 1) {
                    await sleep(intervalMs);
                }
            }
            // Calculate summary statistics
            const totalCpuUtil = samples.reduce((sum, s) => {
                const util = s.data.cpu.utilization;
                return sum + (100 - util.idle);
            }, 0);
            const totalMemUsed = samples.reduce((sum, s) => {
                const mem = s.data.memory;
                return sum + (mem.total_bytes > 0 ? ((mem.total_bytes - mem.available_bytes) / mem.total_bytes) * 100 : 0);
            }, 0);
            const intervalData = {
                mode: 'interval',
                interval_sec,
                samples,
                summary: {
                    total_samples: samples.length,
                    duration_seconds: (Date.now() - startTime) / 1000,
                    cpu_avg_utilization: totalCpuUtil / samples.length,
                    memory_avg_used_percent: totalMemUsed / samples.length,
                },
            };
            return {
                success: true,
                tool: 'perf_snapshot',
                tool_version: TOOL_VERSION,
                timestamp: new Date().toISOString(),
                duration_ms: Date.now() - startTime,
                host: hostname(),
                data: intervalData,
                warnings: warnings.length > 0 ? warnings : undefined,
            };
        }
        // Single snapshot mode (default)
        if (!include_per_device || !caps.hasIostat) {
            // Need to check for iostat warning
            if (include_per_device && !caps.hasIostat) {
                warnings.push('iostat not available, I/O stats may be limited');
            }
        }
        if (include_psi && !caps.hasPsi) {
            warnings.push('PSI not available on this system');
        }
        const data = await collectSingleSnapshot(include_per_device, include_psi, caps);
        return {
            success: true,
            tool: 'perf_snapshot',
            tool_version: TOOL_VERSION,
            timestamp: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
            host: hostname(),
            data,
            warnings: warnings.length > 0 ? warnings : undefined,
        };
    }
    catch (err) {
        const error = err;
        return {
            success: false,
            tool: 'perf_snapshot',
            tool_version: TOOL_VERSION,
            timestamp: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
            host: hostname(),
            error: {
                code: 'EXECUTION_FAILED',
                message: error.message,
                recoverable: true,
                suggestion: 'Check system permissions and try again',
            },
        };
    }
}
//# sourceMappingURL=snapshot.js.map