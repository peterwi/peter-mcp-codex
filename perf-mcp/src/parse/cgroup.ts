/**
 * Parser for cgroup v2 files
 */

import type {
  CgroupCpuStats,
  CgroupIoStats,
  CgroupMemoryStats,
  PsiMetrics,
} from '../lib/schemas.js';

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
export function parseCgroupCpuStat(content: string): CgroupCpuStats {
  const values: Record<string, number> = {};

  for (const line of content.split('\n')) {
    const parts = line.split(' ');
    if (parts.length === 2) {
      values[parts[0]] = parseInt(parts[1], 10);
    }
  }

  return {
    usage_usec: values['usage_usec'] ?? 0,
    user_usec: values['user_usec'] ?? 0,
    system_usec: values['system_usec'] ?? 0,
    nr_throttled: values['nr_throttled'] ?? 0,
    throttled_usec: values['throttled_usec'] ?? 0,
  };
}

/**
 * Parse cgroup cpu.max file
 * Format: "max period" or "quota period"
 * Example: "200000 100000" means 2 cores (200ms out of 100ms period)
 */
export function parseCgroupCpuMax(content: string): { quotaUsec: number; periodUsec: number; limitCores: number | null } {
  const parts = content.trim().split(' ');

  if (parts[0] === 'max') {
    return {
      quotaUsec: -1,
      periodUsec: parseInt(parts[1], 10) || 100000,
      limitCores: null, // No limit
    };
  }

  const quotaUsec = parseInt(parts[0], 10);
  const periodUsec = parseInt(parts[1], 10) || 100000;

  return {
    quotaUsec,
    periodUsec,
    limitCores: quotaUsec / periodUsec,
  };
}

/**
 * Parse cgroup memory.stat file
 * Example:
 * anon 123456789
 * file 234567890
 * kernel 34567890
 * ...
 */
export function parseCgroupMemoryStat(content: string): Record<string, number> {
  const values: Record<string, number> = {};

  for (const line of content.split('\n')) {
    const parts = line.split(' ');
    if (parts.length === 2) {
      values[parts[0]] = parseInt(parts[1], 10);
    }
  }

  return values;
}

/**
 * Parse cgroup memory.current
 */
export function parseCgroupMemoryCurrent(content: string): number {
  return parseInt(content.trim(), 10) || 0;
}

/**
 * Parse cgroup memory.max
 * Returns -1 for "max" (no limit)
 */
export function parseCgroupMemoryMax(content: string): number {
  const trimmed = content.trim();
  if (trimmed === 'max') {
    return -1;
  }
  return parseInt(trimmed, 10) || 0;
}

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
export function parseCgroupMemoryEvents(content: string): {
  low: number;
  high: number;
  max: number;
  oom: number;
  oom_kill: number;
} {
  const values: Record<string, number> = {};

  for (const line of content.split('\n')) {
    const parts = line.split(' ');
    if (parts.length === 2) {
      values[parts[0]] = parseInt(parts[1], 10);
    }
  }

  return {
    low: values['low'] ?? 0,
    high: values['high'] ?? 0,
    max: values['max'] ?? 0,
    oom: values['oom'] ?? 0,
    oom_kill: values['oom_kill'] ?? 0,
  };
}

/**
 * Parse cgroup io.stat file
 * Example:
 * 8:0 rbytes=123456 wbytes=234567 rios=1234 wios=2345 dbytes=0 dios=0
 * 8:16 rbytes=345678 wbytes=456789 rios=3456 wios=4567 dbytes=0 dios=0
 */
export function parseCgroupIoStat(content: string): CgroupIoStats {
  const devices: CgroupIoStats['devices'] = [];

  for (const line of content.split('\n')) {
    if (!line.trim()) continue;

    const parts = line.split(' ');
    if (parts.length < 2) continue;

    const device = parts[0]; // e.g., "8:0"
    const stats: Record<string, number> = {};

    for (let i = 1; i < parts.length; i++) {
      const [key, value] = parts[i].split('=');
      if (key && value) {
        stats[key] = parseInt(value, 10);
      }
    }

    devices.push({
      device,
      rbytes: stats['rbytes'] ?? 0,
      wbytes: stats['wbytes'] ?? 0,
      rios: stats['rios'] ?? 0,
      wios: stats['wios'] ?? 0,
    });
  }

  return { devices };
}

/**
 * Parse cgroup pids.current
 */
