/**
 * perf_exec_trace tool
 * Trace process creation (fork/clone) and exec events
 * Supports BCC execsnoop and bpftrace-based comprehensive tracing
 */
import { z } from 'zod';
import { TOOL_VERSION, ErrorCode, TIMEOUTS } from '../lib/constants.js';
import { safeExec } from '../lib/exec.js';
import { detectCapabilities } from '../lib/detect.js';
import { parseExecsnoop } from '../parse/bcc.js';
/**
 * Output mode for trace data
 */
export const TraceModeSchema = z.enum(['events', 'tree', 'both']);
export const ExecTraceInputSchema = z.object({
    duration_seconds: z
        .number()
        .min(1)
        .max(60)
        .default(5)
        .describe('Duration in seconds (1-60)'),
    pid: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Filter by parent process ID'),
    name_pattern: z
        .string()
        .max(64)
        .optional()
        .describe('Filter by command name (substring match)'),
    uid: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe('Filter by user ID'),
    include_failed: z
        .boolean()
        .default(false)
        .describe('Only show failed exec calls'),
    max_args: z
        .number()
        .int()
        .min(1)
        .max(20)
        .default(10)
        .describe('Maximum number of arguments to capture'),
    include_timestamps: z
        .boolean()
        .default(true)
        .describe('Include timestamps in output'),
    // New parameters for fork/clone tracing
    include_fork_clone: z
        .boolean()
        .default(true)
        .describe('Include fork/clone events (process creation)'),
    include_exec: z
        .boolean()
        .default(true)
        .describe('Include exec events'),
    include_exit: z
        .boolean()
        .default(false)
        .describe('Include process exit events'),
    mode: TraceModeSchema
        .default('events')
        .describe('Output mode: events (list), tree (hierarchy), or both'),
});
const MAX_EVENTS = 5000; // Increased from 500 for comprehensive tracing
/**
 * Build embedded bpftrace script for comprehensive process tracing
 * This is a FIXED script, not user-provided, for security
 */
function buildProcessTraceScript(durationSec, includeFork, includeExec, includeExit, pid) {
    const pidFilter = pid ? `args->parent_pid == ${pid} || pid == ${pid}` : '1';
    const lines = [];
    // Header comment
    lines.push('// Process tracing script - embedded, not user-provided');
    // Fork tracing
    if (includeFork) {
        lines.push(`
tracepoint:sched:sched_process_fork
/${pidFilter}/
{
  printf("FORK|%llu|%d|%s|%d|%s\\n",
    nsecs / 1000000,
    args->parent_pid,
    args->parent_comm,
    args->child_pid,
    args->child_comm);
}`);
    }
    // Exec tracing
    if (includeExec) {
        lines.push(`
tracepoint:sched:sched_process_exec
{
  printf("EXEC|%llu|%d|%s|%s\\n",
    nsecs / 1000000,
    pid,
    comm,
    str(args->filename));
}`);
    }
    // Exit tracing
    if (includeExit) {
        lines.push(`
tracepoint:sched:sched_process_exit
{
  printf("EXIT|%llu|%d|%s|%d\\n",
    nsecs / 1000000,
    pid,
    comm,
    args->prio);
}`);
    }
    // Interval exit
    lines.push(`
interval:s:${durationSec}
{
  exit();
}

END
{
  // Clean exit
}`);
    return lines.join('\n');
}
/**
 * Parse bpftrace output from our embedded script
 * Format: TYPE|timestamp_ms|pid|comm|...
 */
function parseBpftraceOutput(output) {
    const events = [];
    const lines = output.trim().split('\n');
    for (const line of lines) {
        // Skip non-data lines
        if (line.startsWith('Attaching') || line.startsWith('@') || !line.trim())
            continue;
        const parts = line.split('|');
        if (parts.length < 4)
            continue;
        const eventType = parts[0];
        const timestamp = parseInt(parts[1], 10);
        if (isNaN(timestamp))
            continue;
        switch (eventType) {
            case 'FORK': {
                // FORK|timestamp|parent_pid|parent_comm|child_pid|child_comm
                if (parts.length >= 6) {
                    events.push({
                        timestamp_ms: timestamp,
                        event_type: 'fork',
                        pid: parseInt(parts[2], 10),
                        comm: parts[3],
                        child_pid: parseInt(parts[4], 10),
                        child_comm: parts[5],
                    });
                }
                break;
            }
            case 'EXEC': {
                // EXEC|timestamp|pid|comm|filename
                if (parts.length >= 5) {
                    events.push({
                        timestamp_ms: timestamp,
                        event_type: 'exec',
                        pid: parseInt(parts[2], 10),
                        comm: parts[3],
                        filename: parts[4],
                    });
                }
                break;
            }
            case 'EXIT': {
                // EXIT|timestamp|pid|comm|prio
                if (parts.length >= 5) {
                    events.push({
                        timestamp_ms: timestamp,
                        event_type: 'exit',
                        pid: parseInt(parts[2], 10),
                        comm: parts[3],
                        exit_code: parseInt(parts[4], 10),
                    });
                }
                break;
            }
        }
    }
    return events;
}
/**
 * Build relationships from process events
 */
