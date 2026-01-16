/**
 * perf_exec_trace tool
 * Trace process creation (fork/clone) and exec events
 * Supports BCC execsnoop and bpftrace-based comprehensive tracing
 */
import { z } from 'zod';
import type { PerfResponse } from '../lib/schemas.js';
/**
 * Output mode for trace data
 */
export declare const TraceModeSchema: z.ZodEnum<["events", "tree", "both"]>;
export type TraceMode = z.infer<typeof TraceModeSchema>;
export declare const ExecTraceInputSchema: z.ZodObject<{
    duration_seconds: z.ZodDefault<z.ZodNumber>;
    pid: z.ZodOptional<z.ZodNumber>;
    name_pattern: z.ZodOptional<z.ZodString>;
    uid: z.ZodOptional<z.ZodNumber>;
    include_failed: z.ZodDefault<z.ZodBoolean>;
    max_args: z.ZodDefault<z.ZodNumber>;
    include_timestamps: z.ZodDefault<z.ZodBoolean>;
    include_fork_clone: z.ZodDefault<z.ZodBoolean>;
    include_exec: z.ZodDefault<z.ZodBoolean>;
    include_exit: z.ZodDefault<z.ZodBoolean>;
    mode: z.ZodDefault<z.ZodEnum<["events", "tree", "both"]>>;
}, "strip", z.ZodTypeAny, {
    duration_seconds: number;
    mode: "events" | "tree" | "both";
    include_failed: boolean;
    max_args: number;
    include_timestamps: boolean;
    include_fork_clone: boolean;
    include_exec: boolean;
    include_exit: boolean;
    pid?: number | undefined;
    name_pattern?: string | undefined;
    uid?: number | undefined;
}, {
    duration_seconds?: number | undefined;
    pid?: number | undefined;
    mode?: "events" | "tree" | "both" | undefined;
    name_pattern?: string | undefined;
    uid?: number | undefined;
    include_failed?: boolean | undefined;
    max_args?: number | undefined;
    include_timestamps?: boolean | undefined;
    include_fork_clone?: boolean | undefined;
    include_exec?: boolean | undefined;
    include_exit?: boolean | undefined;
}>;
export type ExecTraceInput = z.infer<typeof ExecTraceInputSchema>;
export type ExecTraceRawInput = z.input<typeof ExecTraceInputSchema>;
/**
 * Event types for comprehensive process tracing
 */
export type ProcessEventType = 'fork' | 'exec' | 'exit';
export interface ProcessEvent {
    timestamp_ms: number;
    event_type: ProcessEventType;
    pid: number;
    ppid?: number;
    comm: string;
    child_pid?: number;
    child_comm?: string;
    filename?: string;
    args?: string;
    return_code?: number;
    exit_code?: number;
}
export interface ProcessRelationship {
    parent_pid: number;
    parent_comm: string;
    child_pid: number;
    child_comm: string;
    event_type: 'fork' | 'exec';
}
export interface ProcessTreeNode {
    pid: number;
    comm: string;
    children: ProcessTreeNode[];
    exec_count: number;
    exited: boolean;
}
export interface ExecEvent {
    timestamp?: string;
    parent_comm: string;
    pid: number;
    ppid: number;
    return_code: number;
    command: string;
    args: string;
}
export interface ExecTraceData {
    method: 'bcc_execsnoop' | 'bpftrace_comprehensive';
    duration_seconds: number;
    filters?: {
        pid?: number;
        name_pattern?: string;
        uid?: number;
        failed_only?: boolean;
    };
    process_events?: ProcessEvent[];
    relationships?: ProcessRelationship[];
    tree?: ProcessTreeNode[];
    events?: ExecEvent[];
    summary: {
        total_execs: number;
        unique_commands: number;
        exec_rate_per_sec: number;
        failed_execs: number;
        by_command: Record<string, number>;
        by_parent: Record<string, number>;
        total_forks?: number;
        total_exits?: number;
        fork_rate_per_sec?: number;
        max_tree_depth?: number;
    };
    truncated: boolean;
    notes: string[];
}
export declare function perfExecTrace(input?: ExecTraceRawInput): Promise<PerfResponse<ExecTraceData>>;
//# sourceMappingURL=exec-trace.d.ts.map