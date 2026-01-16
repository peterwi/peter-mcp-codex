/**
 * perf_triage tool
 * High-level incident triage tool that runs multiple analyses
 * and produces a consolidated report with root cause analysis
 */
import { z } from 'zod';
import { type Finding, type Evidence, type FindingSeverity } from '../lib/output-schema.js';
import type { PerfResponse } from '../lib/schemas.js';
export declare const TriageInputSchema: z.ZodObject<{
    pid: z.ZodOptional<z.ZodNumber>;
    process_name: z.ZodOptional<z.ZodString>;
    mode: z.ZodDefault<z.ZodEnum<["quick", "standard", "deep"]>>;
    include_exec_trace: z.ZodDefault<z.ZodBoolean>;
    focus: z.ZodDefault<z.ZodEnum<["auto", "cpu", "memory", "io", "network"]>>;
}, "strip", z.ZodTypeAny, {
    mode: "quick" | "standard" | "deep";
    include_exec_trace: boolean;
    focus: "network" | "memory" | "cpu" | "io" | "auto";
    pid?: number | undefined;
    process_name?: string | undefined;
}, {
    pid?: number | undefined;
    mode?: "quick" | "standard" | "deep" | undefined;
    process_name?: string | undefined;
    include_exec_trace?: boolean | undefined;
    focus?: "network" | "memory" | "cpu" | "io" | "auto" | undefined;
}>;
export type TriageInput = z.infer<typeof TriageInputSchema>;
export type TriageRawInput = z.input<typeof TriageInputSchema>;
/**
 * Root cause hypothesis with supporting evidence
 */
interface RootCauseHypothesis {
    id: string;
    title: string;
    description: string;
    category: 'cpu' | 'memory' | 'io' | 'network' | 'process' | 'system';
    confidence: number;
    severity: FindingSeverity;
    supportingFindings: string[];
    suggestedActions: string[];
}
/**
 * Consolidated triage report
 */
export interface TriageReport {
    target: {
        pid?: number;
        process_name?: string;
        scope: 'process' | 'system-wide';
    };
    mode: 'quick' | 'standard' | 'deep';
    duration_seconds: number;
    tools_executed: string[];
    tools_failed: string[];
    root_causes: RootCauseHypothesis[];
    all_findings: Finding[];
    key_evidence: Evidence[];
    metrics_summary: {
        cpu?: {
            utilization_pct: number;
            user_pct: number;
            system_pct: number;
            load_avg_1m: number;
        };
        memory?: {
            used_pct: number;
            available_mb: number;
            swap_used_pct: number;
        };
        io?: {
            avg_await_ms?: number;
            iops?: number;
            throughput_mbps?: number;
        };
        syscalls?: {
            total_count: number;
            rate_per_sec: number;
            top_syscall: string;
        };
    };
    executive_summary: string;
    recommended_actions: string[];
    tool_results: Record<string, unknown>;
    warnings: string[];
}
export declare function perfTriage(input?: TriageRawInput): Promise<PerfResponse<TriageReport>>;
export {};
//# sourceMappingURL=triage.d.ts.map