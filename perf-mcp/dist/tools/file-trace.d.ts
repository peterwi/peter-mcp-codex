/**
 * perf_file_trace tool
 * Trace file operations using BCC tools (fileslower, filelife, opensnoop)
 */
import { z } from 'zod';
import type { PerfResponse } from '../lib/schemas.js';
export declare const FileTraceInputSchema: z.ZodObject<{
    duration_seconds: z.ZodDefault<z.ZodNumber>;
    pid: z.ZodOptional<z.ZodNumber>;
    min_latency_ms: z.ZodDefault<z.ZodNumber>;
    mode: z.ZodDefault<z.ZodEnum<["slow_ops", "file_lifecycle", "opens", "all"]>>;
    include_all_files: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    duration_seconds: number;
    mode: "slow_ops" | "file_lifecycle" | "opens" | "all";
    min_latency_ms: number;
    include_all_files: boolean;
    pid?: number | undefined;
}, {
    duration_seconds?: number | undefined;
    pid?: number | undefined;
    mode?: "slow_ops" | "file_lifecycle" | "opens" | "all" | undefined;
    min_latency_ms?: number | undefined;
    include_all_files?: boolean | undefined;
}>;
export type FileTraceInput = z.infer<typeof FileTraceInputSchema>;
export type FileTraceRawInput = z.input<typeof FileTraceInputSchema>;
export interface SlowFileOp {
    timestamp: number;
    pid: number;
    comm: string;
    direction: 'R' | 'W';
    bytes: number;
    latency_ms: number;
    filename: string;
}
export interface ShortLivedFile {
    timestamp: string;
    pid: number;
    comm: string;
    age_seconds: number;
    filename: string;
}
export interface FileOpen {
    timestamp?: string;
    pid: number;
    comm: string;
    fd: number;
    error: number;
    path: string;
    failed: boolean;
}
export interface FileTraceData {
    method: string;
    duration_seconds: number;
    filters?: {
        pid?: number;
        min_latency_ms?: number;
    };
    slow_ops?: {
        operations: SlowFileOp[];
        summary: {
            total_ops: number;
            avg_latency_ms: number;
            p95_latency_ms: number;
            max_latency_ms: number;
            read_ops: number;
            write_ops: number;
            by_file: Record<string, {
                count: number;
                avg_latency_ms: number;
            }>;
            by_process: Record<string, {
                count: number;
                avg_latency_ms: number;
            }>;
        };
    };
    file_lifecycle?: {
        files: ShortLivedFile[];
        summary: {
            total_files: number;
            avg_age_seconds: number;
            short_lived_count: number;
            by_process: Record<string, number>;
        };
    };
    opens?: {
        operations: FileOpen[];
        summary: {
            total_opens: number;
            failed_opens: number;
            by_process: Record<string, number>;
            by_path: Record<string, number>;
        };
    };
    truncated: boolean;
    notes: string[];
}
export declare function perfFileTrace(input?: FileTraceRawInput): Promise<PerfResponse<FileTraceData>>;
//# sourceMappingURL=file-trace.d.ts.map