/**
 * perf_use_check tool - USE method analysis
 * Analyzes Utilization, Saturation, and Errors for each resource
 */
import { hostname } from 'node:os';
import { getCachedCapabilities, detectCapabilities } from '../lib/detect.js';
import { TOOL_VERSION, USE_THRESHOLDS } from '../lib/constants.js';
import { perfSnapshot } from './snapshot.js';
/**
 * Type guard to check if data is a single snapshot (not interval mode)
 */
function isSnapshotData(data) {
    return !('mode' in data) || data.mode !== 'interval';
}
function determineStatus(value, thresholds) {
    if (value >= thresholds.critical)
        return 'critical';
    if (value >= thresholds.warning)
        return 'warning';
    return 'ok';
}
function analyzeResource(utilizationValue, utilizationThresholds, utilizationDetail, saturationValue, saturationThresholds, saturationDetail, errorCount, errorDetail) {
    return {
        utilization: {
            value: utilizationValue,
            status: determineStatus(utilizationValue, utilizationThresholds),
            detail: utilizationDetail,
        },
        saturation: {
            value: saturationValue,
            status: determineStatus(saturationValue, saturationThresholds),
            detail: saturationDetail,
        },
        errors: {
            count: errorCount,
            status: errorCount > 0 ? 'warning' : 'ok',
            detail: errorDetail,
        },
    };
}
function analyzeCpu(snapshot, cpuCount) {
    const { utilization, run_queue, load_avg } = snapshot.cpu;
    const pressure = snapshot.pressure?.cpu;
    // Utilization: user + system + nice + irq + softirq (exclude idle, iowait, steal)
    const cpuUtil = 100 - utilization.idle - utilization.iowait - utilization.steal;
    // Saturation: run queue > CPU count, or PSI some > threshold
    let saturationValue = 0;
    let saturationDetail = '';
    if (run_queue > cpuCount) {
        saturationValue = (run_queue / cpuCount) * 100;
        saturationDetail = `Run queue ${run_queue} exceeds CPU count ${cpuCount}`;
    }
    else if (pressure && pressure.some_avg10 > USE_THRESHOLDS.psi.someAvg10.warning) {
        saturationValue = pressure.some_avg10;
        saturationDetail = `PSI some=${pressure.some_avg10.toFixed(1)}%`;
    }
    else {
        saturationDetail = `Run queue: ${run_queue}, Load: ${load_avg[0].toFixed(2)}`;
    }
    // Errors: steal time indicates resource contention (virtualization)
    const errorCount = utilization.steal > 1 ? Math.round(utilization.steal) : 0;
    const errorDetail = utilization.steal > 1
        ? `Steal time ${utilization.steal.toFixed(1)}% (VM resource contention)`
        : 'No CPU errors detected';
    return analyzeResource(cpuUtil, USE_THRESHOLDS.cpu.utilization, `${cpuUtil.toFixed(1)}% busy (user=${utilization.user.toFixed(1)}%, sys=${utilization.system.toFixed(1)}%, iowait=${utilization.iowait.toFixed(1)}%)`, saturationValue, { warning: 100, critical: 200 }, saturationDetail, errorCount, errorDetail);
}
function analyzeMemory(snapshot) {
    const { memory, pressure } = snapshot;
    // Utilization: percentage of memory used
    const memUtil = memory.total_bytes > 0
        ? ((memory.total_bytes - memory.available_bytes) / memory.total_bytes) * 100
        : 0;
    // Available percentage (inverse for threshold comparison)
    const availablePercent = memory.total_bytes > 0 ? (memory.available_bytes / memory.total_bytes) * 100 : 100;
    // Saturation: swap usage or PSI
    let saturationValue = 0;
    let saturationDetail = '';
    const swapUsedPercent = memory.swap_total_bytes > 0
        ? (memory.swap_used_bytes / memory.swap_total_bytes) * 100
        : 0;
    if (swapUsedPercent > 0) {
        saturationValue = swapUsedPercent;
        saturationDetail = `Swap: ${formatBytes(memory.swap_used_bytes)} / ${formatBytes(memory.swap_total_bytes)} (${swapUsedPercent.toFixed(1)}%)`;
    }
    else if (pressure?.memory && pressure.memory.some_avg10 > 0) {
        saturationValue = pressure.memory.some_avg10;
        saturationDetail = `PSI memory some=${pressure.memory.some_avg10.toFixed(1)}%`;
    }
    else {
        saturationDetail = 'No memory saturation detected';
    }
    // Errors: major page faults indicate memory pressure
    const errorCount = memory.major_faults > 1000 ? memory.major_faults : 0;
    const errorDetail = memory.major_faults > 1000
        ? `High major page faults: ${memory.major_faults}`
        : 'No memory errors detected';
    return {
        utilization: {
            value: memUtil,
            status: determineStatus(100 - availablePercent, {
                warning: 100 - USE_THRESHOLDS.memory.availablePercent.warning,
                critical: 100 - USE_THRESHOLDS.memory.availablePercent.critical,
            }),
            detail: `${formatBytes(memory.used_bytes)} / ${formatBytes(memory.total_bytes)} (${availablePercent.toFixed(1)}% available)`,
        },
        saturation: {
            value: saturationValue,
            status: determineStatus(saturationValue, USE_THRESHOLDS.memory.swapUsedPercent),
            detail: saturationDetail,
        },
        errors: {
            count: errorCount,
            status: errorCount > 0 ? 'warning' : 'ok',
            detail: errorDetail,
        },
    };
}
function analyzeDisk(snapshot) {
    const { devices } = snapshot.io;
    const pressure = snapshot.pressure?.io;
    if (devices.length === 0) {
        return {
            utilization: { value: 0, status: 'ok', detail: 'No block devices found' },
            saturation: { value: 0, status: 'ok', detail: 'No saturation data' },
            errors: { count: 0, status: 'ok', detail: 'No errors' },
        };
    }
    // Find the most utilized device
    const mostUtilized = devices.reduce((a, b) => (b.utilization > a.utilization ? b : a));
    // Utilization: highest device utilization
    const utilizationValue = mostUtilized.utilization;
    // Saturation: queue depth
    const mostQueued = devices.reduce((a, b) => b.avg_queue_size > a.avg_queue_size ? b : a);
    let saturationValue = mostQueued.avg_queue_size;
    let saturationDetail = `${mostQueued.name}: queue=${mostQueued.avg_queue_size.toFixed(2)}`;
    if (pressure && pressure.some_avg10 > saturationValue) {
        saturationValue = pressure.some_avg10;
        saturationDetail = `PSI io some=${pressure.some_avg10.toFixed(1)}%`;
    }
    // Errors: high await time indicates problems
    const slowDevices = devices.filter((d) => d.avg_wait_ms > USE_THRESHOLDS.disk.awaitMs.critical);
    const errorCount = slowDevices.length;
    const errorDetail = slowDevices.length > 0
        ? `High latency on: ${slowDevices.map((d) => `${d.name}(${d.avg_wait_ms.toFixed(1)}ms)`).join(', ')}`
        : 'No I/O errors detected';
    return analyzeResource(utilizationValue, USE_THRESHOLDS.disk.utilization, `${mostUtilized.name}: ${utilizationValue.toFixed(1)}% busy`, saturationValue, USE_THRESHOLDS.disk.avgQueue, saturationDetail, errorCount, errorDetail);
}
function analyzeNetwork(snapshot) {
    const { interfaces, tcp } = snapshot.network;
    // Utilization: hard to measure without knowing link speed
    // Use drops/errors as proxy for saturation
    const totalDrops = interfaces.reduce((sum, iface) => sum + iface.rx_dropped + iface.tx_dropped, 0);
    const totalErrors = interfaces.reduce((sum, iface) => sum + iface.rx_errors + iface.tx_errors, 0);
    // Calculate retransmit rate
    const retransmitRate = tcp.out_segs > 0 ? (tcp.retransmits / tcp.out_segs) * 100 : 0;
    // Utilization: we don't have bandwidth info, so use a proxy
    const utilizationValue = Math.min(retransmitRate * 10, 100); // Rough proxy
    // Saturation: drops and retransmits
    const saturationValue = totalDrops;
    // Errors: retransmits
    const errorCount = tcp.retransmits;
    return {
        utilization: {
            value: utilizationValue,
            status: utilizationValue > 50 ? 'warning' : 'ok',
            detail: `Retransmit rate: ${retransmitRate.toFixed(2)}%`,
        },
        saturation: {
            value: saturationValue,
            status: determineStatus(saturationValue, USE_THRESHOLDS.network.dropsPerSec),
            detail: `Drops: ${totalDrops} (rx: ${interfaces.reduce((s, i) => s + i.rx_dropped, 0)}, tx: ${interfaces.reduce((s, i) => s + i.tx_dropped, 0)})`,
        },
        errors: {
            count: errorCount,
            status: determineStatus(retransmitRate, USE_THRESHOLDS.network.retransmitPercent),
            detail: `Errors: ${totalErrors}, Retransmits: ${tcp.retransmits}`,
        },
    };
}
function generateSuspicions(resources) {
    const suspicions = [];
    // Check each resource
    const checks = [
        { name: 'CPU', metrics: resources.cpu },
        { name: 'Memory', metrics: resources.memory },
        { name: 'Disk', metrics: resources.disk },
        { name: 'Network', metrics: resources.network },
    ];
    for (const { name, metrics } of checks) {
        if (metrics.utilization.status === 'critical') {
            suspicions.push(`${name} utilization critical: ${metrics.utilization.detail}`);
        }
        else if (metrics.utilization.status === 'warning') {
            suspicions.push(`${name} utilization elevated: ${metrics.utilization.detail}`);
        }
        if (metrics.saturation.status === 'critical') {
            suspicions.push(`${name} saturation critical: ${metrics.saturation.detail}`);
        }
        else if (metrics.saturation.status === 'warning') {
            suspicions.push(`${name} saturation detected: ${metrics.saturation.detail}`);
        }
        if (metrics.errors.status !== 'ok') {
            suspicions.push(`${name} errors: ${metrics.errors.detail}`);
        }
    }
    // Sort by severity (critical first)
    return suspicions.slice(0, 5); // Top 5
}
function determineOverallStatus(resources) {
    const allMetrics = [
        resources.cpu.utilization,
        resources.cpu.saturation,
        resources.memory.utilization,
        resources.memory.saturation,
        resources.disk.utilization,
        resources.disk.saturation,
        resources.network.saturation,
    ];
    if (allMetrics.some((m) => m.status === 'critical')) {
        return 'critical';
    }
    if (allMetrics.some((m) => m.status === 'warning')) {
        return 'warning';
    }
    return 'healthy';
}
function formatBytes(bytes) {
    if (bytes < 1024)
        return `${bytes}B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)}KB`;
    if (bytes < 1024 * 1024 * 1024)
        return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)}GB`;
}
export async function perfUseCheck() {
    const startTime = Date.now();
    const warnings = [];
    try {
        // Get capabilities for CPU count
        let caps;
        try {
            caps = getCachedCapabilities();
        }
        catch {
            caps = await detectCapabilities();
        }
        // Get snapshot data
        const snapshotResult = await perfSnapshot({
            include_per_device: true,
            include_psi: true,
        });
        if (!snapshotResult.success || !snapshotResult.data) {
            return {
                success: false,
                tool: 'perf_use_check',
                tool_version: TOOL_VERSION,
                timestamp: new Date().toISOString(),
                duration_ms: Date.now() - startTime,
                host: hostname(),
                error: snapshotResult.error ?? {
                    code: 'EXECUTION_FAILED',
                    message: 'Failed to get system snapshot',
                    recoverable: true,
                },
            };
        }
        // Copy warnings from snapshot
        if (snapshotResult.warnings) {
            warnings.push(...snapshotResult.warnings);
        }
        // Ensure we have single snapshot data (not interval mode)
        const snapshotData = snapshotResult.data;
        if (!isSnapshotData(snapshotData)) {
            return {
                success: false,
                tool: 'perf_use_check',
                tool_version: TOOL_VERSION,
                timestamp: new Date().toISOString(),
                duration_ms: Date.now() - startTime,
                host: hostname(),
                error: {
                    code: 'UNEXPECTED_DATA_FORMAT',
                    message: 'Expected single snapshot, received interval data',
                    recoverable: false,
                },
            };
        }
        const snapshot = snapshotData;
        // Analyze each resource
        const resources = {
            cpu: analyzeCpu(snapshot, caps.cpuCount),
            memory: analyzeMemory(snapshot),
            disk: analyzeDisk(snapshot),
            network: analyzeNetwork(snapshot),
        };
        // Generate summary
        const suspicions = generateSuspicions(resources);
        const status = determineOverallStatus(resources);
        const data = {
            summary: {
                status,
                top_suspicions: suspicions,
            },
            resources,
        };
        return {
            success: true,
            tool: 'perf_use_check',
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
            tool: 'perf_use_check',
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
//# sourceMappingURL=use-check.js.map