/**
 * Constants and allowlists for perf-mcp
 * Safety-critical: These define what can be executed
 */
export declare const TOOL_VERSION = "1.0.0";
export declare const TIMEOUTS: {
    readonly DEFAULT: 15000;
    readonly SNAPSHOT: 10000;
    readonly PROFILE: 60000;
    readonly TRACE: 30000;
    readonly INFO: 5000;
    readonly BCC_FIRST_RUN: 45000;
    readonly BCC_WARM: 10000;
    readonly BCC_WARMUP: 60000;
    readonly BPFTRACE_COMPILE: 20000;
};
export declare const OUTPUT_LIMITS: {
    readonly DEFAULT: number;
    readonly PROFILE: number;
    readonly MAX: number;
};
export declare const DURATION_LIMITS: {
    readonly MIN: 1;
    readonly DEFAULT: 5;
    readonly MAX: 60;
};
export declare const SAMPLE_RATE_LIMITS: {
    readonly MIN: 1;
    readonly DEFAULT: 99;
    readonly MAX: 999;
};
export declare const USE_THRESHOLDS: {
    readonly cpu: {
        readonly utilization: {
            readonly warning: 70;
            readonly critical: 90;
        };
        readonly runQueue: {
            readonly warningMultiplier: 1;
            readonly criticalMultiplier: 2;
        };
    };
    readonly memory: {
        readonly availablePercent: {
            readonly warning: 20;
            readonly critical: 10;
        };
        readonly swapUsedPercent: {
            readonly warning: 10;
            readonly critical: 50;
        };
    };
    readonly disk: {
        readonly utilization: {
            readonly warning: 60;
            readonly critical: 80;
        };
        readonly avgQueue: {
            readonly warning: 2;
            readonly critical: 8;
        };
        readonly awaitMs: {
            readonly warning: 20;
            readonly critical: 50;
        };
    };
    readonly network: {
        readonly dropsPerSec: {
            readonly warning: 1;
            readonly critical: 100;
        };
        readonly retransmitPercent: {
            readonly warning: 1;
            readonly critical: 5;
        };
    };
    readonly psi: {
        readonly someAvg10: {
            readonly warning: 10;
            readonly critical: 25;
        };
        readonly fullAvg10: {
            readonly warning: 5;
            readonly critical: 15;
        };
    };
};
/**
 * Allowed executables and their permitted arguments
 * This is the CRITICAL safety boundary - nothing outside this list can be executed
 */
export declare const ALLOWED_EXECUTABLES: Record<string, AllowedCommand>;
export interface AllowedCommand {
    path: string;
    allowedArgs: readonly string[];
    allowsNumericArgs?: boolean;
}
/**
 * Allowed paths for file reads (procfs, sysfs, cgroup)
 * Patterns use simple string matching for safety
 */
export declare const ALLOWED_READ_PATHS: {
    procfs: string[];
    procfsPatterns: RegExp[];
    sysfs: string[];
    sysfsPatterns: RegExp[];
};
/**
 * Error codes for structured error responses
 */
export declare enum ErrorCode {
    INVALID_PARAMS = "INVALID_PARAMS",
    INVALID_DURATION = "INVALID_DURATION",
    INVALID_PID = "INVALID_PID",
    INVALID_PATH = "INVALID_PATH",
    TOOL_NOT_FOUND = "TOOL_NOT_FOUND",
    PERMISSION_DENIED = "PERMISSION_DENIED",
    CAPABILITY_MISSING = "CAPABILITY_MISSING",
    FEATURE_UNAVAILABLE = "FEATURE_UNAVAILABLE",
    TIMEOUT = "TIMEOUT",
    EXECUTION_FAILED = "EXECUTION_FAILED",
    PARSE_ERROR = "PARSE_ERROR",
    OUTPUT_TRUNCATED = "OUTPUT_TRUNCATED",
    PROFILER_BUSY = "PROFILER_BUSY",
    CGROUP_NOT_FOUND = "CGROUP_NOT_FOUND",
    DEVICE_NOT_FOUND = "DEVICE_NOT_FOUND",
    PID_NOT_FOUND = "PID_NOT_FOUND",
    FILE_NOT_FOUND = "FILE_NOT_FOUND"
}
/**
 * Common error suggestions
 */
export declare const ERROR_SUGGESTIONS: Record<ErrorCode, string>;
/**
 * Artifact storage configuration
 */
export declare const ARTIFACT_CONFIG: {
    readonly baseDir: "/tmp/perf-mcp/artifacts";
    readonly maxAge: 3600;
    readonly maxSize: number;
};
//# sourceMappingURL=constants.d.ts.map