function buildRelationships(events) {
    const relationships = [];
    for (const event of events) {
        if (event.event_type === 'fork' && event.child_pid !== undefined) {
            relationships.push({
                parent_pid: event.pid,
                parent_comm: event.comm,
                child_pid: event.child_pid,
                child_comm: event.child_comm || 'unknown',
                event_type: 'fork',
            });
        }
        else if (event.event_type === 'exec' && event.ppid !== undefined) {
            relationships.push({
                parent_pid: event.ppid,
                parent_comm: 'unknown',
                child_pid: event.pid,
                child_comm: event.comm,
                event_type: 'exec',
            });
        }
    }
    return relationships;
}
/**
 * Build process tree from events
 */
function buildProcessTree(events) {
    const nodeMap = new Map();
    const roots = [];
    const childToParent = new Map();
    // First pass: create nodes and track parent-child relationships
    for (const event of events) {
        if (event.event_type === 'fork') {
            // Create parent node if not exists
            if (!nodeMap.has(event.pid)) {
                nodeMap.set(event.pid, {
                    pid: event.pid,
                    comm: event.comm,
                    children: [],
                    exec_count: 0,
                    exited: false,
                });
            }
            // Create child node
            if (event.child_pid !== undefined) {
                const childNode = {
                    pid: event.child_pid,
                    comm: event.child_comm || 'unknown',
                    children: [],
                    exec_count: 0,
                    exited: false,
                };
                nodeMap.set(event.child_pid, childNode);
                childToParent.set(event.child_pid, event.pid);
            }
        }
        else if (event.event_type === 'exec') {
            const node = nodeMap.get(event.pid);
            if (node) {
                node.exec_count++;
                if (event.filename) {
                    node.comm = event.filename.split('/').pop() || event.comm;
                }
            }
        }
        else if (event.event_type === 'exit') {
            const node = nodeMap.get(event.pid);
            if (node) {
                node.exited = true;
            }
        }
    }
    // Second pass: build tree structure
    for (const [pid, node] of nodeMap) {
        const parentPid = childToParent.get(pid);
        if (parentPid !== undefined) {
            const parentNode = nodeMap.get(parentPid);
            if (parentNode) {
                parentNode.children.push(node);
            }
            else {
                roots.push(node);
            }
        }
        else {
            roots.push(node);
        }
    }
    return roots;
}
/**
 * Calculate max tree depth
 */
