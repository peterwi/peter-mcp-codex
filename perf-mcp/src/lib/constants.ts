/**
 * Constants and allowlists for perf-mcp
 * Safety-critical: These define what can be executed
 */

export const TOOL_VERSION = '1.0.0';

// Timeout limits in milliseconds
export const TIMEOUTS = {
  DEFAULT: 15_000,
  SNAPSHOT: 10_000,
  PROFILE: 60_000,
  TRACE: 30_000,
  INFO: 5_000,
  // BCC-specific timeouts
  BCC_FIRST_RUN: 45_000,    // First run includes BPF compile time
  BCC_WARM: 10_000,         // Subsequent runs (compiled/cached)
  BCC_WARMUP: 60_000,       // Warmup/pre-compile timeout
  BPFTRACE_COMPILE: 20_000, // bpftrace script compile time
} as const;

// Output size limits in bytes
export const OUTPUT_LIMITS = {
  DEFAULT: 64 * 1024, // 64KB
  PROFILE: 256 * 1024, // 256KB
  MAX: 1024 * 1024, // 1MB
} as const;

// Profiler duration limits in seconds
export const DURATION_LIMITS = {
  MIN: 1,
  DEFAULT: 5,
  MAX: 60,
} as const;

// Sample rate limits in Hz
export const SAMPLE_RATE_LIMITS = {
  MIN: 1,
  DEFAULT: 99,
  MAX: 999,
} as const;

// USE Method thresholds
export const USE_THRESHOLDS = {
  cpu: {
    utilization: { warning: 70, critical: 90 },
    runQueue: { warningMultiplier: 1, criticalMultiplier: 2 },
  },
  memory: {
    availablePercent: { warning: 20, critical: 10 },
    swapUsedPercent: { warning: 10, critical: 50 },
  },
  disk: {
    utilization: { warning: 60, critical: 80 },
    avgQueue: { warning: 2, critical: 8 },
    awaitMs: { warning: 20, critical: 50 },
  },
  network: {
    dropsPerSec: { warning: 1, critical: 100 },
    retransmitPercent: { warning: 1, critical: 5 },
  },
  psi: {
    someAvg10: { warning: 10, critical: 25 },
    fullAvg10: { warning: 5, critical: 15 },
  },
} as const;

/**
 * Allowed executables and their permitted arguments
 * This is the CRITICAL safety boundary - nothing outside this list can be executed
 */
