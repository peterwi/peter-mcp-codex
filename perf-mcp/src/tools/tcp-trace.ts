/**
 * perf_tcp_trace tool
 * TCP connection tracing using BCC tcplife/tcpconnect
 * Shows TCP connection lifecycle and latency
 */

import { z } from 'zod';
import { DURATION_LIMITS, TIMEOUTS, TOOL_VERSION, ErrorCode } from '../lib/constants.js';
import { safeExec } from '../lib/exec.js';
import { detectCapabilities } from '../lib/detect.js';
import { parseTcpLife, parseTcpConnect } from '../parse/bcc.js';
import type { PerfResponse } from '../lib/schemas.js';

export const TcpTraceInputSchema = z.object({
  duration_seconds: z
    .number()
    .min(DURATION_LIMITS.MIN)
    .max(30)
    .default(DURATION_LIMITS.DEFAULT)
    .describe('Duration in seconds (1-30)'),
  mode: z
    .enum(['connections', 'lifecycle'])
    .default('lifecycle')
    .describe('connections=new connections only, lifecycle=full connection lifecycle'),
  pid: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Filter by process ID'),
  port: z
    .number()
    .int()
    .min(1)
    .max(65535)
    .optional()
    .describe('Filter by destination port'),
  local_port: z
    .number()
    .int()
    .min(1)
    .max(65535)
    .optional()
    .describe('Filter by local port'),
});

export type TcpTraceInput = z.infer<typeof TcpTraceInputSchema>;
export type TcpTraceRawInput = z.input<typeof TcpTraceInputSchema>;

export interface TcpTraceData {
  method: 'bcc_tcplife' | 'bcc_tcpconnect';
  duration_seconds: number;
  mode: 'connections' | 'lifecycle';
  connections: Array<{
    pid: number;
    comm: string;
    local_addr: string;
    local_port: number;
    remote_addr: string;
    remote_port: number;
    tx_kb?: number;
    rx_kb?: number;
    duration_ms?: number;
    latency_us?: number;
  }>;
  summary: {
    total_connections: number;
    total_tx_kb?: number;
    total_rx_kb?: number;
    avg_duration_ms?: number;
    avg_latency_us?: number;
    by_port: Array<{ port: number; count: number }>;
    by_comm: Array<{ comm: string; count: number }>;
  };
  top_connections: Array<{
    pid: number;
    comm: string;
    remote_addr: string;
    remote_port: number;
    metric: number;
    metric_type: 'duration_ms' | 'traffic_kb' | 'latency_us';
  }>;
  notes: string[];
}