function getMaxTreeDepth(nodes, depth = 1) {
    let maxDepth = depth;
    for (const node of nodes) {
        if (node.children.length > 0) {
            const childDepth = getMaxTreeDepth(node.children, depth + 1);
            if (childDepth > maxDepth) {
                maxDepth = childDepth;
            }
        }
    }
    return maxDepth;
}
export async function perfExecTrace(input = {}) {
    const startTime = Date.now();
    try {
        const params = ExecTraceInputSchema.parse(input);
        const caps = await detectCapabilities();
        const notes = [];
        // Determine which backend to use
        const wantComprehensive = params.include_fork_clone || params.include_exit || params.mode !== 'events';
        const canUseBpftrace = caps.canUseBpf && caps.hasBpftrace;
        const canUseBccExecsnoop = caps.canUseBpf && caps.bccTools.execsnoop;
        // If comprehensive tracing requested, prefer bpftrace
        if (wantComprehensive && canUseBpftrace) {
            return await runBpftraceComprehensive(params, caps, notes, startTime);
        }
        // Fall back to execsnoop for simple exec-only tracing
        if (canUseBccExecsnoop) {
            return await runExecsnoop(params, notes, startTime);
        }
        // No suitable backend
        return {
            success: false,
            tool: 'perf_exec_trace',
            tool_version: TOOL_VERSION,
            timestamp: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
            host: process.env.HOSTNAME || 'unknown',
            error: {
                code: ErrorCode.CAPABILITY_MISSING,
                message: wantComprehensive
                    ? 'Comprehensive process tracing requires bpftrace with BPF capabilities'
                    : 'Exec tracing requires BCC execsnoop or bpftrace with BPF capabilities',
                recoverable: true,
                suggestion: 'Install bcc-tools and bpftrace, then run as root. Alternative: use auditd for process auditing.',
            },
        };
    }
    catch (error) {
        return {
            success: false,
            tool: 'perf_exec_trace',
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
/**
 * Run comprehensive tracing with bpftrace
 */
async function runBpftraceComprehensive(params, _caps, notes, startTime) {
    notes.push('Using bpftrace for comprehensive process tracing');
    const script = buildProcessTraceScript(params.duration_seconds, params.include_fork_clone, params.include_exec, params.include_exit, params.pid);
    const timeout = (params.duration_seconds * 1000) + TIMEOUTS.DEFAULT + 5000;
    const result = await safeExec('bpftrace', ['-e', script], { timeout });
    if (!result.success && !result.stdout) {
        return {
            success: false,
            tool: 'perf_exec_trace',
            tool_version: TOOL_VERSION,
            timestamp: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
            host: process.env.HOSTNAME || 'unknown',
            error: {
                code: result.error?.code || ErrorCode.EXECUTION_FAILED,
                message: result.error?.message || 'bpftrace execution failed',
                recoverable: true,
                suggestion: result.error?.suggestion || 'Ensure bpftrace is installed and you have root/BPF capabilities',
            },
        };
    }
    // Parse events
    let processEvents = parseBpftraceOutput(result.stdout);
    // Apply name filter if specified
    if (params.name_pattern) {
        const pattern = params.name_pattern.toLowerCase();
        processEvents = processEvents.filter((e) => e.comm.toLowerCase().includes(pattern) ||
            (e.child_comm && e.child_comm.toLowerCase().includes(pattern)) ||
            (e.filename && e.filename.toLowerCase().includes(pattern)));
        notes.push(`Filtered by name pattern: ${params.name_pattern}`);
    }
    // Check truncation
    const truncated = processEvents.length > MAX_EVENTS;
    if (truncated) {
        processEvents = processEvents.slice(0, MAX_EVENTS);
        notes.push(`Output truncated to ${MAX_EVENTS} events`);
    }
    // Build relationships
    const relationships = buildRelationships(processEvents);
    // Build tree if requested
    let tree;
    let maxTreeDepth;
    if (params.mode === 'tree' || params.mode === 'both') {
        tree = buildProcessTree(processEvents);
        maxTreeDepth = getMaxTreeDepth(tree);
    }
    // Calculate summary
    const forkEvents = processEvents.filter((e) => e.event_type === 'fork');
    const execEvents = processEvents.filter((e) => e.event_type === 'exec');
    const exitEvents = processEvents.filter((e) => e.event_type === 'exit');
    const byCommand = {};
    const byParent = {};
    for (const e of execEvents) {
        const cmd = e.filename?.split('/').pop() || e.comm;
        byCommand[cmd] = (byCommand[cmd] || 0) + 1;
    }
    for (const e of forkEvents) {
        byParent[e.comm] = (byParent[e.comm] || 0) + 1;
    }
    // Sort and limit
    const topCommands = Object.fromEntries(Object.entries(byCommand).sort((a, b) => b[1] - a[1]).slice(0, 20));
    const topParents = Object.fromEntries(Object.entries(byParent).sort((a, b) => b[1] - a[1]).slice(0, 20));
    // Analysis notes
    if (forkEvents.length > 100) {
        const rate = forkEvents.length / params.duration_seconds;
        notes.push(`High fork rate: ${rate.toFixed(1)}/sec`);
    }
    if (execEvents.length > 100) {
        const rate = execEvents.length / params.duration_seconds;
        notes.push(`High exec rate: ${rate.toFixed(1)}/sec`);
    }
    // Build filter info
    const filters = {};
    if (params.pid)
        filters.pid = params.pid;
    if (params.name_pattern)
        filters.name_pattern = params.name_pattern;
    if (params.uid !== undefined)
        filters.uid = params.uid;
    if (params.include_failed)
        filters.failed_only = true;
    return {
        success: true,
        tool: 'perf_exec_trace',
        tool_version: TOOL_VERSION,
        timestamp: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        host: process.env.HOSTNAME || 'unknown',
        data: {
            method: 'bpftrace_comprehensive',
            duration_seconds: params.duration_seconds,
            filters: Object.keys(filters).length > 0 ? filters : undefined,
            process_events: params.mode !== 'tree' ? processEvents : undefined,
            relationships,
            tree: params.mode === 'tree' || params.mode === 'both' ? tree : undefined,
            summary: {
                total_execs: execEvents.length,
                unique_commands: Object.keys(byCommand).length,
                exec_rate_per_sec: params.duration_seconds > 0 ? execEvents.length / params.duration_seconds : 0,
                failed_execs: 0, // bpftrace doesn't easily capture this
                by_command: topCommands,
                by_parent: topParents,
                total_forks: forkEvents.length,
                total_exits: exitEvents.length,
                fork_rate_per_sec: params.duration_seconds > 0 ? forkEvents.length / params.duration_seconds : 0,
                max_tree_depth: maxTreeDepth,
            },
            truncated,
            notes,
        },
    };
}
/**
 * Run simple exec tracing with BCC execsnoop (legacy mode)
 */
async function runExecsnoop(params, notes, startTime) {
    notes.push('Using BCC execsnoop for exec-only tracing');
    // Build execsnoop args
    const args = [];
    // Timestamps
    if (params.include_timestamps) {
        args.push('-T'); // Include timestamps
    }
    // Show time-since-boot
    args.push('-t');
    // Failed execs only
    if (params.include_failed) {
        args.push('-x');
        notes.push('Showing only failed exec calls');
    }
    // Name filter
    if (params.name_pattern) {
        args.push('-n', params.name_pattern);
        notes.push(`Filtering by name: ${params.name_pattern}`);
    }
    // Max args
    args.push('--max-args', String(params.max_args));
    // UID filter
    if (params.uid !== undefined) {
        args.push('-U');
        args.push('-u', String(params.uid));
        notes.push(`Filtering by UID: ${params.uid}`);
    }
    // Use actual timeout to stop execsnoop after duration
    const result = await safeExec('execsnoop', args, {
        timeout: params.duration_seconds * 1000,
    });
    // execsnoop may return error due to timeout signal - that's expected
    if (!result.success && !result.stdout) {
        return {
            success: false,
            tool: 'perf_exec_trace',
            tool_version: TOOL_VERSION,
            timestamp: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
            host: process.env.HOSTNAME || 'unknown',
            error: {
                code: result.error?.code || ErrorCode.EXECUTION_FAILED,
                message: result.error?.message || 'execsnoop execution failed',
                recoverable: true,
                suggestion: result.error?.suggestion,
            },
        };
    }
    // Parse output
    const parsed = parseExecsnoop(result.stdout);
    // Convert to our event format with filtering
    let events = parsed.executions.map((e) => ({
        timestamp: e.timestamp,
        parent_comm: e.parentComm,
        pid: e.pid,
        ppid: e.ppid,
        return_code: e.returnCode,
        command: e.args.split(' ')[0] || 'unknown',
        args: e.args,
    }));
    // Filter by PID if specified (post-filter since execsnoop doesn't support ppid filter)
    if (params.pid) {
        events = events.filter((e) => e.ppid === params.pid);
        notes.push(`Filtered to PPID: ${params.pid}`);
    }
    // Check if truncated
    const truncated = events.length > MAX_EVENTS;
    if (truncated) {
        events = events.slice(0, MAX_EVENTS);
        notes.push(`Output truncated to ${MAX_EVENTS} events`);
    }
    // Calculate by-parent summary
    const byParent = {};
    for (const e of parsed.executions) {
        byParent[e.parentComm] = (byParent[e.parentComm] || 0) + 1;
    }
    // Sort by-command by count
    const byCommandSorted = Object.entries(parsed.byComm)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20);
    const byCommand = {};
    for (const [cmd, count] of byCommandSorted) {
        byCommand[cmd] = count;
    }
    // Sort by-parent by count
    const byParentSorted = Object.entries(byParent)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20);
    const topByParent = {};
    for (const [parent, count] of byParentSorted) {
        topByParent[parent] = count;
    }
    // Generate analysis notes
    if (parsed.totalExecs > 100) {
        const rate = parsed.totalExecs / params.duration_seconds;
        notes.push(`High exec rate: ${rate.toFixed(1)}/sec`);
    }
    if (parsed.failedExecs > 0) {
        const failRate = (parsed.failedExecs / parsed.totalExecs) * 100;
        notes.push(`${parsed.failedExecs} failed execs (${failRate.toFixed(1)}%)`);
    }
    // Build filter info
    const filters = {};
    if (params.pid)
        filters.pid = params.pid;
    if (params.name_pattern)
        filters.name_pattern = params.name_pattern;
    if (params.uid !== undefined)
        filters.uid = params.uid;
    if (params.include_failed)
        filters.failed_only = true;
    return {
        success: true,
        tool: 'perf_exec_trace',
        tool_version: TOOL_VERSION,
        timestamp: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        host: process.env.HOSTNAME || 'unknown',
        data: {
            method: 'bcc_execsnoop',
            duration_seconds: params.duration_seconds,
            filters: Object.keys(filters).length > 0 ? filters : undefined,
            events,
            summary: {
                total_execs: parsed.totalExecs,
                unique_commands: Object.keys(parsed.byComm).length,
                exec_rate_per_sec: params.duration_seconds > 0 ? parsed.totalExecs / params.duration_seconds : 0,
                failed_execs: parsed.failedExecs,
                by_command: byCommand,
                by_parent: topByParent,
            },
            truncated,
            notes,
        },
    };
}
//# sourceMappingURL=exec-trace.js.map