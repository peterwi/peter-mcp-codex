/**
 * Parsers for BCC (BPF Compiler Collection) tool outputs
 * These tools provide deep eBPF-based analysis
 */

/**
 * Parse offcputime output (folded stack format)
 * Format: stack;stack;func count
 * Example:
 *   do_nanosleep;__x64_sys_nanosleep;do_syscall_64;entry_SYSCALL_64_after_hwframe 1234567
 */
export interface OffCpuEntry {
  stack: string[];
  function: string;
  totalUs: number;
  count?: number;
}

export interface OffCpuResult {
  entries: OffCpuEntry[];
  totalBlockedUs: number;
  topFunctions: Array<{ function: string; totalUs: number; percent: number }>;
}

export function parseOffcputime(output: string): OffCpuResult {
  const lines = output.trim().split('\n').filter((l) => l.trim());
  const entries: OffCpuEntry[] = [];
  let totalBlockedUs = 0;

  // Function aggregation
  const functionTotals = new Map<string, number>();

  for (const line of lines) {
    // Skip headers and empty lines
    if (!line || line.startsWith('#') || line.startsWith('Tracing')) continue;

    // Format: stack;stack;func count
    const lastSpaceIdx = line.lastIndexOf(' ');
    if (lastSpaceIdx === -1) continue;

    const stackStr = line.substring(0, lastSpaceIdx).trim();
    const countStr = line.substring(lastSpaceIdx + 1).trim();
    const count = parseInt(countStr, 10);

    if (isNaN(count) || !stackStr) continue;

    const stack = stackStr.split(';').filter((s) => s);
    const func = stack[stack.length - 1] || 'unknown';

    entries.push({
      stack,
      function: func,
      totalUs: count,
    });

    totalBlockedUs += count;
    functionTotals.set(func, (functionTotals.get(func) || 0) + count);
  }

  // Sort by total blocked time
  const topFunctions = Array.from(functionTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([func, totalUs]) => ({
      function: func,
      totalUs,
      percent: totalBlockedUs > 0 ? (totalUs / totalBlockedUs) * 100 : 0,
    }));

  return { entries, totalBlockedUs, topFunctions };
}

/**
 * Parse biolatency histogram output
 * Example:
 *   usecs               : count     distribution
 *       0 -> 1          : 0        |                                        |
 *       2 -> 3          : 0        |                                        |
 *       4 -> 7          : 12       |**                                      |
 *       8 -> 15         : 45       |********                                |
 */
export interface LatencyBucket {
  rangeStart: number;
  rangeEnd: number;
  count: number;
  unit: 'usecs' | 'msecs' | 'nsecs';
}

export interface BiolatencyResult {
  buckets: LatencyBucket[];
  totalOps: number;
  avgLatencyUs: number;
  p50Us: number;
  p99Us: number;
  maxLatencyUs: number;
  perDevice?: Record<string, LatencyBucket[]>;
}

