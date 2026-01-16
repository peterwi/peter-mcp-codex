/**
 * perf_triage tool
 * High-level incident triage tool that runs multiple analyses
 * and produces a consolidated report with root cause analysis
 */

import { z } from 'zod';
import { TOOL_VERSION, ErrorCode } from '../lib/constants.js';
import { detectCapabilities } from '../lib/detect.js';
import {
  createFinding,
  createEvidence,
  type Finding,
  type Evidence,
  type FindingSeverity,
} from '../lib/output-schema.js';
import type { PerfResponse, PerfSnapshotData, PerfUseCheckData } from '../lib/schemas.js';

// Import tool functions
import { perfSnapshot } from './snapshot.js';
import { perfSyscallCount } from './syscall-count.js';
import { perfThreadProfile } from './thread-profile.js';
import { perfIoLayers } from './io-layers.js';
import { perfFileTrace } from './file-trace.js';
import { perfExecTrace } from './exec-trace.js';
import { perfUseCheck } from './use-check.js';

export const TriageInputSchema = z.object({
  pid: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Target process ID'),
  process_name: z
    .string()
    .max(64)
    .optional()
    .describe('Target process name (if PID not specified)'),
  mode: z
    .enum(['quick', 'standard', 'deep'])
    .default('standard')
    .describe('Triage depth: quick (5s), standard (10s), deep (30s)'),
  include_exec_trace: z
    .boolean()
    .default(false)
    .describe('Include process execution tracing (adds overhead)'),
  focus: z
    .enum(['auto', 'cpu', 'memory', 'io', 'network'])
    .default('auto')
    .describe('Focus area for analysis'),
});

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
  confidence: number; // 0-100
  severity: FindingSeverity;
  supportingFindings: string[]; // Finding IDs
  suggestedActions: string[];
}

/**
 * Tool execution result
 */
interface ToolResult {
  tool: string;
  success: boolean;
  durationMs: number;
  findings: Finding[];
  evidence: Evidence[];
  error?: string;
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

  // Ranked root causes
  root_causes: RootCauseHypothesis[];

  // All findings from all tools
  all_findings: Finding[];

  // Key evidence
  key_evidence: Evidence[];

  // Metrics summary
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

  // Human-readable summary
  executive_summary: string;

  // Recommended next steps
  recommended_actions: string[];

  // Raw tool references for deep dive
  tool_results: Record<string, unknown>;

  // Warnings and notes
  warnings: string[];
}

/**
 * Duration settings per mode
 */
const MODE_DURATIONS = {
  quick: 5,
  standard: 10,
  deep: 30,
};

/**
 * Analyze findings and generate root cause hypotheses
 */
