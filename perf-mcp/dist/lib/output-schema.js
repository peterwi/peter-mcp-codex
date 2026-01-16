/**
 * Standardized Output Schema
 * Defines consistent structure for all perf-mcp tool outputs
 */
import { z } from 'zod';
import { TOOL_VERSION } from './constants.js';
/**
 * Create standardized output wrapper
 */
export function createStandardOutput(tool, params, data, options) {
    return {
        tool,
        version: TOOL_VERSION,
        timestamp: new Date().toISOString(),
        host: process.env.HOSTNAME || 'unknown',
        durationMs: options.durationMs,
        success: options.success,
        params,
        findings: options.findings || [],
        evidence: options.evidence || [],
        data,
        summary: options.summary || (options.success ? 'Analysis completed successfully' : 'Analysis failed'),
        warnings: options.warnings || [],
        error: options.error,
    };
}
/**
 * Create a finding
 */
export function createFinding(id, severity, title, description, category, options) {
    return {
        id,
        severity,
        title,
        description,
        category,
        confidence: options?.confidence ?? 80,
        metrics: options?.metrics,
        suggestion: options?.suggestion,
    };
}
/**
 * Create evidence
 */
export function createEvidence(source, type, data, rawRef) {
    return {
        source,
        type,
        timestamp: new Date().toISOString(),
        data,
        rawRef,
    };
}
/**
 * Generate human-readable summary from findings
 */
export function generateSummary(findings) {
    if (findings.length === 0) {
        return 'No significant issues detected.';
    }
    const critical = findings.filter(f => f.severity === 'critical');
    const warnings = findings.filter(f => f.severity === 'warning');
    const info = findings.filter(f => f.severity === 'info');
    const parts = [];
    if (critical.length > 0) {
        parts.push(`${critical.length} critical issue(s): ${critical.map(f => f.title).join(', ')}`);
    }
    if (warnings.length > 0) {
        parts.push(`${warnings.length} warning(s): ${warnings.map(f => f.title).join(', ')}`);
    }
    if (info.length > 0) {
        parts.push(`${info.length} informational finding(s)`);
    }
    return parts.join('. ') + '.';
}
/**
 * Zod schema for validation
 */
export const FindingSchema = z.object({
    id: z.string(),
    severity: z.enum(['critical', 'warning', 'info', 'ok']),
    title: z.string(),
    description: z.string(),
    category: z.string(),
    confidence: z.number().min(0).max(100),
    metrics: z.record(z.union([z.number(), z.string()])).optional(),
    suggestion: z.string().optional(),
});
export const EvidenceSchema = z.object({
    source: z.string(),
    type: z.enum(['metric', 'trace', 'profile', 'log', 'sample']),
    timestamp: z.string(),
    data: z.record(z.unknown()),
    rawRef: z.string().optional(),
});
export const StandardOutputSchema = z.object({
    tool: z.string(),
    version: z.string(),
    timestamp: z.string(),
    host: z.string(),
    durationMs: z.number(),
    success: z.boolean(),
    params: z.record(z.unknown()),
    findings: z.array(FindingSchema),
    evidence: z.array(EvidenceSchema),
    data: z.unknown(),
    summary: z.string(),
    warnings: z.array(z.string()),
    error: z.object({
        code: z.string(),
        message: z.string(),
        suggestion: z.string().optional(),
    }).optional(),
});
//# sourceMappingURL=output-schema.js.map