export function parseBiolatency(output: string): BiolatencyResult {
  const lines = output.trim().split('\n');
  const buckets: LatencyBucket[] = [];
  let unit: 'usecs' | 'msecs' | 'nsecs' = 'usecs';
  let totalOps = 0;
  let weightedSum = 0;
  let currentDevice: string | null = null;
  const perDevice: Record<string, LatencyBucket[]> = {};

  for (const line of lines) {
    // Detect unit from header
    if (line.includes('usecs')) unit = 'usecs';
    else if (line.includes('msecs')) unit = 'msecs';
    else if (line.includes('nsecs')) unit = 'nsecs';

    // Detect device header (for -D flag output)
    const deviceMatch = line.match(/^disk\s*=\s*'?(\w+)'?/i);
    if (deviceMatch) {
      currentDevice = deviceMatch[1];
      if (!perDevice[currentDevice]) {
        perDevice[currentDevice] = [];
      }
      continue;
    }

    // Parse histogram bucket
    // Format: "   8 -> 15         : 45       |********"
    const bucketMatch = line.match(/^\s*(\d+)\s*->\s*(\d+)\s*:\s*(\d+)/);
    if (bucketMatch) {
      const rangeStart = parseInt(bucketMatch[1], 10);
      const rangeEnd = parseInt(bucketMatch[2], 10);
      const count = parseInt(bucketMatch[3], 10);

      const bucket: LatencyBucket = { rangeStart, rangeEnd, count, unit };
      buckets.push(bucket);

      if (currentDevice) {
        perDevice[currentDevice].push(bucket);
      }

      totalOps += count;
      // Use midpoint for weighted average
      weightedSum += ((rangeStart + rangeEnd) / 2) * count;
    }
  }

  // Calculate percentiles
  const avgLatencyUs = totalOps > 0 ? weightedSum / totalOps : 0;
  let p50Us = 0;
  let p99Us = 0;
  let maxLatencyUs = 0;

  if (buckets.length > 0) {
    const p50Target = totalOps * 0.5;
    const p99Target = totalOps * 0.99;
    let cumulative = 0;

    for (const bucket of buckets) {
      cumulative += bucket.count;
      const midpoint = (bucket.rangeStart + bucket.rangeEnd) / 2;

      if (p50Us === 0 && cumulative >= p50Target) {
        p50Us = midpoint;
      }
      if (p99Us === 0 && cumulative >= p99Target) {
        p99Us = midpoint;
      }
      if (bucket.count > 0) {
        maxLatencyUs = bucket.rangeEnd;
      }
    }
  }

  // Convert to microseconds if needed
  const multiplier = unit === 'msecs' ? 1000 : unit === 'nsecs' ? 0.001 : 1;

  return {
    buckets,
    totalOps,
    avgLatencyUs: avgLatencyUs * multiplier,
    p50Us: p50Us * multiplier,
    p99Us: p99Us * multiplier,
    maxLatencyUs: maxLatencyUs * multiplier,
    perDevice: Object.keys(perDevice).length > 0 ? perDevice : undefined,
  };
}

/**
 * Parse runqlat (run queue latency) histogram output
 * Similar format to biolatency
 */
export interface RunqlatResult {
  buckets: LatencyBucket[];
  totalWakeups: number;
  avgLatencyUs: number;
  p50Us: number;
  p99Us: number;
  maxLatencyUs: number;
}

export function parseRunqlat(output: string): RunqlatResult {
  // Reuse biolatency parser as format is identical
  const result = parseBiolatency(output);
  return {
    buckets: result.buckets,
    totalWakeups: result.totalOps,
    avgLatencyUs: result.avgLatencyUs,
    p50Us: result.p50Us,
    p99Us: result.p99Us,
    maxLatencyUs: result.maxLatencyUs,
  };
}

/**
 * Parse tcplife output
 * Example:
 *   PID    COMM         LADDR           LPORT  RADDR           RPORT  TX_KB  RX_KB  MS
 *   12345  curl         10.0.0.1        54321  93.184.216.34   80     1      15     234.56
 */
export interface TcpLifeEntry {
  pid: number;
  comm: string;
  localAddr: string;
  localPort: number;
  remoteAddr: string;
  remotePort: number;
  txKb: number;
  rxKb: number;
  durationMs: number;
}

export interface TcpLifeResult {
  connections: TcpLifeEntry[];
  totalConnections: number;
  totalTxKb: number;
  totalRxKb: number;
  avgDurationMs: number;
  topByDuration: TcpLifeEntry[];
  topByTraffic: TcpLifeEntry[];
}

