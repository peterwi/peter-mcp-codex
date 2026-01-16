/**
 * Parser for perf command outputs
 */

import type { CpuProfileSample, SchedLatencyTask } from '../lib/schemas.js';

/**
 * Parse perf report --stdio output
 * Example:
 * # Overhead  Command  Shared Object      Symbol
 * # ........  .......  .................  ..............................
 * #
 *     12.34%  myapp    myapp              [.] processRequest
 *      8.56%  myapp    libc.so.6          [.] malloc
 *      5.23%  myapp    [kernel.kallsyms]  [k] copy_user_enhanced_fast_string
 */
export function parsePerfReport(output: string): CpuProfileSample[] {
  const samples: CpuProfileSample[] = [];
  const lines = output.split('\n');

  for (const line of lines) {
    // Skip comment lines and empty lines
    if (line.startsWith('#') || !line.trim()) {
      continue;
    }

    // Parse sample line
    // Format: "   12.34%  command  module  [.] symbol" or similar
    const match = line.match(/^\s*([\d.]+)%\s+\S+\s+(\S+)\s+\[([.\w])\]\s+(.+)/);
    if (match) {
      const percent = parseFloat(match[1]);
      const module = match[2];
      // match[3] is symbolType: '.' = user, 'k' = kernel (not used currently)
      const symbol = match[4].trim();

      samples.push({
        symbol,
        module,
        percent,
        samples: 0, // Not available in this format
      });
    }
  }

  // Sort by percent descending
  samples.sort((a, b) => b.percent - a.percent);

  return samples;
}

/**
 * Result from parsing perf sched latency
 */
export interface SchedLatencyResult {
  tasks: Array<SchedLatencyTask & { count: number; avgDelayUs: number }>;
  totalDelayUs: number;
}

/**
 * Parse perf sched latency output
 * Example:
 * -----------------------------------------------------------------------------------------------------------------
 *  Task                  |   Runtime ms  | Switches | Avg delay ms    | Max delay ms    | Max delay start  |
 * -----------------------------------------------------------------------------------------------------------------
 *  mysqld:1234           |    123.456 ms |     5678 | avg:    0.123 ms | max:    5.678 ms | max start: 12345.678 s |
 *  :0                    |    987.654 ms |    12345 | avg:    0.234 ms | max:   12.345 ms | max start:  1234.567 s |
 */
export function parsePerfSchedLatency(output: string): SchedLatencyResult {
  const tasks: SchedLatencyTask[] = [];
  const lines = output.split('\n');

  for (const line of lines) {
    // Skip header/separator lines
    if (line.startsWith('-') || line.startsWith(' Task') || !line.trim()) {
      continue;
    }

    // Try to parse task line
    // Format varies, but generally: "task:pid | runtime | switches | avg delay | max delay | ..."
    const match = line.match(
      /^\s*([^|]+?):(\d+)\s*\|\s*([\d.]+)\s*ms\s*\|\s*(\d+)\s*\|\s*avg:\s*([\d.]+)\s*ms\s*\|\s*max:\s*([\d.]+)\s*ms/
    );

    if (match) {
      tasks.push({
        task: match[1].trim(),
        pid: parseInt(match[2], 10),
        runtime_ms: parseFloat(match[3]),
        wait_time_ms: 0, // Will calculate from avg * switches
        max_wait_ms: parseFloat(match[6]),
        switches: parseInt(match[4], 10),
      });
    }
  }

  // Calculate wait time from avg delay * switches and track totals
  let totalDelayUs = 0;
  const enrichedTasks: Array<SchedLatencyTask & { count: number; avgDelayUs: number }> = [];

  for (const task of tasks) {
    // Re-parse to get avg
    const matchLine = lines.find((l) => l.includes(`:${task.pid}`));
    let avgDelayMs = 0;
    if (matchLine) {
      const avgMatch = matchLine.match(/avg:\s*([\d.]+)\s*ms/);
      if (avgMatch) {
        avgDelayMs = parseFloat(avgMatch[1]);
        task.wait_time_ms = avgDelayMs * task.switches;
      }
    }

    const avgDelayUs = avgDelayMs * 1000;
    totalDelayUs += avgDelayUs * task.switches;

    enrichedTasks.push({
      ...task,
      count: task.switches,
      avgDelayUs,
    });
  }

  // Sort by max wait descending
  enrichedTasks.sort((a, b) => b.max_wait_ms - a.max_wait_ms);

  return { tasks: enrichedTasks, totalDelayUs };
}

