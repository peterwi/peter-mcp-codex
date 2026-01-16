/**
 * perf_info tool - System information and capability detection
 */

import { hostname } from 'node:os';
import { detectCapabilities } from '../lib/detect.js';
import { safeReadFile } from '../lib/exec.js';
import { TOOL_VERSION } from '../lib/constants.js';
import { parseProcCpuinfo, parseProcMeminfo, parseProcUptime } from '../parse/procfs.js';
import type { PerfInfoData, PerfResponse } from '../lib/schemas.js';

export async function perfInfo(): Promise<PerfResponse<PerfInfoData>> {
  const startTime = Date.now();
  const warnings: string[] = [];

  try {
    // Get cached capabilities (or detect if not cached)
    const caps = await detectCapabilities();

    // Read additional system info
    const [_versionResult, cpuinfoResult, meminfoResult, uptimeResult] = await Promise.all([
      safeReadFile('/proc/version'),
      safeReadFile('/proc/cpuinfo'),
      safeReadFile('/proc/meminfo'),
      safeReadFile('/proc/uptime'),
    ]);

    // Parse CPU info
    let cpuModel = 'Unknown';
    let cpuCores = caps.cpuCount;
    let cpuThreads = caps.cpuCount;

    if (cpuinfoResult.success) {
      const parsed = parseProcCpuinfo(cpuinfoResult.content);
      cpuModel = parsed.model;
      cpuCores = parsed.cores;
      cpuThreads = parsed.threads;
    }

    // Parse memory info
    let totalMemory = 0;
    if (meminfoResult.success) {
      const parsed = parseProcMeminfo(meminfoResult.content);
      totalMemory = parsed.total_bytes;
    }

    // Parse uptime
    let uptimeSeconds = 0;
    if (uptimeResult.success) {
      const parsed = parseProcUptime(uptimeResult.content);
      uptimeSeconds = parsed.uptimeSeconds;
    }

    // Calculate boot time
    const bootTime = new Date(Date.now() - uptimeSeconds * 1000).toISOString();

    // Try to get scaling governor
    let scalingGovernor = 'unknown';
    try {
      const governorResult = await safeReadFile(
        '/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor'
      );
      if (governorResult.success) {
        scalingGovernor = governorResult.content.trim();
      }
    } catch {
      // Scaling governor may not be available
    }

    // Check for huge pages
    let thpEnabled = false;
    try {
      const thpResult = await safeReadFile('/sys/kernel/mm/transparent_hugepage/enabled');
      if (thpResult.success) {
        thpEnabled = thpResult.content.includes('[always]') ||
                     thpResult.content.includes('[madvise]');
      }
    } catch {
      // THP may not be available
    }

    // Add warnings for missing capabilities
    if (!caps.hasPerf) {
      warnings.push('perf tool not installed - profiling unavailable');
    } else if (!caps.canUsePerf) {
      warnings.push(
        `perf access restricted (paranoid=${caps.perfEventParanoid}) - run as root or adjust setting`
      );
    }

    if (!caps.hasPsi) {
      warnings.push('PSI not enabled - pressure metrics unavailable');
    }

    if (!caps.hasBtf) {
      warnings.push('BTF not available - some eBPF features limited');
    }

    if (!caps.hasBcc) {
      warnings.push('BCC tools not installed - advanced eBPF analysis unavailable');
    } else if (!caps.canUseBpf) {
      warnings.push('BCC available but requires root - run as root for eBPF analysis');
    }

    // Count available BCC tools
    const bccToolsAvailable = Object.values(caps.bccTools).filter(Boolean).length;
    const bccToolsTotal = Object.keys(caps.bccTools).length;

    const data: PerfInfoData = {
      system: {
        hostname: hostname(),
        kernel: caps.kernelVersion,
        arch: process.arch,
        uptime_seconds: Math.floor(uptimeSeconds),
        boot_time: bootTime,
      },
      cpu: {
        model: cpuModel,
        cores: cpuCores,
        threads: cpuThreads,
        numa_nodes: caps.numaNodes,
        scaling_governor: scalingGovernor,
      },
      virtualization: {
        type: caps.virtualization,
        container: caps.isContainer,
        cgroup_version: caps.cgroupVersion,
      },
      capabilities: {
        perf_available: caps.hasPerf,
        perf_permitted: caps.canUsePerf,
        bpf_available: caps.hasBpftool || caps.hasBpftrace || caps.hasBcc,
        bpf_permitted: caps.canUseBpf,
        btf_available: caps.hasBtf,
        psi_enabled: caps.hasPsi,
      },
      ebpf: caps.hasBcc ? {
        bcc_installed: caps.hasBcc,
        bcc_tools_available: bccToolsAvailable,
        bcc_tools_total: bccToolsTotal,
        available_tools: Object.entries(caps.bccTools)
          .filter(([_, available]) => available)
          .map(([name]) => name),
        unavailable_tools: Object.entries(caps.bccTools)
          .filter(([_, available]) => !available)
          .map(([name]) => name),
      } : undefined,
      memory: {
        total_bytes: totalMemory,
        huge_pages_enabled: false, // Would need to check /proc/meminfo for HugePages
        thp_enabled: thpEnabled,
      },
    };

    return {
      success: true,
      tool: 'perf_info',
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
      tool: 'perf_info',
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