export function parseTcpLife(output: string): TcpLifeResult {
  const lines = output.trim().split('\n');
  const connections: TcpLifeEntry[] = [];
  let totalTxKb = 0;
  let totalRxKb = 0;
  let totalDurationMs = 0;

  for (const line of lines) {
    // Skip header and tracing messages
    if (line.startsWith('PID') || line.startsWith('Tracing') || !line.trim()) continue;

    // Parse: PID COMM LADDR LPORT RADDR RPORT TX_KB RX_KB MS
    const parts = line.trim().split(/\s+/);
    if (parts.length < 9) continue;

    const pid = parseInt(parts[0], 10);
    const comm = parts[1];
    const localAddr = parts[2];
    const localPort = parseInt(parts[3], 10);
    const remoteAddr = parts[4];
    const remotePort = parseInt(parts[5], 10);
    const txKb = parseFloat(parts[6]);
    const rxKb = parseFloat(parts[7]);
    const durationMs = parseFloat(parts[8]);

    if (isNaN(pid) || isNaN(localPort)) continue;

    const entry: TcpLifeEntry = {
      pid,
      comm,
      localAddr,
      localPort,
      remoteAddr,
      remotePort,
      txKb,
      rxKb,
      durationMs,
    };

    connections.push(entry);
    totalTxKb += txKb;
    totalRxKb += rxKb;
    totalDurationMs += durationMs;
  }

  const avgDurationMs = connections.length > 0 ? totalDurationMs / connections.length : 0;

  // Top connections by duration
  const topByDuration = [...connections]
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 10);

  // Top connections by traffic
  const topByTraffic = [...connections]
    .sort((a, b) => (b.txKb + b.rxKb) - (a.txKb + a.rxKb))
    .slice(0, 10);

  return {
    connections,
    totalConnections: connections.length,
    totalTxKb,
    totalRxKb,
    avgDurationMs,
    topByDuration,
    topByTraffic,
  };
}

/**
 * Parse tcpconnect output
 * Example:
 *   PID    COMM         IP SADDR            DADDR            DPORT
 *   12345  curl         4  10.0.0.1         93.184.216.34    80
 */
export interface TcpConnectEntry {
  pid: number;
  comm: string;
  ipVersion: 4 | 6;
  sourceAddr: string;
  destAddr: string;
  destPort: number;
  timestamp?: string;
  latencyUs?: number;
}

export interface TcpConnectResult {
  connections: TcpConnectEntry[];
  totalAttempts: number;
  byPort: Record<number, number>;
  byComm: Record<string, number>;
  avgLatencyUs?: number;
}

export function parseTcpConnect(output: string): TcpConnectResult {
  const lines = output.trim().split('\n');
  const connections: TcpConnectEntry[] = [];
  const byPort: Record<number, number> = {};
  const byComm: Record<string, number> = {};
  let totalLatencyUs = 0;
  let latencyCount = 0;

  for (const line of lines) {
    // Skip header and tracing messages
    if (line.startsWith('PID') || line.startsWith('Tracing') || !line.trim()) continue;

    // Parse: PID COMM IP SADDR DADDR DPORT [LAT(ms)]
    const parts = line.trim().split(/\s+/);
    if (parts.length < 6) continue;

    const pid = parseInt(parts[0], 10);
    const comm = parts[1];
    const ipVersion = parseInt(parts[2], 10) as 4 | 6;
    const sourceAddr = parts[3];
    const destAddr = parts[4];
    const destPort = parseInt(parts[5], 10);

    if (isNaN(pid) || isNaN(destPort)) continue;

    const entry: TcpConnectEntry = {
      pid,
      comm,
      ipVersion,
      sourceAddr,
      destAddr,
      destPort,
    };

    // Optional latency field
    if (parts.length >= 7) {
      const latencyMs = parseFloat(parts[6]);
      if (!isNaN(latencyMs)) {
        entry.latencyUs = latencyMs * 1000;
        totalLatencyUs += entry.latencyUs;
        latencyCount++;
      }
    }

    connections.push(entry);
    byPort[destPort] = (byPort[destPort] || 0) + 1;
    byComm[comm] = (byComm[comm] || 0) + 1;
  }

  return {
    connections,
    totalAttempts: connections.length,
    byPort,
    byComm,
    avgLatencyUs: latencyCount > 0 ? totalLatencyUs / latencyCount : undefined,
  };
}

/**
 * Parse execsnoop output
 * Example:
 *   TIME     PCOMM         PID    PPID   RET ARGS
 *   12:34:56 bash          12345  12344  0   /bin/ls -la
 */
export interface ExecEntry {
  timestamp?: string;
  parentComm: string;
  pid: number;
  ppid: number;
  returnCode: number;
  args: string;
}

export interface ExecsnoopResult {
  executions: ExecEntry[];
  totalExecs: number;
  byComm: Record<string, number>;
  failedExecs: number;
}

