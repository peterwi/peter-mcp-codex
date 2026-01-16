/**
 * perf_fd_trace tool
 * File descriptor usage and leak detection
 * Monitors FD counts over time to identify potential leaks
 * Works without BCC - uses procfs only
 */
import { z } from 'zod';
import type { PerfResponse } from '../lib/schemas.js';
export declare const FdTraceInputSchema: z.ZodObject<{
    pid: z.ZodNumber;
    duration_seconds: z.ZodDefault<z.ZodNumber>;
    interval_sec: z.ZodDefault<z.ZodNumber>;
    include_fd_list: z.ZodDefault<z.ZodBoolean>;
    max_fds_listed: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    duration_seconds: number;
    pid: number;
    interval_sec: number;
    include_fd_list: boolean;
    max_fds_listed: number;
}, {
    pid: number;
    duration_seconds?: number | undefined;
    interval_sec?: number | undefined;
    include_fd_list?: boolean | undefined;
    max_fds_listed?: number | undefined;
}>;
export type FdTraceInput = z.infer<typeof FdTraceInputSchema>;
export type FdTraceRawInput = z.input<typeof FdTraceInputSchema>;
export interface FdInfo {
    fd: number;
    type: 'file' | 'socket' | 'pipe' | 'eventfd' | 'timerfd' | 'signalfd' | 'epoll' | 'anon_inode' | 'device' | 'unknown';
    target: string;
}
export interface FdSample {
    timestamp: string;
    total_fds: number;
    by_type: Record<string, number>;
}
export interface FdTraceData {
    pid: number;
    process_name: string;
    duration_seconds: number;
    samples: FdSample[];
    current: {
        total_fds: number;
        soft_limit: number;
        hard_limit: number;
        usage_percent: number;
        by_type: Record<string, number>;
    };
    leak_detection: {
        fd_growth_rate: number;
        is_likely_leak: boolean;
        fd_change: number;
        interpretation: string;
    };
    fd_list?: FdInfo[];
    notes: string[];
}
export declare function perfFdTrace(input: FdTraceRawInput): Promise<PerfResponse<FdTraceData>>;
//# sourceMappingURL=fd-trace.d.ts.map