export const ALLOWED_EXECUTABLES: Record<string, AllowedCommand> = {
  // System info tools (no special permissions needed)
  uname: {
    path: '/usr/bin/uname',
    allowedArgs: ['-a', '-r', '-m', '-s', '-n', '-v'],
  },
  hostname: {
    path: '/usr/bin/hostname',
    allowedArgs: [],
  },
  lscpu: {
    path: '/usr/bin/lscpu',
    allowedArgs: ['--json', '-e', '-J'],
  },
  lsblk: {
    path: '/usr/bin/lsblk',
    allowedArgs: ['--json', '-J', '-o', '-d', '-n'],
  },
  which: {
    path: '/usr/bin/which',
    allowedArgs: [], // allows any single argument (tool name)
  },

  // Sysstat tools
  vmstat: {
    path: '/usr/bin/vmstat',
    allowedArgs: ['-s', '-w', '-t'],
    allowsNumericArgs: true, // interval, count
  },
  iostat: {
    path: '/usr/bin/iostat',
    allowedArgs: ['-x', '-z', '-d', '-c', '-k', '-m', '-t', '-y', '-N', '-p', '-j'],
    allowsNumericArgs: true,
  },
  mpstat: {
    path: '/usr/bin/mpstat',
    allowedArgs: ['-P', 'ALL', '-I', '-u'],
    allowsNumericArgs: true,
  },
  pidstat: {
    path: '/usr/bin/pidstat',
    allowedArgs: ['-u', '-d', '-r', '-w', '-p', '-t', '-h'],
    allowsNumericArgs: true,
  },
  sar: {
    path: '/usr/bin/sar',
    allowedArgs: ['-u', '-r', '-b', '-n', '-q', '-B', '-d', '-w', 'DEV', 'ALL', 'EDEV'],
    allowsNumericArgs: true,
  },

  // Network tools
  ss: {
    path: '/usr/bin/ss',
    allowedArgs: ['-t', '-u', '-n', '-a', '-p', '-s', '-m', '-i', '-e', '-o', '--no-header'],
  },
  ip: {
    path: '/usr/bin/ip',
    allowedArgs: ['-s', '-j', '-br', 'link', 'addr', 'route', 'neigh'],
  },
  nstat: {
    path: '/usr/bin/nstat',
    allowedArgs: ['-a', '-z', '-s'],
  },

  // Perf tools (require CAP_PERFMON or root)
  perf: {
    path: '/usr/bin/perf',
    allowedArgs: [
      'stat',
      'record',
      'report',
      'script',
      'sched',
      'top',
      '-F',
      '-a',
      '-g',
      '-p',
      '--stdio',
      '--no-children',
      '--header',
      '-e',
      'latency',
      'timehist',
      '-M',
      '-V',
      '-w',
      '--',
      'sleep',
    ],
    allowsNumericArgs: true,
  },

  // BPF tools (optional, require CAP_BPF)
  bpftool: {
    path: '/usr/sbin/bpftool',
    allowedArgs: ['prog', 'map', 'btf', 'feature', 'list', 'show', '-j', '--json'],
  },

  // BCC tools (require CAP_BPF + CAP_PERFMON or root)
  // These are pre-built eBPF programs for deep analysis
  offcputime: {
    path: '/usr/share/bcc/tools/offcputime',
    allowedArgs: ['-d', '-p', '-u', '-k', '-f', '-m', '--stack-storage-size'],
    allowsNumericArgs: true,
  },
  biolatency: {
    path: '/usr/share/bcc/tools/biolatency',
    allowedArgs: ['-D', '-F', '-Q', '-d', '-m', '-j', '-T'],
    allowsNumericArgs: true,
  },
  runqlat: {
    path: '/usr/share/bcc/tools/runqlat',
    allowedArgs: ['-p', '-T', '-m', '-P', '--pidnss', '-L', '-j'],
    allowsNumericArgs: true,
  },
  tcplife: {
    path: '/usr/share/bcc/tools/tcplife',
    allowedArgs: ['-T', '-t', '-w', '-s', '-p', '-L', '-D'],
    allowsNumericArgs: true,
  },
  tcpconnect: {
    path: '/usr/share/bcc/tools/tcpconnect',
    allowedArgs: ['-t', '-p', '-P', '-U', '-u', '-c', '-L', '-d'],
    allowsNumericArgs: true,
  },
  execsnoop: {
    path: '/usr/share/bcc/tools/execsnoop',
    allowedArgs: ['-T', '-t', '-x', '-q', '-n', '-l', '--max-args', '-U', '-u'],
    allowsNumericArgs: true,
  },
  syscount: {
    path: '/usr/share/bcc/tools/syscount',
    allowedArgs: ['-p', '-i', '-T', '-L', '-P', '-x', '-e', '-l', '-d'],
    allowsNumericArgs: true,
  },
  funclatency: {
    path: '/usr/share/bcc/tools/funclatency',
    allowedArgs: ['-p', '-i', '-T', '-u', '-m', '-F', '-r', '-v'],
    allowsNumericArgs: true,
  },

  // Additional BCC tools for new features
  gethostlatency: {
    path: '/usr/share/bcc/tools/gethostlatency',
    allowedArgs: ['-p'],
    allowsNumericArgs: true,
  },
  filelife: {
    path: '/usr/share/bcc/tools/filelife',
    allowedArgs: ['-p'],
    allowsNumericArgs: true,
  },
  fileslower: {
    path: '/usr/share/bcc/tools/fileslower',
    allowedArgs: ['-p', '-a'],
    allowsNumericArgs: true, // min_ms threshold
  },
  bitesize: {
    path: '/usr/share/bcc/tools/bitesize',
    allowedArgs: [],
    allowsNumericArgs: true,
  },
  opensnoop: {
    path: '/usr/share/bcc/tools/opensnoop',
    allowedArgs: ['-T', '-t', '-x', '-p', '-n', '-d', '-e', '-f', '-F'],
    allowsNumericArgs: true,
  },
  vfsstat: {
    path: '/usr/share/bcc/tools/vfsstat',
    allowedArgs: ['-p'],
    allowsNumericArgs: true,
  },
  vfscount: {
    path: '/usr/share/bcc/tools/vfscount',
    allowedArgs: [],
    allowsNumericArgs: true,
  },

  // Fallback: bpftrace for custom one-liners
  bpftrace: {
    path: '/usr/bin/bpftrace',
    allowedArgs: ['-e', '-p', '-c', '-v', '-l', '--unsafe', '-f', 'json'],
    allowsNumericArgs: true,
  },
} as const;

export interface AllowedCommand {
  path: string;
  allowedArgs: readonly string[];
  allowsNumericArgs?: boolean;
}

/**
 * Allowed paths for file reads (procfs, sysfs, cgroup)
 * Patterns use simple string matching for safety
 */
