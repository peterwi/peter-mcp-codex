/**
 * Parser for cgroup v2 files
 */
import type { CgroupCpuStats, CgroupIoStats, CgroupMemoryStats, PsiMetrics } from '../lib/schemas.js';
/**
 * Parse cgroup cpu.stat file
 * Example:
 * usage_usec 1234567890
 * user_usec 1000000000
 * system_usec 234567890
 * nr_periods 12345
 * nr_throttled 678
 * throttled_usec 9012345
 */
export declare function parseCgroupCpuStat(content: string): CgroupCpuStats;
/**
 * Parse cgroup cpu.max file
 * Format: "max period" or "quota period"
 * Example: "200000 100000" means 2 cores (200ms out of 100ms period)
 */
export declare function parseCgroupCpuMax(content: string): {
    quotaUsec: number;
    periodUsec: number;
    limitCores: number | null;
};
/**
 * Parse cgroup memory.stat file
 * Example:
 * anon 123456789
 * file 234567890
 * kernel 34567890
 * ...
 */
export declare function parseCgroupMemoryStat(content: string): Record<string, number>;
/**
 * Parse cgroup memory.current
 */
export declare function parseCgroupMemoryCurrent(content: string): number;
/**
 * Parse cgroup memory.max
 * Returns -1 for "max" (no limit)
 */
export declare function parseCgroupMemoryMax(content: string): number;
/**
 * Parse cgroup memory.events file
 * Example:
 * low 0
 * high 0
 * max 123
 * oom 0
 * oom_kill 0
 * oom_group_kill 0
 */
export declare function parseCgroupMemoryEvents(content: string): {
    low: number;
    high: number;
    max: number;
    oom: number;
    oom_kill: number;
};
/**
 * Parse cgroup io.stat file
 * Example:
 * 8:0 rbytes=123456 wbytes=234567 rios=1234 wios=2345 dbytes=0 dios=0
 * 8:16 rbytes=345678 wbytes=456789 rios=3456 wios=4567 dbytes=0 dios=0
 */
export declare function parseCgroupIoStat(content: string): CgroupIoStats;
/**
 * Parse cgroup pids.current
 */
export declare function parseCgroupPidsCurrent(content: string): number;
/**
 * Parse cgroup pids.max
 * Returns -1 for "max" (no limit)
 */
export declare function parseCgroupPidsMax(content: string): number;
/**
 * Build complete memory stats from cgroup files
 */
export declare function buildCgroupMemoryStats(current: number, max: number, stat: Record<string, number>, events: {
    oom_kill: number;
}): CgroupMemoryStats;
/**
 * Parse PSI format (same as /proc/pressure/*)
 * Example:
 * some avg10=0.00 avg60=0.00 avg300=0.00 total=0
 * full avg10=0.00 avg60=0.00 avg300=0.00 total=0
 */
export declare function parseCgroupPressure(content: string): PsiMetrics;
/**
 * Identify issues from cgroup stats
 */
export declare function identifyCgroupIssues(cpuStats: CgroupCpuStats, _cpuMax: {
    limitCores: number | null;
}, memStats: CgroupMemoryStats, memPressure: PsiMetrics | null): string[];
//# sourceMappingURL=cgroup.d.ts.map