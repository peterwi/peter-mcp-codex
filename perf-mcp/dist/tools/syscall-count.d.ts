/**
 * perf_syscall_count tool
 * Count syscalls per process with latency distribution using BCC syscount
 * With bpftrace fallback for improved reliability
 */
import { z } from 'zod';
import { type Finding, type Evidence } from '../lib/output-schema.js';
import type { PerfResponse } from '../lib/schemas.js';
export declare const SyscallCountInputSchema: z.ZodObject<{
    duration_seconds: z.ZodDefault<z.ZodNumber>;
    pid: z.ZodOptional<z.ZodNumber>;
    comm: z.ZodOptional<z.ZodString>;
    top_n: z.ZodDefault<z.ZodNumber>;
    include_latency: z.ZodDefault<z.ZodBoolean>;
    per_process: z.ZodDefault<z.ZodBoolean>;
    include_errors: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    duration_seconds: number;
    per_process: boolean;
    top_n: number;
    include_latency: boolean;
    include_errors: boolean;
    pid?: number | undefined;
    comm?: string | undefined;
}, {
    duration_seconds?: number | undefined;
    pid?: number | undefined;
    comm?: string | undefined;
    per_process?: boolean | undefined;
    top_n?: number | undefined;
    include_latency?: boolean | undefined;
    include_errors?: boolean | undefined;
}>;
export type SyscallCountInput = z.infer<typeof SyscallCountInputSchema>;
export type SyscallCountRawInput = z.input<typeof SyscallCountInputSchema>;
export interface SyscallEntry {
    name: string;
    count: number;
    rate_per_sec: number;
    latency?: {
        total_us: number;
        avg_us: number;
    };
    errors?: number;
}
export interface SyscallCountData {
    method: 'bcc_syscount' | 'bpftrace_fallback';
    duration_seconds: number;
    target?: string;
    syscalls: SyscallEntry[];
    summary: {
        total_syscalls: number;
        total_latency_us?: number;
        unique_syscalls: number;
        top_by_count: string[];
        top_by_latency?: string[];
    };
    findings: Finding[];
    evidence: Evidence[];
    notes: string[];
}
export declare function perfSyscallCount(input?: SyscallCountRawInput): Promise<PerfResponse<SyscallCountData>>;
//# sourceMappingURL=syscall-count.d.ts.map