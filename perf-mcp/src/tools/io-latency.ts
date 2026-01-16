/**
 * perf_io_latency tool - Block I/O latency analysis
 */

import { hostname } from 'node:os';
import { getCachedCapabilities, detectCapabilities } from '../lib/detect.js';
import { safeExec, isExecError } from '../lib/exec.js';
import { TOOL_VERSION, ErrorCode } from '../lib/constants.js';
import { parseIostat } from '../parse/iostat.js';
import type { PerfIoLatencyData, PerfResponse, IoDeviceStats } from '../lib/schemas.js';

interface IoLatencyOptions {
  duration_seconds?: number;
  device?: string;
  mode?: 'snapshot' | 'trace';
}

export async function perfIoLatency(
  options: IoLatencyOptions = {}
): Promise<PerfResponse<PerfIoLatencyData>> {
  const startTime = Date.now();
  const warnings: string[] = [];
  const { duration_seconds = 5, device, mode = 'snapshot' } = options;

  try {
    // Check capabilities
    let caps;
    try {
      caps = getCachedCapabilities();
    } catch {
      caps = await detectCapabilities();
    }

    if (!caps.hasIostat && mode === 'snapshot') {
      return {
        success: false,
        tool: 'perf_io_latency',
        tool_version: TOOL_VERSION,
        timestamp: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        host: hostname(),
        error: {
          code: ErrorCode.TOOL_NOT_FOUND,
          message: 'iostat not installed',
          recoverable: false,
          suggestion: 'Install sysstat package',
        },
      };
    }

    let devices: IoDeviceStats[] = [];
    const notes: string[] = [];

    if (mode === 'snapshot') {
      // Use iostat for snapshot mode
      // Run iostat twice with interval to get rate data
      const iostatArgs = ['-xz', '-d', '1', String(duration_seconds + 1)];
      const timeout = (duration_seconds + 5) * 1000;

      const result = await safeExec('iostat', iostatArgs, { timeout });

      if (isExecError(result)) {
        return {
          success: false,
          tool: 'perf_io_latency',
          tool_version: TOOL_VERSION,
          timestamp: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          host: hostname(),
          error: {
            code: result.code,
            message: result.message,
            recoverable: result.recoverable,
            suggestion: result.suggestion,
          },
        };
      }

      // Parse iostat output - get the last set of device stats
      const output = result.stdout;
      const sections = output.split(/\n\s*\n/);
      const lastSection = sections.filter((s) => s.includes('Device')).pop() ?? '';

      devices = parseIostat(lastSection);

      // Filter by device if specified
      if (device) {
        devices = devices.filter(
          (d) => d.name === device || d.name.includes(device)
        );
        if (devices.length === 0) {
          return {
            success: false,
            tool: 'perf_io_latency',
            tool_version: TOOL_VERSION,
            timestamp: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
            host: hostname(),
            error: {
              code: ErrorCode.DEVICE_NOT_FOUND,
              message: `Device '${device}' not found`,
              recoverable: false,
              suggestion: 'Check device name with lsblk',
            },
          };
        }
      }

      // Generate notes based on findings
      for (const dev of devices) {
        if (dev.utilization > 80) {
          notes.push(`${dev.name}: High utilization (${dev.utilization.toFixed(1)}%)`);
        }
        if (dev.avg_wait_ms > 20) {
          notes.push(`${dev.name}: High latency (${dev.avg_wait_ms.toFixed(1)}ms)`);
        }
        if (dev.avg_queue_size > 4) {
          notes.push(`${dev.name}: High queue depth (${dev.avg_queue_size.toFixed(2)})`);
        }
      }
    } else {
      // Trace mode - use perf if available
      if (!caps.hasPerf || !caps.canUsePerf) {
        return {
          success: false,
          tool: 'perf_io_latency',
          tool_version: TOOL_VERSION,
          timestamp: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          host: hostname(),
          error: {
            code: ErrorCode.PERMISSION_DENIED,
            message: 'perf not available for trace mode',
            recoverable: true,
            suggestion: 'Use snapshot mode or run with elevated permissions',
          },
        };
      }

      warnings.push('Trace mode not fully implemented - using snapshot fallback');

      // Fallback to iostat even in trace mode for now
      const iostatArgs = ['-xz', '-d', '1', String(duration_seconds + 1)];
      const timeout = (duration_seconds + 5) * 1000;
      const result = await safeExec('iostat', iostatArgs, { timeout });

      if (!isExecError(result) && result.success) {
        const output = result.stdout;
        const sections = output.split(/\n\s*\n/);
        const lastSection = sections.filter((s) => s.includes('Device')).pop() ?? '';
        devices = parseIostat(lastSection);
      }

      notes.push('Trace mode provides latency histogram - currently showing iostat data');
    }

    // Sort devices by utilization
    devices.sort((a, b) => b.utilization - a.utilization);

    const data: PerfIoLatencyData = {
      mode,
      duration_seconds,
      devices,
      notes,
    };

    return {
      success: true,
      tool: 'perf_io_latency',
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
      tool: 'perf_io_latency',
      tool_version: TOOL_VERSION,
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      host: hostname(),
      error: {
        code: 'EXECUTION_FAILED',
        message: error.message,
        recoverable: true,
        suggestion: 'Check system permissions and iostat/perf availability',
      },
    };
  }
}