/**
 * Parse perf sched timehist output for off-CPU analysis
 * Example:
 *            time    cpu  task name                       wait time  sch delay   run time
 *                         [tid/pid]                          (msec)     (msec)     (msec)
 *  --------------- ------  ------------------------------  ---------  ---------  ---------
 *    12345.678901 [0000]  myapp[1234]                        1.234      0.012      0.567
 */
export interface TimhistEntry {
  timestamp: number;
  cpu: number;
  task: string;
  pid: number;
  waitTime: number;
  schedDelay: number;
  runTime: number;
}

export function parsePerfSchedTimehist(output: string): TimhistEntry[] {
  const entries: TimhistEntry[] = [];
  const lines = output.split('\n');

  for (const line of lines) {
    // Skip header/separator lines
    if (line.startsWith(' ') && line.includes('time')) continue;
    if (line.includes('[tid/pid]')) continue;
    if (line.includes('---')) continue;
    if (!line.trim()) continue;

    // Parse entry line
    const match = line.match(
      /^\s*([\d.]+)\s+\[(\d+)\]\s+(\S+)\[(\d+)\]\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/
    );

    if (match) {
      entries.push({
        timestamp: parseFloat(match[1]),
        cpu: parseInt(match[2], 10),
        task: match[3],
        pid: parseInt(match[4], 10),
        waitTime: parseFloat(match[5]),
        schedDelay: parseFloat(match[6]),
        runTime: parseFloat(match[7]),
      });
    }
  }

  return entries;
}

/**
 * Aggregate timehist entries by task for off-CPU summary
 */
export function aggregateTimehist(entries: TimhistEntry[]): Map<string, {
  task: string;
  pid: number;
  totalWaitMs: number;
  totalRunMs: number;
  count: number;
}> {
  const byTask = new Map<string, {
    task: string;
    pid: number;
    totalWaitMs: number;
    totalRunMs: number;
    count: number;
  }>();

  for (const entry of entries) {
    const key = `${entry.task}:${entry.pid}`;
    const existing = byTask.get(key);

    if (existing) {
      existing.totalWaitMs += entry.waitTime;
      existing.totalRunMs += entry.runTime;
      existing.count++;
    } else {
      byTask.set(key, {
        task: entry.task,
        pid: entry.pid,
        totalWaitMs: entry.waitTime,
        totalRunMs: entry.runTime,
        count: 1,
      });
    }
  }

  return byTask;
}

/**
 * Parse perf script output for collapsed stacks (flame graph format)
 * Input lines like: "command;func1;func2;func3 count"
 */
export function parseCollapsedStacks(output: string): Map<string, number> {
  const stacks = new Map<string, number>();

  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Find the last space (count is after it)
    const lastSpace = trimmed.lastIndexOf(' ');
    if (lastSpace > 0) {
      const stack = trimmed.slice(0, lastSpace);
      const count = parseInt(trimmed.slice(lastSpace + 1), 10);
      if (!isNaN(count)) {
        stacks.set(stack, (stacks.get(stack) ?? 0) + count);
      }
    }
  }

  return stacks;
}

/**
 * Calculate kernel vs user percentage from perf report samples
 */
export function calculateKernelUserSplit(samples: CpuProfileSample[]): {
  kernelPercent: number;
  userPercent: number;
} {
  let kernel = 0;
  let user = 0;

  for (const sample of samples) {
    if (
      sample.module.includes('kernel') ||
      sample.module.includes('kallsyms') ||
      sample.module.startsWith('[')
    ) {
      kernel += sample.percent;
    } else {
      user += sample.percent;
    }
  }

  return {
    kernelPercent: kernel,
    userPercent: user,
  };
}
