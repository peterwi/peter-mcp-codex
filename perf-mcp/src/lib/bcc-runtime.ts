/**
 * BCC Runtime Manager
 * Handles BCC tool lifecycle: preflight checks, compile caching,
 * dynamic timeouts, progress messaging, and fallback to bpftrace
 */

import { access, constants, mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { safeExec } from './exec.js';
import { detectCapabilities, type SystemCapabilities } from './detect.js';
import { ErrorCode, TIMEOUTS } from './constants.js';

/**
 * BCC compile state tracking
 */
interface BccToolState {
  lastCompileTime: number;
  compileSucceeded: boolean;
  compileDurationMs: number;
  lastError?: string;
}

const toolStateCache = new Map<string, BccToolState>();

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

// Cache directory for compile state persistence
const BCC_CACHE_DIR = '/tmp/perf-mcp/bcc-cache';

/**
 * Ensure cache directory exists
 */
async function ensureCacheDir(): Promise<void> {
  try {
    await mkdir(BCC_CACHE_DIR, { recursive: true });
  } catch {
    // Ignore if already exists or no permission
  }
}

/**
 * Load persisted tool state from disk
 */
async function loadToolState(tool: string): Promise<BccToolState | null> {
  try {
    const statePath = join(BCC_CACHE_DIR, `${tool}.json`);
    const content = await readFile(statePath, 'utf-8');
    return JSON.parse(content) as BccToolState;
  } catch {
    return null;
  }
}

/**
 * Save tool state to disk
 */
async function saveToolState(tool: string, state: BccToolState): Promise<void> {
  try {
    await ensureCacheDir();
    const statePath = join(BCC_CACHE_DIR, `${tool}.json`);
    await writeFile(statePath, JSON.stringify(state, null, 2));
  } catch {
    // Ignore errors - cache is best-effort
  }
}

/**
 * Check if kernel headers are available
 */
async function checkKernelHeaders(): Promise<boolean> {
  // Get actual kernel version
  const unameResult = await safeExec('uname', ['-r']);
  if (!unameResult.success || !('stdout' in unameResult)) {
    return false;
  }
  const kernelVersion = unameResult.stdout.trim();

  const actualPaths = [
    `/lib/modules/${kernelVersion}/build`,
    `/usr/src/linux-headers-${kernelVersion}`,
  ];

  for (const path of actualPaths) {
    try {
      await access(path, constants.R_OK);
      return true;
    } catch {
      // Try next path
    }
  }
  return false;
}

/**
 * Check if debugfs is mounted
 */
async function checkDebugfs(): Promise<boolean> {
  try {
    await access('/sys/kernel/debug/tracing', constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Perform preflight checks for BCC tools
 */
export async function bccPreflight(tool: string): Promise<PreflightResult> {
  const caps = await detectCapabilities();
  const warnings: string[] = [];
  const missingDeps: string[] = [];

  const hasKernelHeaders = await checkKernelHeaders();
  const hasDebugfs = await checkDebugfs();

  if (!hasKernelHeaders && !caps.hasBtf) {
    missingDeps.push('kernel headers or BTF');
    warnings.push('Neither kernel headers nor BTF available - BCC compilation may fail');
  }

  if (!hasDebugfs) {
    warnings.push('debugfs not accessible - some features may be limited');
  }

  if (!caps.isRoot) {
    missingDeps.push('root privileges');
  }

  // Check if specific tool exists
  const toolAvailable = caps.bccTools[tool as keyof typeof caps.bccTools] ?? false;
  if (!toolAvailable) {
    missingDeps.push(`bcc-tools (${tool})`);
  }

  const canRun = missingDeps.length === 0 || (toolAvailable && caps.isRoot);

  let suggestion: string | undefined;
  if (!canRun) {
    if (!caps.isRoot) {
      suggestion = 'Run as root or with CAP_BPF + CAP_PERFMON capabilities';
    } else if (!toolAvailable) {
      suggestion = 'Install bcc-tools package: apt install bcc-tools (Debian/Ubuntu) or yum install bcc-tools (RHEL/CentOS)';
    } else if (!hasKernelHeaders && !caps.hasBtf) {
      suggestion = 'Install kernel headers: apt install linux-headers-$(uname -r) or enable BTF in kernel config';
    }
  }

  return {
    canRun,
    hasKernelHeaders,
    hasBtf: caps.hasBtf,
    hasDebugfs,
    kernelVersion: caps.kernelVersion,
    missingDeps,
    warnings,
    suggestion,
  };
}

/**
 * Calculate dynamic timeout based on tool state and system conditions
 */
export function calculateTimeout(config: BccConfig, caps: SystemCapabilities): number {
  const baseTimeout = config.durationSec * 1000;
  const buffer = config.timeoutBuffer ?? 5000;

  // Check if we have cached compile state
  const cachedState = toolStateCache.get(config.tool);

  if (cachedState?.compileSucceeded) {
    // Tool has been compiled successfully before - use shorter timeout
    // Add estimated compile time (typically much faster after first run due to kernel caching)
    const estimatedCompileTime = Math.min(cachedState.compileDurationMs * 0.3, 5000);
    return baseTimeout + estimatedCompileTime + buffer;
  }

  // First run or previous failure - calculate longer timeout
  let compileTimeEstimate = 15000; // Base 15 seconds for compile

  // Adjust based on system characteristics
  if (!caps.hasBtf) {
    // Without BTF, compilation is slower
    compileTimeEstimate += 10000;
  }

  if (caps.cpuCount < 4) {
    // Slower on systems with fewer cores
    compileTimeEstimate += 5000;
  }

  if (caps.isContainer) {
    // Container overhead
    compileTimeEstimate += 5000;
  }

  // Cap at reasonable maximum
  const maxCompileTime = 45000;
  compileTimeEstimate = Math.min(compileTimeEstimate, maxCompileTime);

  return baseTimeout + compileTimeEstimate + buffer;
}

/**
 * Execute BCC tool with enhanced error handling and fallback
 */
export async function executeBcc(config: BccConfig): Promise<BccResult> {
  const startTime = Date.now();
  const warnings: string[] = [];

  // Report progress: preflight
  config.onProgress?.({
    phase: 'preflight',
    message: `Checking prerequisites for ${config.tool}...`,
    elapsedMs: 0,
  });

  // Perform preflight checks
  const preflight = await bccPreflight(config.tool);
  warnings.push(...preflight.warnings);

  if (!preflight.canRun) {
    // Check if we have a bpftrace fallback
    if (config.bpftraceFallback) {
      return await executeBpftraceFallback(config, startTime, warnings, preflight);
    }

    return {
      success: false,
      method: 'bcc',
      stdout: '',
      stderr: '',
      durationMs: Date.now() - startTime,
      truncated: false,
      warnings,
      error: {
        code: ErrorCode.CAPABILITY_MISSING,
        message: `Cannot run ${config.tool}: ${preflight.missingDeps.join(', ')} required`,
        suggestion: preflight.suggestion,
        recoverable: !!config.bpftraceFallback,
      },
    };
  }

  // Calculate timeout
  const caps = await detectCapabilities();
  const timeout = calculateTimeout(config, caps);

  // Report progress: compiling
  const compileStart = Date.now();
  config.onProgress?.({
    phase: 'compiling',
    message: `Starting ${config.tool} (may take ${Math.round(timeout / 1000)}s on first run)...`,
    elapsedMs: Date.now() - startTime,
    estimatedRemainingMs: timeout,
  });

  // Execute the BCC tool
  const result = await safeExec(config.tool, config.args, {
    timeout,
    maxOutput: config.maxOutput,
  });

  const totalDuration = Date.now() - startTime;
  const compileDuration = Date.now() - compileStart;

  // Update tool state cache
  const newState: BccToolState = {
    lastCompileTime: Date.now(),
    compileSucceeded: result.success || ('stdout' in result && result.stdout.length > 0),
    compileDurationMs: compileDuration,
    lastError: result.success ? undefined : (result.error?.message ?? 'Unknown error'),
  };
  toolStateCache.set(config.tool, newState);
  await saveToolState(config.tool, newState);

  // Handle timeout specifically
  if (!result.success && result.error?.code === ErrorCode.TIMEOUT) {
    // Check if we have a bpftrace fallback
    if (config.bpftraceFallback) {
      warnings.push(`BCC ${config.tool} timed out after ${timeout}ms, trying bpftrace fallback`);
      return await executeBpftraceFallback(config, startTime, warnings, preflight);
    }

    return {
      success: false,
      method: 'bcc',
      stdout: '',
      stderr: '',
      durationMs: totalDuration,
      compileDurationMs: compileDuration,
      truncated: false,
      warnings,
      error: {
        code: ErrorCode.TIMEOUT,
        message: `${config.tool} timed out after ${Math.round(timeout / 1000)}s - BCC compilation may be slow`,
        suggestion: 'Try again (compile is cached), reduce duration, or ensure kernel headers are installed',
        recoverable: true,
      },
    };
  }

  // Handle other failures
  if (!result.success && !('stdout' in result && result.stdout.length > 0)) {
    // Check if we have a bpftrace fallback
    if (config.bpftraceFallback) {
      warnings.push(`BCC ${config.tool} failed: ${result.error?.message}, trying bpftrace fallback`);
      return await executeBpftraceFallback(config, startTime, warnings, preflight);
    }

    return {
      success: false,
      method: 'bcc',
      stdout: '',
      stderr: 'stderr' in result ? result.stderr : '',
      durationMs: totalDuration,
      compileDurationMs: compileDuration,
      truncated: false,
      warnings,
      error: {
        code: result.error?.code ?? ErrorCode.EXECUTION_FAILED,
        message: result.error?.message ?? `${config.tool} execution failed`,
        suggestion: result.error?.suggestion ?? 'Check system logs and ensure BCC is properly installed',
        recoverable: !!config.bpftraceFallback,
      },
    };
  }

  // Success
  config.onProgress?.({
    phase: 'complete',
    message: `${config.tool} completed successfully`,
    elapsedMs: totalDuration,
  });

  return {
    success: true,
    method: 'bcc',
    stdout: 'stdout' in result ? result.stdout : '',
    stderr: 'stderr' in result ? result.stderr : '',
    durationMs: totalDuration,
    compileDurationMs: compileDuration,
    tracingDurationMs: config.durationSec * 1000,
    truncated: 'truncated' in result ? result.truncated : false,
    warnings,
  };
}

/**
 * Execute bpftrace fallback script
 */
async function executeBpftraceFallback(
  config: BccConfig,
  startTime: number,
  warnings: string[],
  _preflight: PreflightResult
): Promise<BccResult> {
  if (!config.bpftraceFallback) {
    return {
      success: false,
      method: 'bpftrace_fallback',
      stdout: '',
      stderr: '',
      durationMs: Date.now() - startTime,
      truncated: false,
      warnings,
      error: {
        code: ErrorCode.CAPABILITY_MISSING,
        message: 'No bpftrace fallback available',
        recoverable: false,
      },
    };
  }

  config.onProgress?.({
    phase: 'fallback',
    message: 'Using bpftrace fallback...',
    elapsedMs: Date.now() - startTime,
  });

  const caps = await detectCapabilities();
  if (!caps.hasBpftrace) {
    return {
      success: false,
      method: 'bpftrace_fallback',
      stdout: '',
      stderr: '',
      durationMs: Date.now() - startTime,
      truncated: false,
      warnings,
      error: {
        code: ErrorCode.TOOL_NOT_FOUND,
        message: 'bpftrace not available for fallback',
        suggestion: 'Install bpftrace: apt install bpftrace',
        recoverable: false,
      },
    };
  }

  // Execute bpftrace with the fallback script
  const timeout = (config.durationSec * 1000) + TIMEOUTS.DEFAULT + 10000;
  const result = await safeExec('bpftrace', ['-e', config.bpftraceFallback], {
    timeout,
    maxOutput: config.maxOutput,
  });

  const totalDuration = Date.now() - startTime;

  if (!result.success && !('stdout' in result && result.stdout.length > 0)) {
    return {
      success: false,
      method: 'bpftrace_fallback',
      stdout: '',
      stderr: 'stderr' in result ? result.stderr : '',
      durationMs: totalDuration,
      truncated: false,
      warnings,
      error: {
        code: result.error?.code ?? ErrorCode.EXECUTION_FAILED,
        message: result.error?.message ?? 'bpftrace fallback failed',
        suggestion: 'Ensure bpftrace is properly installed and you have root privileges',
        recoverable: false,
      },
    };
  }

  warnings.push('Using bpftrace fallback - output format may differ from BCC');

  return {
    success: true,
    method: 'bpftrace_fallback',
    stdout: 'stdout' in result ? result.stdout : '',
    stderr: 'stderr' in result ? result.stderr : '',
    durationMs: totalDuration,
    truncated: 'truncated' in result ? result.truncated : false,
    warnings,
  };
}

/**
 * Warm up BCC tool (pre-compile without tracing)
 * Useful for reducing latency on first actual use
 */
export async function warmupBccTool(tool: string): Promise<{ success: boolean; durationMs: number; error?: string }> {
  const startTime = Date.now();

  // Check preflight first
  const preflight = await bccPreflight(tool);
  if (!preflight.canRun) {
    return {
      success: false,
      durationMs: Date.now() - startTime,
      error: `Preflight failed: ${preflight.missingDeps.join(', ')}`,
    };
  }

  // Run tool with minimal duration just to trigger compile
  // Most BCC tools support duration or will exit quickly
  const warmupArgs: string[] = [];

  // Tool-specific minimal args for quick warmup
  switch (tool) {
    case 'syscount':
      warmupArgs.push('-d', '1');
      break;
    case 'biolatency':
      warmupArgs.push('1', '1'); // 1 second, 1 interval
      break;
    case 'gethostlatency':
      // No duration arg, will be killed by timeout
      break;
    case 'execsnoop':
      // No duration arg
      break;
    default:
      warmupArgs.push('1'); // Try generic duration
  }

  const result = await safeExec(tool, warmupArgs, {
    timeout: 60000, // 60 second timeout for warmup
  });

  const durationMs = Date.now() - startTime;

  // Update cache regardless of success (compilation may have happened)
  const state: BccToolState = {
    lastCompileTime: Date.now(),
    compileSucceeded: result.success || ('stdout' in result && result.stdout.length > 0),
    compileDurationMs: durationMs,
    lastError: result.success ? undefined : result.error?.message,
  };
  toolStateCache.set(tool, state);
  await saveToolState(tool, state);

  return {
    success: state.compileSucceeded,
    durationMs,
    error: state.lastError,
  };
}

/**
 * Get current state of BCC tool compile cache
 */
export function getBccToolState(tool: string): BccToolState | undefined {
  return toolStateCache.get(tool);
}

/**
 * Clear BCC tool state cache
 */
export function clearBccCache(): void {
  toolStateCache.clear();
}

/**
 * Load all cached tool states from disk
 */
export async function loadBccCacheFromDisk(): Promise<void> {
  const tools = [
    'syscount', 'biolatency', 'runqlat', 'tcplife', 'tcpconnect',
    'execsnoop', 'gethostlatency', 'filelife', 'fileslower',
    'bitesize', 'opensnoop', 'vfsstat', 'vfscount', 'offcputime'
  ];

  for (const tool of tools) {
    const state = await loadToolState(tool);
    if (state) {
      toolStateCache.set(tool, state);
    }
  }
}