export function parseExecsnoop(output: string): ExecsnoopResult {
  const lines = output.trim().split('\n');
  const executions: ExecEntry[] = [];
  const byComm: Record<string, number> = {};
  let failedExecs = 0;

  for (const line of lines) {
    // Skip header and tracing messages
    if (line.startsWith('TIME') || line.startsWith('PCOMM') || line.startsWith('Tracing') || !line.trim()) continue;

    // Parse: TIME PCOMM PID PPID RET ARGS
    // Time is optional depending on flags
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5) continue;

    let idx = 0;
    let timestamp: string | undefined;

    // Check if first field looks like a timestamp
    if (parts[0].includes(':') || parts[0].match(/^\d+\.\d+$/)) {
      timestamp = parts[idx++];
    }

    const parentComm = parts[idx++];
    const pid = parseInt(parts[idx++], 10);
    const ppid = parseInt(parts[idx++], 10);
    const returnCode = parseInt(parts[idx++], 10);
    const args = parts.slice(idx).join(' ');

    if (isNaN(pid)) continue;

    const entry: ExecEntry = {
      timestamp,
      parentComm,
      pid,
      ppid,
      returnCode,
      args,
    };

    executions.push(entry);

    // Extract command name from args
    const cmdMatch = args.match(/^(\S+)/);
    const cmd = cmdMatch ? cmdMatch[1].split('/').pop() || 'unknown' : 'unknown';
    byComm[cmd] = (byComm[cmd] || 0) + 1;

    if (returnCode !== 0) {
      failedExecs++;
    }
  }

  return {
    executions,
    totalExecs: executions.length,
    byComm,
    failedExecs,
  };
}

/**
 * Parse syscount output
 * Example:
 *   SYSCALL                   COUNT
 *   read                     123456
 *   write                     98765
 */
export interface SyscountEntry {
  syscall: string;
  count: number;
  errors?: number;
}

export interface SyscountResult {
  syscalls: SyscountEntry[];
  totalCalls: number;
  topSyscalls: SyscountEntry[];
}

export function parseSyscount(output: string): SyscountResult {
  const lines = output.trim().split('\n');
  const syscalls: SyscountEntry[] = [];
  let totalCalls = 0;

  for (const line of lines) {
    // Skip header and tracing messages
    if (line.startsWith('SYSCALL') || line.startsWith('Tracing') || line.startsWith('Detaching') || !line.trim()) continue;

    // Parse: SYSCALL COUNT [ERRORS]
    const parts = line.trim().split(/\s+/);
    if (parts.length < 2) continue;

    const syscall = parts[0];
    const count = parseInt(parts[1], 10);

    if (isNaN(count)) continue;

    const entry: SyscountEntry = { syscall, count };

    if (parts.length >= 3) {
      const errors = parseInt(parts[2], 10);
      if (!isNaN(errors)) {
        entry.errors = errors;
      }
    }

    syscalls.push(entry);
    totalCalls += count;
  }

  // Already sorted by count in descending order typically
  const topSyscalls = syscalls.slice(0, 20);

  return {
    syscalls,
    totalCalls,
    topSyscalls,
  };
}

/**
 * Parse syscount output with latency (-L flag)
 * Format:
 *   SYSCALL                   COUNT        TIME (us)
 *   read                      12345        678901
 */
export interface SyscountLatencyEntry {
  syscall: string;
  count: number;
  totalTimeUs: number;
  avgTimeUs: number;
}

export interface SyscountLatencyResult {
  syscalls: SyscountLatencyEntry[];
  totalCalls: number;
  totalTimeUs: number;
  topByCount: SyscountLatencyEntry[];
  topByTime: SyscountLatencyEntry[];
}

export function parseSyscountWithLatency(output: string): SyscountLatencyResult {
  const lines = output.trim().split('\n');
  const syscalls: SyscountLatencyEntry[] = [];
  let totalCalls = 0;
  let totalTimeUs = 0;

  for (const line of lines) {
    // Skip header and tracing messages
    if (line.startsWith('SYSCALL') || line.startsWith('Tracing') || line.startsWith('Detaching') || !line.trim()) continue;

    // Parse: SYSCALL COUNT TIME
    const parts = line.trim().split(/\s+/);
    if (parts.length < 3) continue;

    const syscall = parts[0];
    const count = parseInt(parts[1], 10);
    const time = parseInt(parts[2], 10);

    if (isNaN(count) || isNaN(time)) continue;

    const entry: SyscountLatencyEntry = {
      syscall,
      count,
      totalTimeUs: time,
      avgTimeUs: count > 0 ? time / count : 0,
    };

    syscalls.push(entry);
    totalCalls += count;
    totalTimeUs += time;
  }

  const topByCount = [...syscalls].sort((a, b) => b.count - a.count).slice(0, 20);
  const topByTime = [...syscalls].sort((a, b) => b.totalTimeUs - a.totalTimeUs).slice(0, 20);

  return {
    syscalls,
    totalCalls,
    totalTimeUs,
    topByCount,
    topByTime,
  };
}

