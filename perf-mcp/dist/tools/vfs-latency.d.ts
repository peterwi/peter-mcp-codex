/**
 * perf_vfs_latency tool
 * VFS (Virtual File System) layer latency distribution
 * Shows which file operations are slow and their latency distribution
 */
import { z } from 'zod';
import type { PerfResponse } from '../lib/schemas.js';
export declare const VfsLatencyInputSchema: z.ZodObject<{
    duration_seconds: z.ZodDefault<z.ZodNumber>;
    min_latency_ms: z.ZodDefault<z.ZodNumber>;
    pid: z.ZodOptional<z.ZodNumber>;
    include_all_files: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    duration_seconds: number;
    min_latency_ms: number;
    include_all_files: boolean;
    pid?: number | undefined;
}, {
    duration_seconds?: number | undefined;
    pid?: number | undefined;
    min_latency_ms?: number | undefined;
    include_all_files?: boolean | undefined;
}>;
export type VfsLatencyInput = z.infer<typeof VfsLatencyInputSchema>;
export type VfsLatencyRawInput = z.input<typeof VfsLatencyInputSchema>;
export interface VfsOperation {
    timestamp: number;
    process: string;
    pid: number;
    operation: 'R' | 'W';
    bytes: number;
    latency_ms: number;
    filename: string;
}
export interface VfsLatencyData {
    method: 'bcc_fileslower' | 'bpftrace';
    duration_seconds: number;
    min_latency_ms: number;
    operations: VfsOperation[];
    summary: {
        total_slow_ops: number;
        read_ops: number;
        write_ops: number;
        avg_latency_ms: number;
        p50_latency_ms: number;
        p95_latency_ms: number;
        p99_latency_ms: number;
        max_latency_ms: number;
        total_bytes: number;
    };
    by_file: Array<{
        filename: string;
        count: number;
        avg_latency_ms: number;
        total_bytes: number;
    }>;
    by_process: Array<{
        process: string;
        pid: number;
        count: number;
        avg_latency_ms: number;
    }>;
    notes: string[];
}
export declare function perfVfsLatency(input?: VfsLatencyRawInput): Promise<PerfResponse<VfsLatencyData>>;
//# sourceMappingURL=vfs-latency.d.ts.map