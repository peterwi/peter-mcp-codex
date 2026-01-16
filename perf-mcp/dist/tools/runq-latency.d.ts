/**
 * perf_runq_latency tool
 * Run queue (scheduler) latency histogram using BCC runqlat
 * Shows how long tasks wait to be scheduled onto a CPU
 */
import { z } from 'zod';
import type { PerfResponse } from '../lib/schemas.js';
export declare const RunqLatencyInputSchema: z.ZodObject<{
    duration_seconds: z.ZodDefault<z.ZodNumber>;
    pid: z.ZodOptional<z.ZodNumber>;
    per_process: z.ZodDefault<z.ZodBoolean>;
    per_pidns: z.ZodDefault<z.ZodBoolean>;
    milliseconds: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    duration_seconds: number;
    milliseconds: boolean;
    per_process: boolean;
    per_pidns: boolean;
    pid?: number | undefined;
}, {
    duration_seconds?: number | undefined;
    pid?: number | undefined;
    milliseconds?: boolean | undefined;
    per_process?: boolean | undefined;
    per_pidns?: boolean | undefined;
}>;
export type RunqLatencyInput = z.infer<typeof RunqLatencyInputSchema>;
export type RunqLatencyRawInput = z.input<typeof RunqLatencyInputSchema>;
export interface RunqLatencyData {
    method: 'bcc_runqlat' | 'perf_sched';
    duration_seconds: number;
    pid?: number;
    histogram: Array<{
        range_start_us: number;
        range_end_us: number;
        count: number;
        bar: string;
    }>;
    summary: {
        total_wakeups: number;
        avg_latency_us: number;
        p50_us: number;
        p99_us: number;
        max_latency_us: number;
    };
    interpretation: {
        status: 'healthy' | 'warning' | 'critical';
        detail: string;
    };
    notes: string[];
}
export declare function perfRunqLatency(input?: RunqLatencyRawInput): Promise<PerfResponse<RunqLatencyData>>;
//# sourceMappingURL=runq-latency.d.ts.map