/**
 * Parse gethostlatency output
 * Format:
 *   TIME      PID    COMM          LATms HOST
 *   12:34:56  12345  curl          90.12 www.example.com
 */
export interface GethostlatencyEntry {
  timestamp: string;
  pid: number;
  comm: string;
  latencyMs: number;
  host: string;
}

export interface GethostlatencyResult {
  lookups: GethostlatencyEntry[];
  totalLookups: number;
  avgLatencyMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxLatencyMs: number;
  byHost: Record<string, { count: number; avgLatencyMs: number }>;
}

export function parseGethostlatency(output: string): GethostlatencyResult {
  const lines = output.trim().split('\n');
  const lookups: GethostlatencyEntry[] = [];
  const latencies: number[] = [];
  const hostStats: Record<string, { count: number; totalMs: number }> = {};

  for (const line of lines) {
    // Skip header and tracing messages
    if (line.startsWith('TIME') || line.startsWith('Tracing') || !line.trim()) continue;

    // Parse: TIME PID COMM LATms HOST
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5) continue;

    const timestamp = parts[0];
    const pid = parseInt(parts[1], 10);
    const comm = parts[2];
    const latencyMs = parseFloat(parts[3]);
    const host = parts.slice(4).join(' '); // Host might have spaces

    if (isNaN(pid) || isNaN(latencyMs)) continue;

    lookups.push({ timestamp, pid, comm, latencyMs, host });
    latencies.push(latencyMs);

    if (!hostStats[host]) {
      hostStats[host] = { count: 0, totalMs: 0 };
    }
    hostStats[host].count++;
    hostStats[host].totalMs += latencyMs;
  }

  // Calculate percentiles
  latencies.sort((a, b) => a - b);
  const p50Ms = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.5)] : 0;
  const p95Ms = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0;
  const p99Ms = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.99)] : 0;
  const maxLatencyMs = latencies.length > 0 ? latencies[latencies.length - 1] : 0;
  const avgLatencyMs = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;

  const byHost: Record<string, { count: number; avgLatencyMs: number }> = {};
  for (const [host, stats] of Object.entries(hostStats)) {
    byHost[host] = {
      count: stats.count,
      avgLatencyMs: stats.count > 0 ? stats.totalMs / stats.count : 0,
    };
  }

  return {
    lookups,
    totalLookups: lookups.length,
    avgLatencyMs,
    p50Ms,
    p95Ms,
    p99Ms,
    maxLatencyMs,
    byHost,
  };
}

/**
 * Parse filelife output
 * Format:
 *   TIME     PID    COMM             AGE(s)  FILE
 *   12:34:56 12345  rm               0.50    tempfile.txt
 */
export interface FilelifeEntry {
  timestamp: string;
  pid: number;
  comm: string;
  ageSeconds: number;
  filename: string;
}

export interface FilelifeResult {
  files: FilelifeEntry[];
  totalFiles: number;
  avgAgeSeconds: number;
  shortLivedCount: number; // < 1 second
  byProcess: Record<string, number>;
}

