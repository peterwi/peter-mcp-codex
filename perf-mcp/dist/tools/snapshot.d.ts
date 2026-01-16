/**
 * perf_snapshot tool - Point-in-time system metrics
 * Supports both single snapshot and interval mode for time-series data
 */
import { z } from 'zod';
import type { PerfSnapshotData, PerfResponse } from '../lib/schemas.js';
export declare const SnapshotInputSchema: z.ZodObject<{
    include_per_cpu: z.ZodDefault<z.ZodBoolean>;
    include_per_device: z.ZodDefault<z.ZodBoolean>;
    include_psi: z.ZodDefault<z.ZodBoolean>;
    interval_sec: z.ZodOptional<z.ZodNumber>;
    count: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    include_per_cpu: boolean;
    include_per_device: boolean;
    include_psi: boolean;
    count: number;
    interval_sec?: number | undefined;
}, {
    include_per_cpu?: boolean | undefined;
    include_per_device?: boolean | undefined;
    include_psi?: boolean | undefined;
    interval_sec?: number | undefined;
    count?: number | undefined;
}>;
export type SnapshotInput = z.infer<typeof SnapshotInputSchema>;
export type SnapshotRawInput = z.input<typeof SnapshotInputSchema>;
interface SnapshotOptions {
    include_per_cpu?: boolean;
    include_per_device?: boolean;
    include_psi?: boolean;
    interval_sec?: number;
    count?: number;
}
export interface IntervalSnapshotData {
    mode: 'interval';
    interval_sec: number;
    samples: Array<{
        timestamp: string;
        sample_index: number;
        data: PerfSnapshotData;
    }>;
    summary: {
        total_samples: number;
        duration_seconds: number;
        cpu_avg_utilization: number;
        memory_avg_used_percent: number;
    };
}
export declare function perfSnapshot(options?: SnapshotOptions): Promise<PerfResponse<PerfSnapshotData | IntervalSnapshotData>>;
export {};
//# sourceMappingURL=snapshot.d.ts.map