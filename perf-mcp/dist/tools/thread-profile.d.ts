/**
 * perf_thread_profile tool
 * Per-thread CPU analysis using pidstat and optionally offcputime
 */
import { z } from 'zod';
import type { PerfResponse } from '../lib/schemas.js';
export declare const ThreadProfileInputSchema: z.ZodObject<{
    pid: z.ZodNumber;
    duration_seconds: z.ZodDefault<z.ZodNumber>;
    include_offcpu: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    duration_seconds: number;
    pid: number;
    include_offcpu: boolean;
}, {
    pid: number;
    duration_seconds?: number | undefined;
    include_offcpu?: boolean | undefined;
}>;
export type ThreadProfileInput = z.infer<typeof ThreadProfileInputSchema>;
export type ThreadProfileRawInput = z.input<typeof ThreadProfileInputSchema>;
export interface ThreadState {
    tid: number;
    name: string;
    state: 'R' | 'S' | 'D' | 'Z' | 'T' | 'X' | 'unknown';
    cpu_user_percent: number;
    cpu_system_percent: number;
    cpu_total_percent: number;
    voluntary_ctx_switches?: number;
    involuntary_ctx_switches?: number;
    offcpu_time_us?: number;
    offcpu_percent?: number;
}
export interface ThreadProfileData {
    method: string;
    pid: number;
    process_name: string;
    duration_seconds: number;
    threads: ThreadState[];
    process_total: {
        cpu_user_percent: number;
        cpu_system_percent: number;
        cpu_total_percent: number;
        total_threads: number;
        running_threads: number;
        blocked_threads: number;
    };
    offcpu_summary?: {
        total_offcpu_us: number;
        top_blockers: Array<{
            function: string;
            total_us: number;
            percent: number;
        }>;
    };
    notes: string[];
}
export declare function perfThreadProfile(input: ThreadProfileRawInput): Promise<PerfResponse<ThreadProfileData>>;
//# sourceMappingURL=thread-profile.d.ts.map