export function parseFilelife(output: string): FilelifeResult {
  const lines = output.trim().split('\n');
  const files: FilelifeEntry[] = [];
  const byProcess: Record<string, number> = {};
  let shortLivedCount = 0;
  let totalAge = 0;

  for (const line of lines) {
    // Skip header and tracing messages
    if (line.startsWith('TIME') || line.startsWith('Tracing') || !line.trim()) continue;

    // Parse: TIME PID COMM AGE(s) FILE
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5) continue;

    const timestamp = parts[0];
    const pid = parseInt(parts[1], 10);
    const comm = parts[2];
    const ageSeconds = parseFloat(parts[3]);
    const filename = parts.slice(4).join(' ');

    if (isNaN(pid) || isNaN(ageSeconds)) continue;

    files.push({ timestamp, pid, comm, ageSeconds, filename });
    totalAge += ageSeconds;

    if (ageSeconds < 1) {
      shortLivedCount++;
    }

    byProcess[comm] = (byProcess[comm] || 0) + 1;
  }

  return {
    files,
    totalFiles: files.length,
    avgAgeSeconds: files.length > 0 ? totalAge / files.length : 0,
    shortLivedCount,
    byProcess,
  };
}

/**
 * Parse fileslower output
 * Format:
 *   TIME(s)  COMM           PID    D BYTES   LAT(ms) FILENAME
 *   0.123    python         12345  R 4096    15.67   data.txt
 */
export interface FileslowerEntry {
  timeSeconds: number;
  comm: string;
  pid: number;
  direction: 'R' | 'W';
  bytes: number;
  latencyMs: number;
  filename: string;
}

export interface FileslowerResult {
  operations: FileslowerEntry[];
  totalOps: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  maxLatencyMs: number;
  byFile: Record<string, { count: number; avgLatencyMs: number }>;
  byProcess: Record<string, { count: number; avgLatencyMs: number }>;
  readOps: number;
  writeOps: number;
}

export function parseFileslower(output: string): FileslowerResult {
  const lines = output.trim().split('\n');
  const operations: FileslowerEntry[] = [];
  const latencies: number[] = [];
  const byFile: Record<string, { count: number; totalMs: number }> = {};
  const byProcess: Record<string, { count: number; totalMs: number }> = {};
  let readOps = 0;
  let writeOps = 0;

  for (const line of lines) {
    // Skip header and tracing messages
    if (line.startsWith('TIME') || line.startsWith('Tracing') || !line.trim()) continue;

    // Parse: TIME(s) COMM PID D BYTES LAT(ms) FILENAME
    const parts = line.trim().split(/\s+/);
    if (parts.length < 7) continue;

    const timeSeconds = parseFloat(parts[0]);
    const comm = parts[1];
    const pid = parseInt(parts[2], 10);
    const direction = parts[3] as 'R' | 'W';
    const bytes = parseInt(parts[4], 10);
    const latencyMs = parseFloat(parts[5]);
    const filename = parts.slice(6).join(' ');

    if (isNaN(pid) || isNaN(latencyMs)) continue;

    operations.push({ timeSeconds, comm, pid, direction, bytes, latencyMs, filename });
    latencies.push(latencyMs);

    if (direction === 'R') readOps++;
    else writeOps++;

    // Aggregate by file
    if (!byFile[filename]) {
      byFile[filename] = { count: 0, totalMs: 0 };
    }
    byFile[filename].count++;
    byFile[filename].totalMs += latencyMs;

    // Aggregate by process
    if (!byProcess[comm]) {
      byProcess[comm] = { count: 0, totalMs: 0 };
    }
    byProcess[comm].count++;
    byProcess[comm].totalMs += latencyMs;
  }

  // Calculate stats
  latencies.sort((a, b) => a - b);
  const avgLatencyMs = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
  const p95LatencyMs = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0;
  const maxLatencyMs = latencies.length > 0 ? latencies[latencies.length - 1] : 0;

  // Convert aggregates
  const byFileResult: Record<string, { count: number; avgLatencyMs: number }> = {};
  for (const [file, stats] of Object.entries(byFile)) {
    byFileResult[file] = {
      count: stats.count,
      avgLatencyMs: stats.count > 0 ? stats.totalMs / stats.count : 0,
    };
  }

  const byProcessResult: Record<string, { count: number; avgLatencyMs: number }> = {};
  for (const [proc, stats] of Object.entries(byProcess)) {
    byProcessResult[proc] = {
      count: stats.count,
      avgLatencyMs: stats.count > 0 ? stats.totalMs / stats.count : 0,
    };
  }

  return {
    operations,
    totalOps: operations.length,
    avgLatencyMs,
    p95LatencyMs,
    maxLatencyMs,
    byFile: byFileResult,
    byProcess: byProcessResult,
    readOps,
    writeOps,
  };
}