export async function perfTcpTrace(
  input: TcpTraceRawInput = {}
): Promise<PerfResponse<TcpTraceData>> {
  const startTime = Date.now();

  try {
    const params = TcpTraceInputSchema.parse(input);
    const caps = await detectCapabilities();

    // Check which tool to use
    const canUseTcplife = caps.canUseBpf && caps.bccTools.tcplife;
    const canUseTcpconnect = caps.canUseBpf && caps.bccTools.tcpconnect;

    // Prefer tcplife for lifecycle mode, tcpconnect for connections mode
    const useLifecycle = params.mode === 'lifecycle' && canUseTcplife;
    const useConnect = params.mode === 'connections' && canUseTcpconnect;

    if (!useLifecycle && !useConnect) {
      // Fall back to whatever is available
      if (!canUseTcplife && !canUseTcpconnect) {
        return {
          success: false,
          tool: 'perf_tcp_trace',
          tool_version: TOOL_VERSION,
          timestamp: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          host: process.env.HOSTNAME || 'unknown',
          error: {
            code: ErrorCode.CAPABILITY_MISSING,
            message: 'TCP tracing requires BCC tcplife or tcpconnect tools',
            recoverable: true,
            suggestion: 'Install bcc-tools package and run as root. Use perf_net_health for basic network stats.',
          },
        };
      }
    }

    const notes: string[] = [];
    const useTcplife = useLifecycle || (params.mode === 'connections' && !canUseTcpconnect && canUseTcplife);

    if (useTcplife) {
      return await runTcplife(params, startTime, notes);
    } else {
      return await runTcpconnect(params, startTime, notes);
    }
  } catch (error) {
    return {
      success: false,
      tool: 'perf_tcp_trace',
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

async function runTcplife(
  params: TcpTraceInput,
  startTime: number,
  notes: string[]
): Promise<PerfResponse<TcpTraceData>> {
  const args: string[] = ['-T']; // Include timestamps

  if (params.pid) {
    args.push('-p', String(params.pid));
  }

  if (params.port) {
    args.push('-D', String(params.port)); // Destination port filter
  }

  if (params.local_port) {
    args.push('-L', String(params.local_port)); // Local port filter
  }

  const timeout = (params.duration_seconds * 1000) + TIMEOUTS.DEFAULT;

  // tcplife runs until interrupted, so we need to use timeout
  const result = await safeExec('tcplife', args, { timeout });

  // tcplife may exit with error when timeout kills it, check stdout
  if (!result.stdout && !result.success) {
    return {
      success: false,
      tool: 'perf_tcp_trace',
      tool_version: TOOL_VERSION,
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      host: process.env.HOSTNAME || 'unknown',
      error: {
        code: result.error?.code || ErrorCode.EXECUTION_FAILED,
        message: result.error?.message || 'tcplife execution failed',
        recoverable: true,
        suggestion: result.error?.suggestion,
      },
    };
  }

  // Parse output
  const parsed = parseTcpLife(result.stdout);

  // Generate analysis notes
  if (parsed.avgDurationMs > 5000) {
    notes.push(`Long-lived connections detected: avg duration ${(parsed.avgDurationMs / 1000).toFixed(1)}s`);
  }

  const highTrafficConns = parsed.connections.filter((c) => (c.txKb + c.rxKb) > 1024);
  if (highTrafficConns.length > 0) {
    notes.push(`${highTrafficConns.length} connections transferred >1MB`);
  }

  // Build port summary
  const byPort = new Map<number, number>();
  const byComm = new Map<string, number>();
  for (const conn of parsed.connections) {
    byPort.set(conn.remotePort, (byPort.get(conn.remotePort) || 0) + 1);
    byComm.set(conn.comm, (byComm.get(conn.comm) || 0) + 1);
  }

  return {
    success: true,
    tool: 'perf_tcp_trace',
    tool_version: TOOL_VERSION,
    timestamp: new Date().toISOString(),
    duration_ms: Date.now() - startTime,
    host: process.env.HOSTNAME || 'unknown',
    data: {
      method: 'bcc_tcplife',
      duration_seconds: params.duration_seconds,
      mode: 'lifecycle',
      connections: parsed.connections.slice(0, 100).map((c) => ({
        pid: c.pid,
        comm: c.comm,
        local_addr: c.localAddr,
        local_port: c.localPort,
        remote_addr: c.remoteAddr,
        remote_port: c.remotePort,
        tx_kb: c.txKb,
        rx_kb: c.rxKb,
        duration_ms: c.durationMs,
      })),
      summary: {
        total_connections: parsed.totalConnections,
        total_tx_kb: parsed.totalTxKb,
        total_rx_kb: parsed.totalRxKb,
        avg_duration_ms: parsed.avgDurationMs,
        by_port: Array.from(byPort.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([port, count]) => ({ port, count })),
        by_comm: Array.from(byComm.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([comm, count]) => ({ comm, count })),
      },
      top_connections: parsed.topByDuration.slice(0, 5).map((c) => ({
        pid: c.pid,
        comm: c.comm,
        remote_addr: c.remoteAddr,
        remote_port: c.remotePort,
        metric: c.durationMs,
        metric_type: 'duration_ms' as const,
      })),
      notes,
    },
  };
}

async function runTcpconnect(
  params: TcpTraceInput,
  startTime: number,
  notes: string[]
): Promise<PerfResponse<TcpTraceData>> {
  const args: string[] = ['-t']; // Include timestamps

  if (params.pid) {
    args.push('-p', String(params.pid));
  }

  if (params.port) {
    args.push('-P', String(params.port)); // Port filter
  }

  const timeout = (params.duration_seconds * 1000) + TIMEOUTS.DEFAULT;

  const result = await safeExec('tcpconnect', args, { timeout });

  // tcpconnect may exit with error when timeout kills it
  if (!result.stdout && !result.success) {
    return {
      success: false,
      tool: 'perf_tcp_trace',
      tool_version: TOOL_VERSION,
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      host: process.env.HOSTNAME || 'unknown',
      error: {
        code: result.error?.code || ErrorCode.EXECUTION_FAILED,
        message: result.error?.message || 'tcpconnect execution failed',
        recoverable: true,
        suggestion: result.error?.suggestion,
      },
    };
  }

  // Parse output
  const parsed = parseTcpConnect(result.stdout);

  // Generate analysis notes
  const connectionRate = parsed.totalAttempts / params.duration_seconds;
  if (connectionRate > 100) {
    notes.push(`High connection rate: ${connectionRate.toFixed(0)} connections/sec`);
  }

  // Check for common patterns
  const httpPorts = [80, 443, 8080, 8443];
  const httpCount = httpPorts.reduce((sum, p) => sum + (parsed.byPort[p] || 0), 0);
  if (httpCount > 0) {
    notes.push(`HTTP/HTTPS connections: ${httpCount}`);
  }

  const dbPorts = [3306, 5432, 6379, 27017];
  const dbCount = dbPorts.reduce((sum, p) => sum + (parsed.byPort[p] || 0), 0);
  if (dbCount > 0) {
    notes.push(`Database connections: ${dbCount}`);
  }

  return {
    success: true,
    tool: 'perf_tcp_trace',
    tool_version: TOOL_VERSION,
    timestamp: new Date().toISOString(),
    duration_ms: Date.now() - startTime,
    host: process.env.HOSTNAME || 'unknown',
    data: {
      method: 'bcc_tcpconnect',
      duration_seconds: params.duration_seconds,
      mode: 'connections',
      connections: parsed.connections.slice(0, 100).map((c) => ({
        pid: c.pid,
        comm: c.comm,
        local_addr: c.sourceAddr,
        local_port: 0, // Not available in tcpconnect
        remote_addr: c.destAddr,
        remote_port: c.destPort,
        latency_us: c.latencyUs,
      })),
      summary: {
        total_connections: parsed.totalAttempts,
        avg_latency_us: parsed.avgLatencyUs,
        by_port: Object.entries(parsed.byPort)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([port, count]) => ({ port: parseInt(port, 10), count })),
        by_comm: Object.entries(parsed.byComm)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([comm, count]) => ({ comm, count })),
      },
      top_connections: parsed.connections
        .filter((c) => c.latencyUs !== undefined)
        .sort((a, b) => (b.latencyUs || 0) - (a.latencyUs || 0))
        .slice(0, 5)
        .map((c) => ({
          pid: c.pid,
          comm: c.comm,
          remote_addr: c.destAddr,
          remote_port: c.destPort,
          metric: c.latencyUs || 0,
          metric_type: 'latency_us' as const,
        })),
      notes,
    },
  };
}
