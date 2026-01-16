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
export declare function parsePerfReport(output: string): CpuProfileSample[];
/**
 * Result from parsing perf sched latency
 */
export interface SchedLatencyResult {
    tasks: Array<SchedLatencyTask & {
        count: number;
        avgDelayUs: number;
    }>;
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
export declare function parsePerfSchedLatency(output: string): SchedLatencyResult;
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
export declare function parsePerfSchedTimehist(output: string): TimhistEntry[];
/**
 * Aggregate timehist entries by task for off-CPU summary
 */
export declare function aggregateTimehist(entries: TimhistEntry[]): Map<string, {
    task: string;
    pid: number;
    totalWaitMs: number;
    totalRunMs: number;
    count: number;
}>;
/**
 * Parse perf script output for collapsed stacks (flame graph format)
 * Input lines like: "command;func1;func2;func3 count"
 */
export declare function parseCollapsedStacks(output: string): Map<string, number>;
/**
 * Calculate kernel vs user percentage from perf report samples
 */
export declare function calculateKernelUserSplit(samples: CpuProfileSample[]): {
    kernelPercent: number;
    userPercent: number;
};
//# sourceMappingURL=perf.d.ts.map