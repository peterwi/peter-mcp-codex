/**
 * Standardized Output Schema
 * Defines consistent structure for all perf-mcp tool outputs
 */
import { z } from 'zod';
/**
 * Severity levels for findings
 */
export type FindingSeverity = 'critical' | 'warning' | 'info' | 'ok';
/**
 * A finding represents a discovered issue or observation
 */
export interface Finding {
    /** Unique identifier for this type of finding */
    id: string;
    /** Severity level */
    severity: FindingSeverity;
    /** Human-readable title */
    title: string;
    /** Detailed description */
    description: string;
    /** Category (cpu, memory, io, network, process, etc.) */
    category: string;
    /** Confidence score 0-100 */
    confidence: number;
    /** Related metric values */
    metrics?: Record<string, number | string>;
    /** Suggested remediation */
    suggestion?: string;
}
/**
 * Evidence supporting a finding
 */
export interface Evidence {
    /** Source tool that provided this evidence */
    source: string;
    /** Type of evidence (metric, trace, profile, etc.) */
    type: 'metric' | 'trace' | 'profile' | 'log' | 'sample';
    /** Timestamp when collected */
    timestamp: string;
    /** Key-value data */
    data: Record<string, unknown>;
    /** Reference to raw data location if available */
    rawRef?: string;
}
/**
 * Standardized tool output wrapper
 */
export interface StandardOutput<T = unknown> {
    /** Tool name */
    tool: string;
    /** Tool version */
    version: string;
    /** Execution timestamp */
    timestamp: string;
    /** Host where tool was executed */
    host: string;
    /** Execution duration in milliseconds */
    durationMs: number;
    /** Whether execution succeeded */
    success: boolean;
    /** Input parameters used */
    params: Record<string, unknown>;
    /** Findings from analysis */
    findings: Finding[];
    /** Evidence supporting findings */
    evidence: Evidence[];
    /** Raw data from tool (tool-specific) */
    data: T;
    /** Human-readable summary */
    summary: string;
    /** Warnings encountered */
    warnings: string[];
    /** Error details if failed */
    error?: {
        code: string;
        message: string;
        suggestion?: string;
    };
}
/**
 * Create standardized output wrapper
 */
export declare function createStandardOutput<T>(tool: string, params: Record<string, unknown>, data: T, options: {
    success: boolean;
    durationMs: number;
    findings?: Finding[];
    evidence?: Evidence[];
    summary?: string;
    warnings?: string[];
    error?: {
        code: string;
        message: string;
        suggestion?: string;
    };
}): StandardOutput<T>;
/**
 * Create a finding
 */
export declare function createFinding(id: string, severity: FindingSeverity, title: string, description: string, category: string, options?: {
    confidence?: number;
    metrics?: Record<string, number | string>;
    suggestion?: string;
}): Finding;
/**
 * Create evidence
 */
export declare function createEvidence(source: string, type: Evidence['type'], data: Record<string, unknown>, rawRef?: string): Evidence;
/**
 * Generate human-readable summary from findings
 */
export declare function generateSummary(findings: Finding[]): string;
/**
 * Zod schema for validation
 */