function analyzeRootCauses(
  findings: Finding[],
  _evidence: Evidence[],
  _toolResults: ToolResult[]
): RootCauseHypothesis[] {
  const hypotheses: RootCauseHypothesis[] = [];

  // Group findings by category
  const byCategory = new Map<string, Finding[]>();
  for (const f of findings) {
    const cat = f.category;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(f);
  }

  // CPU-related root causes
  const cpuFindings = byCategory.get('cpu') || [];
  const criticalCpu = cpuFindings.filter(f => f.severity === 'critical' || f.severity === 'warning');
  if (criticalCpu.length > 0) {
    // Check for specific patterns
    const highSyscallRate = cpuFindings.find(f => f.id === 'high_syscall_rate');
    const dominantSyscall = cpuFindings.find(f => f.id === 'dominant_syscall');
    const highCpuUtil = cpuFindings.find(f => f.id.includes('cpu') && f.id.includes('high'));

    if (highSyscallRate && dominantSyscall) {
      hypotheses.push({
        id: 'cpu_syscall_overhead',
        title: 'Excessive syscall overhead',
        description: 'Application is making too many system calls, causing CPU overhead',
        category: 'cpu',
        confidence: 85,
        severity: 'warning',
        supportingFindings: [highSyscallRate.id, dominantSyscall.id],
        suggestedActions: [
          'Profile application to identify syscall hotspots',
          'Consider batching I/O operations',
          'Use io_uring or epoll for async I/O',
        ],
      });
    }

    if (highCpuUtil) {
      hypotheses.push({
        id: 'cpu_saturation',
        title: 'CPU saturation',
        description: 'CPU resources are saturated - system is compute-bound',
        category: 'cpu',
        confidence: 80,
        severity: 'warning',
        supportingFindings: [highCpuUtil.id],
        suggestedActions: [
          'Profile CPU with perf_cpu_profile to find hot functions',
          'Check for runaway processes',
          'Consider horizontal scaling',
        ],
      });
    }
  }

  // I/O-related root causes
  const ioFindings = byCategory.get('io') || [];
  const criticalIo = ioFindings.filter(f => f.severity === 'critical' || f.severity === 'warning');
  if (criticalIo.length > 0) {
    const highLatency = ioFindings.find(f => f.id.includes('latency'));
    const lowCacheHit = ioFindings.find(f => f.id.includes('cache'));

    if (highLatency) {
      hypotheses.push({
        id: 'io_latency',
        title: 'High I/O latency',
        description: 'Storage I/O latency is elevated, causing application slowdowns',
        category: 'io',
        confidence: 75,
        severity: 'warning',
        supportingFindings: [highLatency.id],
        suggestedActions: [
          'Check storage device health and utilization',
          'Consider SSD upgrade or RAID optimization',
          'Review I/O scheduling and queue depth',
        ],
      });
    }

    if (lowCacheHit) {
      hypotheses.push({
        id: 'io_cache_miss',
        title: 'Poor cache effectiveness',
        description: 'Page cache is not effective, causing excessive disk I/O',
        category: 'io',
        confidence: 70,
        severity: 'warning',
        supportingFindings: [lowCacheHit.id],
        suggestedActions: [
          'Increase available memory for page cache',
          'Review application memory allocation',
          'Consider using mmap with MAP_POPULATE for critical files',
        ],
      });
    }
  }

  // Memory-related root causes
  const memFindings = byCategory.get('memory') || [];
  const criticalMem = memFindings.filter(f => f.severity === 'critical' || f.severity === 'warning');
  if (criticalMem.length > 0) {
    const lowMemory = memFindings.find(f => f.id.includes('low') || f.id.includes('pressure'));
    const swapUsage = memFindings.find(f => f.id.includes('swap'));

    if (lowMemory || swapUsage) {
      hypotheses.push({
        id: 'memory_pressure',
        title: 'Memory pressure',
        description: 'System is under memory pressure, potentially causing swapping',
        category: 'memory',
        confidence: 80,
        severity: lowMemory?.severity === 'critical' ? 'critical' : 'warning',
        supportingFindings: [lowMemory?.id, swapUsage?.id].filter(Boolean) as string[],
        suggestedActions: [
          'Identify memory-heavy processes',
          'Review application memory allocation',
          'Consider increasing system memory',
          'Tune OOM killer priorities',
        ],
      });
    }
  }

  // Sort by confidence
  hypotheses.sort((a, b) => b.confidence - a.confidence);

  return hypotheses;
}

/**
 * Generate executive summary from findings and hypotheses
 */
