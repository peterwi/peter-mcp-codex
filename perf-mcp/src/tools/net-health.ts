/**
 * perf_net_health tool - Network stack health summary
 */

import { hostname } from 'node:os';
import { getCachedCapabilities, detectCapabilities } from '../lib/detect.js';
import { safeExec, safeReadFile, isExecError } from '../lib/exec.js';
import { TOOL_VERSION } from '../lib/constants.js';
import { parseProcNetDev, parseProcNetSnmp } from '../parse/procfs.js';
import { parseSsSummary } from '../parse/ss.js';
import type { PerfNetHealthData, PerfResponse, NetworkInterfaceStats } from '../lib/schemas.js';

interface NetHealthOptions {
  interface?: string;
  include_tcp_details?: boolean;
}

export async function perfNetHealth(
  options: NetHealthOptions = {}
): Promise<PerfResponse<PerfNetHealthData>> {
  const startTime = Date.now();
  const warnings: string[] = [];
  const { interface: filterInterface, include_tcp_details: _include_tcp_details = true } = options;

  try {
    // Check capabilities
    let caps;
    try {
      caps = getCachedCapabilities();
    } catch {
      caps = await detectCapabilities();
    }

    // Read network interface stats
    const netdevResult = await safeReadFile('/proc/net/dev');
    let interfaces: NetworkInterfaceStats[] = [];

    if (netdevResult.success) {
      interfaces = parseProcNetDev(netdevResult.content);
    } else {
      warnings.push('Could not read /proc/net/dev');
    }

    // Filter by interface if specified
    if (filterInterface) {
      interfaces = interfaces.filter(
        (iface) =>
          iface.name === filterInterface || iface.name.startsWith(filterInterface)
      );
    }

    // Read TCP/IP statistics
    const snmpResult = await safeReadFile('/proc/net/snmp');
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

    // Calculate retransmit rate
    const retransmitRate =
      tcpStats.out_segs > 0 ? (tcpStats.retransmits / tcpStats.out_segs) * 100 : 0;

    // Get socket summary using ss
    let socketSummary = {
      tcp_total: 0,
      tcp_established: 0,
      tcp_time_wait: 0,
      udp_total: 0,
    };

    if (caps.hasSs) {
      const ssResult = await safeExec('ss', ['-s']);
      if (!isExecError(ssResult) && ssResult.success) {
        const summary = parseSsSummary(ssResult.stdout);
        socketSummary = {
          tcp_total: summary.tcp_total,
          tcp_established: summary.tcp_established,
          tcp_time_wait: summary.tcp_time_wait,
          udp_total: summary.udp_total,
        };
      }
    }

    // Read netstat for additional TCP stats
    const netstatResult = await safeReadFile('/proc/net/netstat');
    let resetRate = 0;

    if (netstatResult.success) {
      // Parse TcpExt stats for resets
      const lines = netstatResult.content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('TcpExt:') && lines[i + 1]?.startsWith('TcpExt:')) {
          const headers = lines[i].split(/\s+/).slice(1);
          const values = lines[i + 1].split(/\s+/).slice(1).map(Number);

          const tcpAbortOnDataIdx = headers.indexOf('TCPAbortOnData');
          const tcpAbortOnCloseIdx = headers.indexOf('TCPAbortOnClose');

          if (tcpAbortOnDataIdx >= 0) {
            resetRate += values[tcpAbortOnDataIdx] ?? 0;
          }
          if (tcpAbortOnCloseIdx >= 0) {
            resetRate += values[tcpAbortOnCloseIdx] ?? 0;
          }
          break;
        }
      }
    }

    // Identify issues
    const issues: string[] = [];

    // Check for drops
    const totalDrops = interfaces.reduce(
      (sum, iface) => sum + iface.rx_dropped + iface.tx_dropped,
      0
    );
    if (totalDrops > 0) {
      const dropDetails = interfaces
        .filter((i) => i.rx_dropped + i.tx_dropped > 0)
        .map((i) => `${i.name}: rx=${i.rx_dropped}, tx=${i.tx_dropped}`)
        .join('; ');
      issues.push(`Packet drops detected: ${dropDetails}`);
    }

    // Check for errors
    const totalErrors = interfaces.reduce(
      (sum, iface) => sum + iface.rx_errors + iface.tx_errors,
      0
    );
    if (totalErrors > 0) {
      issues.push(`Interface errors: ${totalErrors} total`);
    }

    // Check retransmit rate
    if (retransmitRate > 1) {
      issues.push(`High TCP retransmit rate: ${retransmitRate.toFixed(2)}%`);
    } else if (retransmitRate > 0.1) {
      issues.push(`Elevated TCP retransmit rate: ${retransmitRate.toFixed(2)}%`);
    }

    // Check TIME_WAIT
    if (socketSummary.tcp_time_wait > 1000) {
      issues.push(`High TIME_WAIT count: ${socketSummary.tcp_time_wait}`);
    }

    // Enhance interfaces with additional info (speed would require ethtool)
    const enhancedInterfaces = interfaces.map((iface) => ({
      ...iface,
      speed_mbps: undefined as number | undefined, // Would need ethtool
      duplex: undefined as string | undefined,
    }));

    const data: PerfNetHealthData = {
      interfaces: enhancedInterfaces,
      tcp: {
        ...tcpStats,
        retransmit_rate: retransmitRate,
        reset_rate: resetRate,
      },
      socket_summary: socketSummary,
      issues,
    };

    return {
      success: true,
      tool: 'perf_net_health',
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
      tool: 'perf_net_health',
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
