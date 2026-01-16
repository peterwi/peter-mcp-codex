/**
 * perf_cgroup_summary tool - Cgroup v2 resource usage analysis
 */

import { hostname } from 'node:os';
import { access, constants } from 'node:fs/promises';
import { getCachedCapabilities, detectCapabilities } from '../lib/detect.js';
import { safeReadFile } from '../lib/exec.js';
import { TOOL_VERSION, ErrorCode, ALLOWED_READ_PATHS } from '../lib/constants.js';
import { parseProcPidCgroup } from '../parse/procfs.js';
import {
  parseCgroupCpuStat,
  parseCgroupCpuMax,
  parseCgroupMemoryCurrent,
  parseCgroupMemoryMax,
  parseCgroupMemoryStat,
  parseCgroupMemoryEvents,
  parseCgroupIoStat,
  parseCgroupPidsCurrent,
  parseCgroupPidsMax,
  parseCgroupPressure,
  buildCgroupMemoryStats,
  identifyCgroupIssues,
} from '../parse/cgroup.js';
import type { PerfCgroupSummaryData, PerfResponse } from '../lib/schemas.js';

interface CgroupSummaryOptions {
  pid?: number;
  cgroup_path?: string;
}

/**
 * Validate that a cgroup path is safe to read
 */
function isCgroupPathSafe(path: string): boolean {
  // Must start with /sys/fs/cgroup
  if (!path.startsWith('/sys/fs/cgroup')) {
    return false;
  }

  // No path traversal
  if (path.includes('..')) {
    return false;
  }

  // Check against patterns
  for (const pattern of ALLOWED_READ_PATHS.sysfsPatterns) {
    // Test base path + common files
    const testPaths = [
      `${path}/cpu.stat`,
      `${path}/memory.current`,
      `${path}/io.stat`,
    ];
    if (testPaths.some((p) => pattern.test(p))) {
      return true;
    }
  }

  return false;
}

/**
 * Read a cgroup file if it exists
 */
async function readCgroupFile(basePath: string, filename: string): Promise<string | null> {
  const fullPath = `${basePath}/${filename}`;

  // Check if path matches allowed patterns
  const isAllowed = ALLOWED_READ_PATHS.sysfsPatterns.some((p) => p.test(fullPath));
  if (!isAllowed) {
    return null;
  }

  try {
    await access(fullPath, constants.R_OK);
    const result = await safeReadFile(fullPath);
    return result.success ? result.content : null;
  } catch {
    return null;
  }
}

