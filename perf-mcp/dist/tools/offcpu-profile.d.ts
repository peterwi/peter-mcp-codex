/**
 * perf_offcpu_profile tool
 * Off-CPU analysis using BCC offcputime or perf sched
 * Shows where processes are blocking/sleeping
 */
import { z } from 'zod';
import type { PerfResponse } from '../lib/schemas.js';
export declare const OffcpuProfileInputSchema: z.ZodObject<{
    duration_seconds: z.ZodDefault<z.ZodNumber>;
    pid: z.ZodOptional<z.ZodNumber>;
    min_block_us: z.ZodDefault<z.ZodNumber>;
    kernel_stacks: z.ZodDefault<z.ZodBoolean>;
    user_stacks: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    duration_seconds: number;
    min_block_us: number;
    kernel_stacks: boolean;
    user_stacks: boolean;
    pid?: number | undefined;
}, {
    duration_seconds?: number | undefined;
    pid?: number | undefined;
    min_block_us?: number | undefined;
    kernel_stacks?: boolean | undefined;
    user_stacks?: boolean | undefined;
}>;
export type OffcpuProfileInput = z.infer<typeof OffcpuProfileInputSchema>;
export type OffcpuProfileRawInput = z.input<typeof OffcpuProfileInputSchema>;
export interface OffcpuProfileData {
    method: 'bcc_offcputime' | 'perf_sched';
    duration_seconds: number;
    pid?: number;
    total_blocked_us: number;
    total_blocked_ms: number;
    top_blockers: Array<{
        function: string;
        blocked_us: number;
        blocked_ms: number;
        percent: number;
    }>;
    sample_stacks?: Array<{
        stack: string[];
        blocked_us: number;
    }>;
    notes: string[];
}
export declare function perfOffcpuProfile(input?: OffcpuProfileRawInput): Promise<PerfResponse<OffcpuProfileData>>;
//# sourceMappingURL=offcpu-profile.d.ts.map