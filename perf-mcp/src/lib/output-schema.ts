/**
 * Standardized Output Schema
 * Defines consistent structure for all perf-mcp tool outputs
 */

import { z } from 'zod';
import { TOOL_VERSION } from './constants.js';

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
export function createStandardOutput<T>(
  tool: string,
  params: Record<string, unknown>,
  data: T,
  options: {
    success: boolean;
    durationMs: number;
    findings?: Finding[];
    evidence?: Evidence[];
    summary?: string;
    warnings?: string[];
    error?: { code: string; message: string; suggestion?: string };
  }
): StandardOutput<T> {
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
export function createFinding(
  id: string,
  severity: FindingSeverity,
  title: string,
  description: string,
  category: string,
  options?: {
    confidence?: number;
    metrics?: Record<string, number | string>;
    suggestion?: string;
  }
): Finding {
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
export function createEvidence(
  source: string,
  type: Evidence['type'],
  data: Record<string, unknown>,
  rawRef?: string
): Evidence {
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
export function generateSummary(findings: Finding[]): string {
  if (findings.length === 0) {
    return 'No significant issues detected.';
  }

  const critical = findings.filter(f => f.severity === 'critical');
  const warnings = findings.filter(f => f.severity === 'warning');
  const info = findings.filter(f => f.severity === 'info');

  const parts: string[] = [];

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
