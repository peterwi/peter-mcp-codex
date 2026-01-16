/**
 * BCC Runtime Manager
 * Handles BCC tool lifecycle: preflight checks, compile caching,
 * dynamic timeouts, progress messaging, and fallback to bpftrace
 */
import { type SystemCapabilities } from './detect.js';
import { ErrorCode } from './constants.js';
/**
 * BCC compile state tracking
 */
interface BccToolState {
    lastCompileTime: number;
    compileSucceeded: boolean;
    compileDurationMs: number;
    lastError?: string;
}
/**
 * BCC runtime configuration
 */
export interface BccConfig {
    /** Tool name (e.g., 'syscount', 'gethostlatency') */
    tool: string;
    /** Arguments for the tool */
    args: string[];
    /** User-requested duration in seconds */
    durationSec: number;
    /** Additional timeout buffer in ms (default: 5000) */
    timeoutBuffer?: number;
    /** Maximum output size in bytes */
    maxOutput?: number;
    /** Progress callback for status updates */
    onProgress?: (status: BccProgress) => void;
    /** Fallback bpftrace script if BCC fails */
    bpftraceFallback?: string;
    /** Whether this is the first run (for compile timing) */
    isFirstRun?: boolean;
}
/**
 * Progress status for long-running operations
 */
export interface BccProgress {
    phase: 'preflight' | 'compiling' | 'tracing' | 'parsing' | 'fallback' | 'complete' | 'error';
    message: string;
    elapsedMs: number;
    estimatedRemainingMs?: number;
}
/**
 * BCC execution result with enhanced metadata
 */
export interface BccResult {
    success: boolean;
    method: 'bcc' | 'bpftrace_fallback';
    stdout: string;
    stderr: string;
    durationMs: number;
    compileDurationMs?: number;
    tracingDurationMs?: number;
    truncated: boolean;
    warnings: string[];
    error?: {
        code: ErrorCode;
        message: string;
        suggestion?: string;
        recoverable: boolean;
    };
}
/**
 * Preflight check results
 */
export interface PreflightResult {
    canRun: boolean;
    hasKernelHeaders: boolean;
    hasBtf: boolean;
    hasDebugfs: boolean;
    kernelVersion: string;
    missingDeps: string[];
    warnings: string[];
    suggestion?: string;
}
/**
 * Perform preflight checks for BCC tools
 */
export declare function bccPreflight(tool: string): Promise<PreflightResult>;
/**
 * Calculate dynamic timeout based on tool state and system conditions
 */
export declare function calculateTimeout(config: BccConfig, caps: SystemCapabilities): number;
/**
 * Execute BCC tool with enhanced error handling and fallback
 */
export declare function executeBcc(config: BccConfig): Promise<BccResult>;
/**
 * Warm up BCC tool (pre-compile without tracing)
 * Useful for reducing latency on first actual use
 */
export declare function warmupBccTool(tool: string): Promise<{
    success: boolean;
    durationMs: number;
    error?: string;
}>;
/**
 * Get current state of BCC tool compile cache
 */
export declare function getBccToolState(tool: string): BccToolState | undefined;
/**
 * Clear BCC tool state cache
 */
export declare function clearBccCache(): void;
/**
 * Load all cached tool states from disk
 */
export declare function loadBccCacheFromDisk(): Promise<void>;
export {};
//# sourceMappingURL=bcc-runtime.d.ts.map