function generateExecutiveSummary(
  hypotheses: RootCauseHypothesis[],
  findings: Finding[],
  target: TriageReport['target']
): string {
  const parts: string[] = [];

  // Target description
  if (target.pid) {
    parts.push(`Analysis of process ${target.pid}:`);
  } else if (target.process_name) {
    parts.push(`Analysis of process "${target.process_name}":`);
  } else {
    parts.push('System-wide analysis:');
  }

  // Finding counts
  const critical = findings.filter(f => f.severity === 'critical').length;
  const warnings = findings.filter(f => f.severity === 'warning').length;
  const info = findings.filter(f => f.severity === 'info').length;

  if (critical > 0) {
    parts.push(`Found ${critical} critical issue(s).`);
  }
  if (warnings > 0) {
    parts.push(`Found ${warnings} warning(s).`);
  }
  if (info > 0) {
    parts.push(`Found ${info} informational finding(s).`);
  }
  if (critical === 0 && warnings === 0) {
    parts.push('No critical issues detected.');
  }

  // Top hypothesis
  if (hypotheses.length > 0) {
    const top = hypotheses[0];
    parts.push(`\n\nMost likely root cause: ${top.title} (${top.confidence}% confidence)`);
    parts.push(top.description);
  }

  return parts.join(' ');
}

/**
 * Run a tool and collect results
 */