export const ALLOWED_READ_PATHS = {
  procfs: [
    '/proc/stat',
    '/proc/meminfo',
    '/proc/loadavg',
    '/proc/vmstat',
    '/proc/diskstats',
    '/proc/uptime',
    '/proc/version',
    '/proc/cpuinfo',
    '/proc/sys/kernel/perf_event_paranoid',
    '/proc/sys/kernel/hostname',
  ],
  procfsPatterns: [
    /^\/proc\/\d+\/(stat|status|cgroup|io|schedstat|comm|limits)$/,
    /^\/proc\/net\/(dev|snmp|netstat|tcp|udp|sockstat)$/,
    /^\/proc\/pressure\/(cpu|memory|io)$/,
  ],
  sysfs: [
    '/sys/kernel/btf/vmlinux',
  ],
  sysfsPatterns: [
    /^\/sys\/fs\/cgroup(\/[a-zA-Z0-9._-]+)*\/(cpu\.stat|cpu\.max|memory\.current|memory\.max|memory\.stat|memory\.pressure|memory\.events|io\.stat|io\.pressure|pids\.current|pids\.max|cgroup\.controllers)$/,
    /^\/sys\/block\/[a-z]+[0-9]*\/stat$/,
    /^\/sys\/devices\/system\/cpu\/cpu[0-9]+\/cpufreq\/scaling_governor$/,
    /^\/sys\/kernel\/mm\/transparent_hugepage\/(enabled|defrag)$/,
    /^\/sys\/class\/dmi\/id\/(product_name|sys_vendor|chassis_type)$/,
  ],
};

/**
 * Error codes for structured error responses
 */
export enum ErrorCode {
  // Input validation
  INVALID_PARAMS = 'INVALID_PARAMS',
  INVALID_DURATION = 'INVALID_DURATION',
  INVALID_PID = 'INVALID_PID',
  INVALID_PATH = 'INVALID_PATH',

  // Capability errors
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  CAPABILITY_MISSING = 'CAPABILITY_MISSING',
  FEATURE_UNAVAILABLE = 'FEATURE_UNAVAILABLE',

  // Execution errors
  TIMEOUT = 'TIMEOUT',
  EXECUTION_FAILED = 'EXECUTION_FAILED',
  PARSE_ERROR = 'PARSE_ERROR',

  // Resource errors
  OUTPUT_TRUNCATED = 'OUTPUT_TRUNCATED',
  PROFILER_BUSY = 'PROFILER_BUSY',

  // System errors
  CGROUP_NOT_FOUND = 'CGROUP_NOT_FOUND',
  DEVICE_NOT_FOUND = 'DEVICE_NOT_FOUND',
  PID_NOT_FOUND = 'PID_NOT_FOUND',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
}

/**
 * Common error suggestions
 */
export const ERROR_SUGGESTIONS: Record<ErrorCode, string> = {
  [ErrorCode.INVALID_PARAMS]: 'Check parameter types and constraints',
  [ErrorCode.INVALID_DURATION]: `Duration must be between ${DURATION_LIMITS.MIN} and ${DURATION_LIMITS.MAX} seconds`,
  [ErrorCode.INVALID_PID]: 'Provide a valid positive integer PID',
  [ErrorCode.INVALID_PATH]: 'Path must be within allowed procfs/sysfs locations',
  [ErrorCode.TOOL_NOT_FOUND]: 'Install required package (e.g., linux-tools-generic, sysstat)',
  [ErrorCode.PERMISSION_DENIED]: 'Run as root or grant required capabilities (CAP_PERFMON, CAP_BPF)',
  [ErrorCode.CAPABILITY_MISSING]: 'Grant capability or adjust perf_event_paranoid setting',
  [ErrorCode.FEATURE_UNAVAILABLE]: 'Feature not supported on this kernel version',
  [ErrorCode.TIMEOUT]: 'Operation timed out - try shorter duration or simpler query',
  [ErrorCode.EXECUTION_FAILED]: 'Command execution failed - check system logs',
  [ErrorCode.PARSE_ERROR]: 'Failed to parse output - format may have changed',
  [ErrorCode.OUTPUT_TRUNCATED]: 'Output exceeded size limit and was truncated',
  [ErrorCode.PROFILER_BUSY]: 'Another profiler is running - wait for it to complete',
  [ErrorCode.CGROUP_NOT_FOUND]: 'Cgroup path not found - verify container/cgroup exists',
  [ErrorCode.DEVICE_NOT_FOUND]: 'Device not found - check device name',
  [ErrorCode.PID_NOT_FOUND]: 'Process not found - may have exited',
  [ErrorCode.FILE_NOT_FOUND]: 'File not found at specified path',
};

/**
 * Artifact storage configuration
 */
export const ARTIFACT_CONFIG = {
  baseDir: '/tmp/perf-mcp/artifacts',
  maxAge: 3600, // 1 hour TTL
  maxSize: 10 * 1024 * 1024, // 10MB max per artifact
} as const;
