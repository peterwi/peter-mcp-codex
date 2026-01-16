/**
 * Parsers for /proc filesystem files
 */
import type { CpuUtilization, MemoryStats, NetworkInterfaceStats, PsiMetrics, TcpStats } from '../lib/schemas.js';
/**
 * Parse /proc/stat for CPU statistics
 */
export declare function parseProcStat(content: string): {
    cpu: CpuUtilization;
    contextSwitches: number;
    interrupts: number;
    runQueue: number;
    processesRunning: number;
};
/**
 * Parse /proc/loadavg
 */
export declare function parseProcLoadavg(content: string): {
    loadAvg: [number, number, number];
    runQueue: number;
    totalProcesses: number;
};
/**
 * Parse /proc/meminfo
 */
export declare function parseProcMeminfo(content: string): MemoryStats;
/**
 * Parse /proc/vmstat for page fault info
 */
export declare function parseProcVmstat(content: string): {
    pgfault: number;
    pgmajfault: number;
    pswpin: number;
    pswpout: number;
};
/**
 * Parse /proc/uptime
 */
export declare function parseProcUptime(content: string): {
    uptimeSeconds: number;
    idleSeconds: number;
};
/**
 * Parse /proc/net/dev for network interface statistics
 */
export declare function parseProcNetDev(content: string): NetworkInterfaceStats[];
/**
 * Parse /proc/net/snmp for TCP statistics
 */
export declare function parseProcNetSnmp(content: string): TcpStats;
/**
 * Parse /proc/pressure/* (PSI) files
 */
export declare function parseProcPressure(content: string): PsiMetrics;
/**
 * Parse /proc/<pid>/cgroup for cgroup path
 */
export declare function parseProcPidCgroup(content: string): string | null;
/**
 * Parse /proc/cpuinfo for CPU model
 */
export declare function parseProcCpuinfo(content: string): {
    model: string;
    cores: number;
    threads: number;
};
/**
 * Parse /proc/diskstats
 */
export interface DiskStats {
    device: string;
    readsCompleted: number;
    readsMerged: number;
    sectorsRead: number;
    msReading: number;
    writesCompleted: number;
    writesMerged: number;
    sectorsWritten: number;
    msWriting: number;
    iosInProgress: number;
    msIo: number;
    weightedMsIo: number;
}
export declare function parseProcDiskstats(content: string): DiskStats[];
//# sourceMappingURL=procfs.d.ts.map