async function runTool<T>(
  name: string,
  fn: () => Promise<PerfResponse<T>>,
  extractFindings?: (data: T) => Finding[],
  extractEvidence?: (data: T) => Evidence[]
): Promise<ToolResult> {
  const startTime = Date.now();

  try {
    const result = await fn();
    const durationMs = Date.now() - startTime;

    if (!result.success) {
      return {
        tool: name,
        success: false,
        durationMs,
        findings: [],
        evidence: [],
        error: result.error?.message,
      };
    }

    const data = result.data as T;
    const findings = extractFindings ? extractFindings(data) : [];
    const evidence = extractEvidence ? extractEvidence(data) : [];

    // Also extract findings/evidence from data if present
    if (data && typeof data === 'object') {
      const d = data as Record<string, unknown>;
      if (Array.isArray(d.findings)) {
        findings.push(...(d.findings as Finding[]));
      }
      if (Array.isArray(d.evidence)) {
        evidence.push(...(d.evidence as Evidence[]));
      }
    }

    return {
      tool: name,
      success: true,
      durationMs,
      findings,
      evidence,
    };
  } catch (error) {
    return {
      tool: name,
      success: false,
      durationMs: Date.now() - startTime,
      findings: [],
      evidence: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function perfTriage(
  input: TriageRawInput = {}
): Promise<PerfResponse<TriageReport>> {
  const startTime = Date.now();

  try {
    const params = TriageInputSchema.parse(input);
    const caps = await detectCapabilities();
    const warnings: string[] = [];

    const durationSec = MODE_DURATIONS[params.mode];

    // Determine target
    const target: TriageReport['target'] = {
      pid: params.pid,
      process_name: params.process_name,
      scope: params.pid || params.process_name ? 'process' : 'system-wide',
    };

    // Results collection
    const toolResults: ToolResult[] = [];
    const rawResults: Record<string, unknown> = {};

    // 1. Snapshot - always run first for baseline
    const snapshotResult = await runTool<PerfSnapshotData>(
      'perf_snapshot',
      async () => {
        const result = await perfSnapshot({ include_psi: true });
        // Cast to single snapshot type (we don't use interval mode in triage)
        return result as PerfResponse<PerfSnapshotData>;
      },
      (data) => {
        const findings: Finding[] = [];
        // Calculate total CPU utilization (100 - idle)
        const cpuUtil = 100 - data.cpu.utilization.idle;
        // Calculate available memory in MB
        const availableMb = data.memory.available_bytes / (1024 * 1024);
        // Extract findings from snapshot
        if (cpuUtil > 90) {
          findings.push(createFinding(
            'high_cpu_utilization',
            'warning',
            'High CPU utilization',
            `CPU utilization is ${cpuUtil.toFixed(1)}%`,
            'cpu',
            { metrics: { utilization: cpuUtil } }
          ));
        }
        if (availableMb < 500) {
          findings.push(createFinding(
            'low_available_memory',
            'critical',
            'Low available memory',
            `Only ${availableMb.toFixed(0)}MB available`,
            'memory',
            { metrics: { available_mb: availableMb } }
          ));
        }
        return findings;
      },
      (data) => {
        const cpuUtil = 100 - data.cpu.utilization.idle;
        const memUsedPct = (data.memory.used_bytes / data.memory.total_bytes) * 100;
        return [
          createEvidence('perf_snapshot', 'metric', {
            cpu_utilization: cpuUtil,
            memory_used_pct: memUsedPct,
            load_avg: data.cpu.load_avg,
          }),
        ];
      }
    );
    toolResults.push(snapshotResult);
    if (snapshotResult.success) {
      rawResults.snapshot = snapshotResult;
    }

    // 2. USE check
    const useResult = await runTool(
      'perf_use_check',
      () => perfUseCheck(),
      (data: PerfUseCheckData) => {
        const findings: Finding[] = [];
        // Check top suspicions from summary
        for (const suspicion of data.summary.top_suspicions) {
          findings.push(createFinding(
            'use_suspicion',
            data.summary.status === 'critical' ? 'critical' : 'warning',
            'USE method finding',
            suspicion,
            'system'
          ));
        }
        // Check resource metrics for issues
        for (const [resource, metrics] of Object.entries(data.resources)) {
          if (metrics.utilization.status === 'critical' || metrics.utilization.status === 'warning') {
            findings.push(createFinding(
              `use_${resource}_utilization`,
              metrics.utilization.status === 'critical' ? 'critical' : 'warning',
              `${resource} utilization issue`,
              metrics.utilization.detail,
              resource
            ));
          }
          if (metrics.saturation.status === 'critical' || metrics.saturation.status === 'warning') {
            findings.push(createFinding(
              `use_${resource}_saturation`,
              metrics.saturation.status === 'critical' ? 'critical' : 'warning',
              `${resource} saturation issue`,
              metrics.saturation.detail,
              resource
            ));
          }
          if (metrics.errors.status === 'critical' || metrics.errors.status === 'warning') {
            findings.push(createFinding(
              `use_${resource}_errors`,
              metrics.errors.status === 'critical' ? 'critical' : 'warning',
              `${resource} errors detected`,
              metrics.errors.detail,
              resource
            ));
          }
        }
        return findings;
      }
    );
    toolResults.push(useResult);
    if (useResult.success) {
      rawResults.use_check = useResult;
    }

    // 3. Run focused tools based on mode and focus
    if (params.mode !== 'quick') {
      // Syscall count (if BCC available)
      if (caps.canUseBpf || caps.hasBpftrace) {
        const syscallResult = await runTool(
          'perf_syscall_count',
          () => perfSyscallCount({
            duration_seconds: durationSec,
            pid: params.pid,
            top_n: 20,
            include_latency: params.mode === 'deep',
          })
        );
        toolResults.push(syscallResult);
        if (syscallResult.success) {
          rawResults.syscall_count = syscallResult;
        }
      } else {
        warnings.push('Syscall counting unavailable - install bcc-tools or bpftrace');
      }

      // Thread profile
      if (params.pid) {
        const threadResult = await runTool(
          'perf_thread_profile',
          () => perfThreadProfile({
            pid: params.pid!,
            duration_seconds: Math.min(durationSec, 10),
            include_offcpu: params.mode === 'deep',
          })
        );
        toolResults.push(threadResult);
        if (threadResult.success) {
          rawResults.thread_profile = threadResult;
        }
      }

      // I/O layers (if BCC available)
      if (caps.canUseBpf) {
        const ioResult = await runTool(
          'perf_io_layers',
          () => perfIoLayers({
            duration_seconds: Math.min(durationSec, 10),
          })
        );
        toolResults.push(ioResult);
        if (ioResult.success) {
          rawResults.io_layers = ioResult;
        }
      }
    }

    // 4. Deep mode - additional tools
    if (params.mode === 'deep') {
      // File trace
      if (caps.canUseBpf) {
        const fileResult = await runTool(
          'perf_file_trace',
          () => perfFileTrace({
            duration_seconds: Math.min(durationSec, 15),
            pid: params.pid,
            mode: 'slow_ops',
            min_latency_ms: 10,
          })
        );
        toolResults.push(fileResult);
        if (fileResult.success) {
          rawResults.file_trace = fileResult;
        }
      }

      // Exec trace (optional)
      if (params.include_exec_trace && (caps.canUseBpf || caps.hasBpftrace)) {
        const execResult = await runTool(
          'perf_exec_trace',
          () => perfExecTrace({
            duration_seconds: Math.min(durationSec, 15),
            pid: params.pid,
            include_fork_clone: true,
            mode: 'events',
          })
        );
        toolResults.push(execResult);
        if (execResult.success) {
          rawResults.exec_trace = execResult;
        }
      }
    }

    // Collect all findings and evidence
    const allFindings: Finding[] = [];
    const keyEvidence: Evidence[] = [];

    for (const result of toolResults) {
      allFindings.push(...result.findings);
      keyEvidence.push(...result.evidence);
    }

    // Analyze root causes
    const rootCauses = analyzeRootCauses(allFindings, keyEvidence, toolResults);

    // Build metrics summary
    const metricsSummary: TriageReport['metrics_summary'] = {};

    // Extract from snapshot if available
    if (snapshotResult.success && rawResults.snapshot) {
      const snap = (rawResults.snapshot as { data: PerfSnapshotData }).data;
      if (snap && snap.cpu && snap.memory) {
        const cpuUtil = snap.cpu.utilization;
        const totalCpuPct = 100 - (cpuUtil?.idle ?? 100);
        metricsSummary.cpu = {
          utilization_pct: totalCpuPct,
          user_pct: cpuUtil?.user ?? 0,
          system_pct: cpuUtil?.system ?? 0,
          load_avg_1m: snap.cpu.load_avg?.[0] ?? 0,
        };
        const memTotal = snap.memory.total_bytes ?? 1;
        const memAvail = snap.memory.available_bytes ?? 0;
        const memUsed = snap.memory.used_bytes ?? 0;
        const swapTotal = snap.memory.swap_total_bytes ?? 1;
        const swapUsed = snap.memory.swap_used_bytes ?? 0;
        metricsSummary.memory = {
          used_pct: (memUsed / memTotal) * 100,
          available_mb: memAvail / (1024 * 1024),
          swap_used_pct: swapTotal > 0 ? (swapUsed / swapTotal) * 100 : 0,
        };
      }
    }

    // Generate summaries
    const executiveSummary = generateExecutiveSummary(rootCauses, allFindings, target);

    // Recommended actions from top root causes
    const recommendedActions: string[] = [];
    for (const rc of rootCauses.slice(0, 3)) {
      recommendedActions.push(...rc.suggestedActions.slice(0, 2));
    }
    if (recommendedActions.length === 0) {
      recommendedActions.push('No immediate actions required - system appears healthy');
    }

    // Build report
    const report: TriageReport = {
      target,
      mode: params.mode,
      duration_seconds: durationSec,
      tools_executed: toolResults.filter(r => r.success).map(r => r.tool),
      tools_failed: toolResults.filter(r => !r.success).map(r => r.tool),
      root_causes: rootCauses,
      all_findings: allFindings,
      key_evidence: keyEvidence.slice(0, 10),
      metrics_summary: metricsSummary,
      executive_summary: executiveSummary,
      recommended_actions: [...new Set(recommendedActions)],
      tool_results: rawResults,
      warnings,
    };

    return {
      success: true,
      tool: 'perf_triage',
      tool_version: TOOL_VERSION,
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      host: process.env.HOSTNAME || 'unknown',
      data: report,
    };
  } catch (error) {
    return {
      success: false,
      tool: 'perf_triage',
      tool_version: TOOL_VERSION,
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      host: process.env.HOSTNAME || 'unknown',
      error: {
        code: ErrorCode.EXECUTION_FAILED,
        message: error instanceof Error ? error.message : String(error),
        recoverable: false,
      },
    };
  }
}