export async function perfCgroupSummary(
  options: CgroupSummaryOptions = {}
): Promise<PerfResponse<PerfCgroupSummaryData>> {
  const startTime = Date.now();
  const warnings: string[] = [];
  const { pid, cgroup_path } = options;

  try {
    // Check capabilities
    let caps;
    try {
      caps = getCachedCapabilities();
    } catch {
      caps = await detectCapabilities();
    }

    if (caps.cgroupVersion !== 2) {
      warnings.push('Cgroup v1 detected - some metrics may be limited');
    }

    // Determine cgroup path
    let cgroupPath: string;

    if (cgroup_path) {
      // Use provided path
      if (!cgroup_path.startsWith('/sys/fs/cgroup')) {
        cgroupPath = `/sys/fs/cgroup${cgroup_path}`;
      } else {
        cgroupPath = cgroup_path;
      }
    } else if (pid) {
      // Find cgroup from PID
      const cgroupFile = `/proc/${pid}/cgroup`;
      const cgroupResult = await safeReadFile(cgroupFile);

      if (!cgroupResult.success) {
        return {
          success: false,
          tool: 'perf_cgroup_summary',
          tool_version: TOOL_VERSION,
          timestamp: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          host: hostname(),
          error: {
            code: ErrorCode.PID_NOT_FOUND,
            message: `Could not read cgroup for PID ${pid}`,
            recoverable: false,
            suggestion: 'Check if process exists',
          },
        };
      }

      const relativePath = parseProcPidCgroup(cgroupResult.content);
      if (!relativePath) {
        return {
          success: false,
          tool: 'perf_cgroup_summary',
          tool_version: TOOL_VERSION,
          timestamp: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          host: hostname(),
          error: {
            code: ErrorCode.CGROUP_NOT_FOUND,
            message: 'Could not parse cgroup path from /proc',
            recoverable: false,
            suggestion: 'Check cgroup configuration',
          },
        };
      }

      cgroupPath = `/sys/fs/cgroup${relativePath}`;
    } else {
      // Default to root cgroup
      cgroupPath = '/sys/fs/cgroup';
    }

    // Validate path is safe
    if (!isCgroupPathSafe(cgroupPath)) {
      return {
        success: false,
        tool: 'perf_cgroup_summary',
        tool_version: TOOL_VERSION,
        timestamp: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        host: hostname(),
        error: {
          code: ErrorCode.INVALID_PATH,
          message: 'Cgroup path not in allowed list',
          recoverable: false,
          suggestion: 'Provide a valid cgroup path under /sys/fs/cgroup',
        },
      };
    }

    // Check cgroup exists
    try {
      await access(cgroupPath, constants.R_OK);
    } catch {
      return {
        success: false,
        tool: 'perf_cgroup_summary',
        tool_version: TOOL_VERSION,
        timestamp: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        host: hostname(),
        error: {
          code: ErrorCode.CGROUP_NOT_FOUND,
          message: `Cgroup path not found: ${cgroupPath}`,
          recoverable: false,
          suggestion: 'Check if cgroup exists',
        },
      };
    }

    // Read CPU stats
    const cpuStatContent = await readCgroupFile(cgroupPath, 'cpu.stat');
    const cpuMaxContent = await readCgroupFile(cgroupPath, 'cpu.max');
    const cpuPressureContent = await readCgroupFile(cgroupPath, 'cpu.pressure');

    const cpuStats = cpuStatContent
      ? parseCgroupCpuStat(cpuStatContent)
      : { usage_usec: 0, user_usec: 0, system_usec: 0, nr_throttled: 0, throttled_usec: 0 };

    const cpuMax = cpuMaxContent ? parseCgroupCpuMax(cpuMaxContent) : { quotaUsec: -1, periodUsec: 100000, limitCores: null };
    const cpuPressure = cpuPressureContent ? parseCgroupPressure(cpuPressureContent) : null;

    // Read memory stats
    const memCurrentContent = await readCgroupFile(cgroupPath, 'memory.current');
    const memMaxContent = await readCgroupFile(cgroupPath, 'memory.max');
    const memStatContent = await readCgroupFile(cgroupPath, 'memory.stat');
    const memEventsContent = await readCgroupFile(cgroupPath, 'memory.events');
    const memPressureContent = await readCgroupFile(cgroupPath, 'memory.pressure');

    const memCurrent = memCurrentContent ? parseCgroupMemoryCurrent(memCurrentContent) : 0;
    const memMax = memMaxContent ? parseCgroupMemoryMax(memMaxContent) : -1;
    const memStat = memStatContent ? parseCgroupMemoryStat(memStatContent) : {};
    const memEvents = memEventsContent
      ? parseCgroupMemoryEvents(memEventsContent)
      : { low: 0, high: 0, max: 0, oom: 0, oom_kill: 0 };
    const memPressure = memPressureContent ? parseCgroupPressure(memPressureContent) : null;

    const memStats = buildCgroupMemoryStats(memCurrent, memMax, memStat, memEvents);

    // Read I/O stats
    const ioStatContent = await readCgroupFile(cgroupPath, 'io.stat');
    const ioPressureContent = await readCgroupFile(cgroupPath, 'io.pressure');

    const ioStats = ioStatContent ? parseCgroupIoStat(ioStatContent) : { devices: [] };
    const ioPressure = ioPressureContent ? parseCgroupPressure(ioPressureContent) : null;

    // Read PIDs stats
    const pidsCurrentContent = await readCgroupFile(cgroupPath, 'pids.current');
    const pidsMaxContent = await readCgroupFile(cgroupPath, 'pids.max');

    const pidsCurrent = pidsCurrentContent ? parseCgroupPidsCurrent(pidsCurrentContent) : 0;
    const pidsMax = pidsMaxContent ? parseCgroupPidsMax(pidsMaxContent) : -1;

    // Identify issues
    const issues = identifyCgroupIssues(cpuStats, cpuMax, memStats, memPressure);

    const data: PerfCgroupSummaryData = {
      cgroup_path: cgroupPath,
      cpu: {
        ...cpuStats,
        limit_cores: cpuMax.limitCores ?? undefined,
        pressure: cpuPressure ?? undefined,
      },
      memory: {
        ...memStats,
        pressure: memPressure ?? undefined,
      },
      io: {
        ...ioStats,
        pressure: ioPressure ?? undefined,
      },
      pids: {
        current: pidsCurrent,
        max: pidsMax,
      },
      issues,
    };

    return {
      success: true,
      tool: 'perf_cgroup_summary',
      tool_version: TOOL_VERSION,
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      host: hostname(),
      data,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (err) {
    const error = err as Error;
    return {
      success: false,
      tool: 'perf_cgroup_summary',
      tool_version: TOOL_VERSION,
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      host: hostname(),
      error: {
        code: 'EXECUTION_FAILED',
        message: error.message,
        recoverable: true,
        suggestion: 'Check cgroup path and permissions',
      },
    };
  }
}
