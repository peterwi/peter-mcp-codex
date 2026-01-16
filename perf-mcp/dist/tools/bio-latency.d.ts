/**
 * perf_bio_latency tool
 * Block I/O latency histogram using BCC biolatency or bpftrace
 * Shows distribution of storage I/O latencies
 * Supports both log2 (default) and linear histogram modes
 */
import { z } from 'zod';
import type { PerfResponse } from '../lib/schemas.js';
export declare const BioLatencyInputSchema: z.ZodObject<{
    duration_seconds: z.ZodDefault<z.ZodNumber>;
    device: z.ZodOptional<z.ZodString>;
    per_device: z.ZodDefault<z.ZodBoolean>;
    queued: z.ZodDefault<z.ZodBoolean>;
    milliseconds: z.ZodDefault<z.ZodBoolean>;
    histogram_type: z.ZodDefault<z.ZodEnum<["log2", "linear"]>>;
    linear_bucket_ms: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    duration_seconds: number;
    per_device: boolean;
    queued: boolean;
    milliseconds: boolean;
    histogram_type: "log2" | "linear";
    linear_bucket_ms: number;
    device?: string | undefined;
}, {
    duration_seconds?: number | undefined;
    device?: string | undefined;
    per_device?: boolean | undefined;
    queued?: boolean | undefined;
    milliseconds?: boolean | undefined;
    histogram_type?: "log2" | "linear" | undefined;
    linear_bucket_ms?: number | undefined;
}>;
export type BioLatencyInput = z.infer<typeof BioLatencyInputSchema>;
export type BioLatencyRawInput = z.input<typeof BioLatencyInputSchema>;
export interface BioLatencyData {
    method: 'bcc_biolatency' | 'bpftrace_linear' | 'iostat_fallback';
    histogram_type: 'log2' | 'linear';
    bucket_size_ms?: number;
    duration_seconds: number;
    device?: string;
    histogram: Array<{
        range_start_us: number;
        range_end_us: number;
        count: number;
        bar: string;
    }>;
    summary: {
        total_ios: number;
        avg_latency_us: number;
        p50_us: number;
        p99_us: number;
        max_latency_us: number;
    };
    per_device?: Record<string, {
        total_ios: number;
        avg_latency_us: number;
    }>;
    notes: string[];
}
export declare function perfBioLatency(input?: BioLatencyRawInput): Promise<PerfResponse<BioLatencyData>>;
//# sourceMappingURL=bio-latency.d.ts.map