/**
 * Parse opensnoop output
 * Format:
 *   PID    COMM               FD ERR PATH
 *   12345  python             3  0   /etc/passwd
 */
export interface OpensnoopEntry {
  timestamp?: string;
  pid: number;
  comm: string;
  fd: number;
  err: number;
  path: string;
}

export interface OpensnoopResult {
  opens: OpensnoopEntry[];
  totalOpens: number;
  failedOpens: number;
  byProcess: Record<string, number>;
  byPath: Record<string, number>;
}

export function parseOpensnoop(output: string): OpensnoopResult {
  const lines = output.trim().split('\n');
  const opens: OpensnoopEntry[] = [];
  const byProcess: Record<string, number> = {};
  const byPath: Record<string, number> = {};
  let failedOpens = 0;

  for (const line of lines) {
    // Skip header and tracing messages
    if (line.startsWith('PID') || line.startsWith('TIME') || line.startsWith('Tracing') || !line.trim()) continue;

    // Parse: [TIME] PID COMM FD ERR PATH
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5) continue;

    let idx = 0;
    let timestamp: string | undefined;

    // Check if first field is timestamp
    if (parts[0].includes(':') || parts[0].match(/^\d+\.\d+$/)) {
      timestamp = parts[idx++];
    }

    const pid = parseInt(parts[idx++], 10);
    const comm = parts[idx++];
    const fd = parseInt(parts[idx++], 10);
    const err = parseInt(parts[idx++], 10);
    const path = parts.slice(idx).join(' ');

    if (isNaN(pid)) continue;

    opens.push({ timestamp, pid, comm, fd, err, path });

    if (err !== 0 || fd < 0) {
      failedOpens++;
    }

    byProcess[comm] = (byProcess[comm] || 0) + 1;
    byPath[path] = (byPath[path] || 0) + 1;
  }

  return {
    opens,
    totalOpens: opens.length,
    failedOpens,
    byProcess,
    byPath,
  };
}

/**
 * Parse bpftrace linear histogram output
 * Format:
 *   @usecs:
 *   [0, 1)                 5 |@@@                                     |
 *   [1, 2)                12 |@@@@@@@@                                |
 *   [2, 3)                25 |@@@@@@@@@@@@@@@@                        |
 *   [3, 4)                 8 |@@@@@                                   |
 *
 * Also handles ranges like [0, 100), [100, 200), etc.
 */
export interface LinearHistogramBucket {
  rangeStart: number;
  rangeEnd: number;
  count: number;
}

export interface LinearHistogramResult {
  buckets: LinearHistogramBucket[];
  totalOps: number;
  avgValueUs: number;
  p50Us: number;
  p99Us: number;
  maxValueUs: number;
  unit: 'usecs' | 'msecs' | 'nsecs';
}

export function parseBpftraceLinearHistogram(output: string): LinearHistogramResult {
  const lines = output.trim().split('\n');
  const buckets: LinearHistogramBucket[] = [];
  let unit: 'usecs' | 'msecs' | 'nsecs' = 'usecs';
  let totalOps = 0;
  let weightedSum = 0;

  for (const line of lines) {
    // Detect unit from variable name
    if (line.includes('@usecs') || line.includes('@us')) unit = 'usecs';
    else if (line.includes('@msecs') || line.includes('@ms')) unit = 'msecs';
    else if (line.includes('@nsecs') || line.includes('@ns')) unit = 'nsecs';

    // Parse linear histogram bucket
    // Format: "[start, end)   count |bars|" or "[start, end]   count |bars|"
    const bucketMatch = line.match(/^\s*\[(\d+),\s*(\d+)[)\]]\s+(\d+)\s*\|/);
    if (bucketMatch) {
      const rangeStart = parseInt(bucketMatch[1], 10);
      const rangeEnd = parseInt(bucketMatch[2], 10);
      const count = parseInt(bucketMatch[3], 10);

      buckets.push({ rangeStart, rangeEnd, count });
      totalOps += count;
      // Use midpoint for weighted average
      weightedSum += ((rangeStart + rangeEnd) / 2) * count;
    }
  }

  // Calculate percentiles
  const avgValueUs = totalOps > 0 ? weightedSum / totalOps : 0;
  let p50Us = 0;
  let p99Us = 0;
  let maxValueUs = 0;

  if (buckets.length > 0) {
    const p50Target = totalOps * 0.5;
    const p99Target = totalOps * 0.99;
    let cumulative = 0;

    for (const bucket of buckets) {
      cumulative += bucket.count;
      const midpoint = (bucket.rangeStart + bucket.rangeEnd) / 2;

      if (p50Us === 0 && cumulative >= p50Target) {
        p50Us = midpoint;
      }
      if (p99Us === 0 && cumulative >= p99Target) {
        p99Us = midpoint;
      }
      if (bucket.count > 0) {
        maxValueUs = bucket.rangeEnd;
      }
    }
  }

  // Convert to microseconds if needed
  const multiplier = unit === 'msecs' ? 1000 : unit === 'nsecs' ? 0.001 : 1;

  return {
    buckets,
    totalOps,
    avgValueUs: avgValueUs * multiplier,
    p50Us: p50Us * multiplier,
    p99Us: p99Us * multiplier,
    maxValueUs: maxValueUs * multiplier,
    unit,
  };
}

