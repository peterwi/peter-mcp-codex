/**
 * bpftrace Fallback Scripts
 * Embedded bpftrace scripts that serve as fallbacks when BCC tools fail
 *
 * SECURITY NOTE: These are FIXED, embedded scripts - no user input is executed.
 * Parameters are validated and injected safely using template literals.
 */
/**
 * Syscall counting fallback
 * Equivalent to: syscount -d DURATION
 */
export declare function getSyscountScript(durationSec: number, pid?: number): string;
/**
 * DNS latency fallback using getaddrinfo uprobe
 * Equivalent to: gethostlatency
 */
export declare function getDnsLatencyScript(durationSec: number, pid?: number): string;
/**
 * Block I/O latency fallback
 * Equivalent to: biolatency
 */
export declare function getBioLatencyScript(durationSec: number, _device?: string): string;
/**
 * Process execution tracing with fork/clone
 * Comprehensive process lifecycle tracing
 */
export declare function getProcessTraceScript(durationSec: number, includeFork?: boolean, includeExec?: boolean, includeExit?: boolean, pid?: number): string;
/**
 * File operations tracing fallback
 * Traces VFS operations with latency
 */
export declare function getFileOpsScript(durationSec: number, minLatencyMs?: number, pid?: number): string;
/**
 * CPU run queue latency fallback
 * Equivalent to: runqlat
 */
export declare function getRunqlatScript(durationSec: number, _pid?: number): string;
/**
 * Off-CPU analysis fallback
 * Equivalent to: offcputime
 */
export declare function getOffcpuScript(durationSec: number, _pid?: number, minBlockUs?: number): string;
/**
 * TCP connection tracing fallback
 */
export declare function getTcpTraceScript(durationSec: number, pid?: number): string;
/**
 * Get appropriate fallback script for a BCC tool
 */
export declare function getFallbackScript(tool: string, durationSec: number, options?: {
    pid?: number;
    device?: string;
    minLatencyMs?: number;
    includeFork?: boolean;
    includeExec?: boolean;
    includeExit?: boolean;
}): string | null;
//# sourceMappingURL=bpftrace-fallbacks.d.ts.map