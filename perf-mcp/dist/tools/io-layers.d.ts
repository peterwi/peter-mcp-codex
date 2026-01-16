/**
 * perf_io_layers tool
 * VFS vs block I/O ratio measurement
 * Shows how much file system activity reaches the block layer
 */
import { z } from 'zod';
import type { PerfResponse } from '../lib/schemas.js';
export declare const IoLayersInputSchema: z.ZodObject<{
    duration_seconds: z.ZodDefault<z.ZodNumber>;
    include_details: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    duration_seconds: number;
    include_details: boolean;
}, {
    duration_seconds?: number | undefined;
    include_details?: boolean | undefined;
}>;
export type IoLayersInput = z.infer<typeof IoLayersInputSchema>;
export type IoLayersRawInput = z.input<typeof IoLayersInputSchema>;
export interface IoLayersData {
    method: string;
    duration_seconds: number;
    vfs: {
        total_ops: number;
        reads_per_sec: number;
        writes_per_sec: number;
        fsyncs_per_sec: number;
        opens_per_sec: number;
        creates_per_sec: number;
        unlinks_per_sec: number;
    };
    block: {
        total_ios: number;
        reads_per_sec: number;
        writes_per_sec: number;
    };
    ratios: {
        vfs_to_block: number;
        read_hit_rate: number;
        write_coalesce_rate: number;
    };
    analysis: {
        cache_effectiveness: 'excellent' | 'good' | 'fair' | 'poor';
        interpretation: string;
    };
    notes: string[];
}
export declare function perfIoLayers(input?: IoLayersRawInput): Promise<PerfResponse<IoLayersData>>;
//# sourceMappingURL=io-layers.d.ts.map