/**
 * Parse vfsstat output
 * Format:
 *   TIME       READ/s   WRITE/s   FSYNC/s    OPEN/s  CREATE/s  UNLINK/s  MKDIR/s  RMDIR/s
 *   HH:MM:SS:    123      456       12        789      23        45        1        0
 */
export interface VfsstatEntry {
  timestamp: string;
  reads: number;
  writes: number;
  fsyncs: number;
  opens: number;
  creates: number;
  unlinks: number;
  mkdirs: number;
  rmdirs: number;
}

export interface VfsstatResult {
  entries: VfsstatEntry[];
  totals: {
    reads: number;
    writes: number;
    fsyncs: number;
    opens: number;
    creates: number;
    unlinks: number;
    mkdirs: number;
    rmdirs: number;
  };
  avgPerSecond: {
    reads: number;
    writes: number;
    fsyncs: number;
    opens: number;
    creates: number;
    unlinks: number;
    mkdirs: number;
    rmdirs: number;
  };
}

export function parseVfsstat(output: string): VfsstatResult {
  const lines = output.trim().split('\n');
  const entries: VfsstatEntry[] = [];
  const totals = { reads: 0, writes: 0, fsyncs: 0, opens: 0, creates: 0, unlinks: 0, mkdirs: 0, rmdirs: 0 };

  for (const line of lines) {
    // Skip header
    if (line.includes('READ/s') || line.startsWith('TIME') || !line.trim()) continue;

    // Parse: TIME READ/s WRITE/s FSYNC/s OPEN/s CREATE/s UNLINK/s MKDIR/s RMDIR/s
    const parts = line.trim().split(/\s+/);
    if (parts.length < 9) continue;

    const timestamp = parts[0];
    const reads = parseInt(parts[1], 10);
    const writes = parseInt(parts[2], 10);
    const fsyncs = parseInt(parts[3], 10);
    const opens = parseInt(parts[4], 10);
    const creates = parseInt(parts[5], 10);
    const unlinks = parseInt(parts[6], 10);
    const mkdirs = parseInt(parts[7], 10);
    const rmdirs = parseInt(parts[8], 10);

    if (isNaN(reads)) continue;

    entries.push({ timestamp, reads, writes, fsyncs, opens, creates, unlinks, mkdirs, rmdirs });
    totals.reads += reads;
    totals.writes += writes;
    totals.fsyncs += fsyncs;
    totals.opens += opens;
    totals.creates += creates;
    totals.unlinks += unlinks;
    totals.mkdirs += mkdirs;
    totals.rmdirs += rmdirs;
  }

  const count = entries.length || 1;
  const avgPerSecond = {
    reads: totals.reads / count,
    writes: totals.writes / count,
    fsyncs: totals.fsyncs / count,
    opens: totals.opens / count,
    creates: totals.creates / count,
    unlinks: totals.unlinks / count,
    mkdirs: totals.mkdirs / count,
    rmdirs: totals.rmdirs / count,
  };

  return { entries, totals, avgPerSecond };
}
