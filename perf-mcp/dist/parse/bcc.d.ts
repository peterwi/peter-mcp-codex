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
    topFunctions: Array<{
        function: string;
        totalUs: number;
        percent: number;
    }>;
}
export declare function parseOffcputime(output: string): OffCpuResult;
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
export declare function parseBiolatency(output: string): BiolatencyResult;
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
export declare function parseRunqlat(output: string): RunqlatResult;
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
export declare function parseTcpLife(output: string): TcpLifeResult;
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
export declare function parseTcpConnect(output: string): TcpConnectResult;
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
export declare function parseExecsnoop(output: string): ExecsnoopResult;
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
export declare function parseSyscount(output: string): SyscountResult;
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
export declare function parseSyscountWithLatency(output: string): SyscountLatencyResult;
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
    byHost: Record<string, {
        count: number;
        avgLatencyMs: number;
    }>;
}
export declare function parseGethostlatency(output: string): GethostlatencyResult;
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
    shortLivedCount: number;
    byProcess: Record<string, number>;
}
export declare function parseFilelife(output: string): FilelifeResult;
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
    byFile: Record<string, {
        count: number;
        avgLatencyMs: number;
    }>;
    byProcess: Record<string, {
        count: number;
        avgLatencyMs: number;
    }>;
    readOps: number;
    writeOps: number;
}
export declare function parseFileslower(output: string): FileslowerResult;
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
export declare function parseOpensnoop(output: string): OpensnoopResult;
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
export declare function parseBpftraceLinearHistogram(output: string): LinearHistogramResult;
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
export declare function parseVfsstat(output: string): VfsstatResult;
//# sourceMappingURL=bcc.d.ts.map