export declare const FindingSchema: z.ZodObject<{
    id: z.ZodString;
    severity: z.ZodEnum<["critical", "warning", "info", "ok"]>;
    title: z.ZodString;
    description: z.ZodString;
    category: z.ZodString;
    confidence: z.ZodNumber;
    metrics: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodNumber, z.ZodString]>>>;
    suggestion: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    severity: "ok" | "warning" | "critical" | "info";
    title: string;
    description: string;
    category: string;
    confidence: number;
    suggestion?: string | undefined;
    metrics?: Record<string, string | number> | undefined;
}, {
    id: string;
    severity: "ok" | "warning" | "critical" | "info";
    title: string;
    description: string;
    category: string;
    confidence: number;
    suggestion?: string | undefined;
    metrics?: Record<string, string | number> | undefined;
}>;
export declare const EvidenceSchema: z.ZodObject<{
    source: z.ZodString;
    type: z.ZodEnum<["metric", "trace", "profile", "log", "sample"]>;
    timestamp: z.ZodString;
    data: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    rawRef: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    data: Record<string, unknown>;
    type: "trace" | "metric" | "profile" | "log" | "sample";
    timestamp: string;
    source: string;
    rawRef?: string | undefined;
}, {
    data: Record<string, unknown>;
    type: "trace" | "metric" | "profile" | "log" | "sample";
    timestamp: string;
    source: string;
    rawRef?: string | undefined;
}>;
export declare const StandardOutputSchema: z.ZodObject<{
    tool: z.ZodString;
    version: z.ZodString;
    timestamp: z.ZodString;
    host: z.ZodString;
    durationMs: z.ZodNumber;
    success: z.ZodBoolean;
    params: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    findings: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        severity: z.ZodEnum<["critical", "warning", "info", "ok"]>;
        title: z.ZodString;
        description: z.ZodString;
        category: z.ZodString;
        confidence: z.ZodNumber;
        metrics: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodNumber, z.ZodString]>>>;
        suggestion: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        severity: "ok" | "warning" | "critical" | "info";
        title: string;
        description: string;
        category: string;
        confidence: number;
        suggestion?: string | undefined;
        metrics?: Record<string, string | number> | undefined;
    }, {
        id: string;
        severity: "ok" | "warning" | "critical" | "info";
        title: string;
        description: string;
        category: string;
        confidence: number;
        suggestion?: string | undefined;
        metrics?: Record<string, string | number> | undefined;
    }>, "many">;
    evidence: z.ZodArray<z.ZodObject<{
        source: z.ZodString;
        type: z.ZodEnum<["metric", "trace", "profile", "log", "sample"]>;
        timestamp: z.ZodString;
        data: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        rawRef: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        data: Record<string, unknown>;
        type: "trace" | "metric" | "profile" | "log" | "sample";
        timestamp: string;
        source: string;
        rawRef?: string | undefined;
    }, {
        data: Record<string, unknown>;
        type: "trace" | "metric" | "profile" | "log" | "sample";
        timestamp: string;
        source: string;
        rawRef?: string | undefined;
    }>, "many">;
    data: z.ZodUnknown;
    summary: z.ZodString;
    warnings: z.ZodArray<z.ZodString, "many">;
    error: z.ZodOptional<z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
        suggestion: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        code: string;
        message: string;
        suggestion?: string | undefined;
    }, {
        code: string;
        message: string;
        suggestion?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    success: boolean;
    durationMs: number;
    params: Record<string, unknown>;
    summary: string;
    tool: string;
    timestamp: string;
    host: string;
    warnings: string[];
    version: string;
    findings: {
        id: string;
        severity: "ok" | "warning" | "critical" | "info";
        title: string;
        description: string;
        category: string;
        confidence: number;
        suggestion?: string | undefined;
        metrics?: Record<string, string | number> | undefined;
    }[];
    evidence: {
        data: Record<string, unknown>;
        type: "trace" | "metric" | "profile" | "log" | "sample";
        timestamp: string;
        source: string;
        rawRef?: string | undefined;
    }[];
    error?: {
        code: string;
        message: string;
        suggestion?: string | undefined;
    } | undefined;
    data?: unknown;
}, {
    success: boolean;
    durationMs: number;
    params: Record<string, unknown>;
    summary: string;
    tool: string;
    timestamp: string;
    host: string;
    warnings: string[];
    version: string;
    findings: {
        id: string;
        severity: "ok" | "warning" | "critical" | "info";
        title: string;
        description: string;
        category: string;
        confidence: number;
        suggestion?: string | undefined;
        metrics?: Record<string, string | number> | undefined;
    }[];
    evidence: {
        data: Record<string, unknown>;
        type: "trace" | "metric" | "profile" | "log" | "sample";
        timestamp: string;
        source: string;
        rawRef?: string | undefined;
    }[];
    error?: {
        code: string;
        message: string;
        suggestion?: string | undefined;
    } | undefined;
    data?: unknown;
}>;
//# sourceMappingURL=output-schema.d.ts.map