export function parseCgroupPidsCurrent(content: string): number {
  return parseInt(content.trim(), 10) || 0;
}

/**
 * Parse cgroup pids.max
 * Returns -1 for "max" (no limit)
 */
export function parseCgroupPidsMax(content: string): number {
  const trimmed = content.trim();
  if (trimmed === 'max') {
    return -1;
  }
  return parseInt(trimmed, 10) || 0;
}

/**
 * Build complete memory stats from cgroup files
 */
export function buildCgroupMemoryStats(
  current: number,
  max: number,
  stat: Record<string, number>,
  events: { oom_kill: number }
): CgroupMemoryStats {
  const maxBytes = max === -1 ? Number.MAX_SAFE_INTEGER : max;

  return {
    current_bytes: current,
    max_bytes: max,
    usage_percent: max === -1 ? 0 : (current / maxBytes) * 100,
    anon_bytes: stat['anon'] ?? 0,
    file_bytes: stat['file'] ?? 0,
    oom_kills: events.oom_kill,
  };
}

/**
 * Parse PSI format (same as /proc/pressure/*)
 * Example:
 * some avg10=0.00 avg60=0.00 avg300=0.00 total=0
 * full avg10=0.00 avg60=0.00 avg300=0.00 total=0
 */
export function parseCgroupPressure(content: string): PsiMetrics {
  const result: PsiMetrics = {
    some_avg10: 0,
    some_avg60: 0,
    some_avg300: 0,
    full_avg10: 0,
    full_avg60: 0,
    full_avg300: 0,
    some_total: 0,
    full_total: 0,
  };

  for (const line of content.split('\n')) {
    const parts = line.split(' ');
    const type = parts[0]; // 'some' or 'full'

    if (type !== 'some' && type !== 'full') continue;

    for (const part of parts.slice(1)) {
      const [key, value] = part.split('=');
      const numValue = parseFloat(value);

      if (key === 'avg10') {
        result[`${type}_avg10` as keyof PsiMetrics] = numValue;
      } else if (key === 'avg60') {
        result[`${type}_avg60` as keyof PsiMetrics] = numValue;
      } else if (key === 'avg300') {
        result[`${type}_avg300` as keyof PsiMetrics] = numValue;
      } else if (key === 'total') {
        result[`${type}_total` as keyof PsiMetrics] = numValue;
      }
    }
  }

  return result;
}

/**
 * Identify issues from cgroup stats
 */
export function identifyCgroupIssues(
  cpuStats: CgroupCpuStats,
  _cpuMax: { limitCores: number | null },
  memStats: CgroupMemoryStats,
  memPressure: PsiMetrics | null
): string[] {
  const issues: string[] = [];

  // CPU throttling
  if (cpuStats.nr_throttled > 0) {
    const throttledPercent =
      cpuStats.usage_usec > 0
        ? (cpuStats.throttled_usec / cpuStats.usage_usec) * 100
        : 0;
    if (throttledPercent > 5) {
      issues.push(
        `CPU severely throttled: ${cpuStats.nr_throttled} times, ` +
        `${throttledPercent.toFixed(1)}% of total time`
      );
    } else if (cpuStats.nr_throttled > 100) {
      issues.push(`CPU throttled ${cpuStats.nr_throttled} times`);
    }
  }

  // Memory pressure
  if (memStats.usage_percent > 90) {
    issues.push(
      `Memory at ${memStats.usage_percent.toFixed(1)}% of limit ` +
      `(${formatBytes(memStats.current_bytes)} / ${formatBytes(memStats.max_bytes)})`
    );
  } else if (memStats.usage_percent > 80) {
    issues.push(`Memory usage high: ${memStats.usage_percent.toFixed(1)}% of limit`);
  }

  // OOM kills
  if (memStats.oom_kills > 0) {
    issues.push(`OOM kills detected: ${memStats.oom_kills}`);
  }

  // PSI pressure
  if (memPressure) {
    if (memPressure.full_avg10 > 10) {
      issues.push(`Memory pressure critical: full=${memPressure.full_avg10.toFixed(1)}%`);
    } else if (memPressure.some_avg10 > 25) {
      issues.push(`Memory pressure elevated: some=${memPressure.some_avg10.toFixed(1)}%`);
    }
  }

  return issues;
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes: number): string {
  if (bytes < 0) return 'unlimited';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)}GB`;
}
