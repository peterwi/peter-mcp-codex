/**
 * Zod schemas for tool inputs and outputs
 * All tool parameters are validated before execution
 */
import { z } from 'zod';
import { DURATION_LIMITS, SAMPLE_RATE_LIMITS } from './constants.js';
// Common parameter schemas
export const durationSchema = z
    .number()
    .int()
    .min(DURATION_LIMITS.MIN)
    .max(DURATION_LIMITS.MAX)
    .default(DURATION_LIMITS.DEFAULT)
    .describe(`Duration in seconds (${DURATION_LIMITS.MIN}-${DURATION_LIMITS.MAX})`);
export const sampleRateSchema = z
    .number()
    .int()
    .min(SAMPLE_RATE_LIMITS.MIN)
    .max(SAMPLE_RATE_LIMITS.MAX)
    .default(SAMPLE_RATE_LIMITS.DEFAULT)
    .describe(`Sample rate in Hz (${SAMPLE_RATE_LIMITS.MIN}-${SAMPLE_RATE_LIMITS.MAX})`);
export const pidSchema = z
    .number()
    .int()
    .positive()
    .describe('Process ID (positive integer)');
// Tool-specific input schemas
export const perfInfoInputSchema = z.object({}).describe('No parameters required');
export const perfSnapshotInputSchema = z.object({
    include_per_cpu: z
        .boolean()
        .default(false)
        .describe('Include per-CPU breakdown'),
    include_per_device: z
        .boolean()
        .default(true)
        .describe('Include per-device I/O stats'),
    include_psi: z
        .boolean()
        .default(true)
        .describe('Include PSI metrics (if available)'),
});
export const perfUseCheckInputSchema = z.object({}).describe('No parameters required');
export const perfCpuProfileInputSchema = z.object({
    duration_seconds: durationSchema,
    sample_rate_hz: sampleRateSchema.optional(),
    pid: pidSchema.optional().describe('Profile specific process'),
    include_kernel: z
        .boolean()
        .default(true)
        .describe('Include kernel functions'),
    output_format: z
        .enum(['summary', 'collapsed'])
        .default('summary')
        .describe('Output format'),
});
export const perfOffcpuProfileInputSchema = z.object({
    duration_seconds: durationSchema,
    pid: pidSchema.optional().describe('Profile specific process'),
    min_block_us: z
        .number()
        .int()
        .min(0)
        .default(1000)
        .describe('Minimum block time to record (microseconds)'),
});
export const perfIoLatencyInputSchema = z.object({
    duration_seconds: z
        .number()
        .int()
        .min(1)
        .max(30)
        .default(5)
        .describe('Duration in seconds (1-30)'),
    device: z.string().optional().describe('Filter by device name (e.g., sda)'),
    mode: z
        .enum(['snapshot', 'trace'])
        .default('snapshot')
        .describe('snapshot for iostat, trace for perf tracing'),
});
export const perfNetHealthInputSchema = z.object({
    interface: z.string().optional().describe('Filter by interface name'),
    include_tcp_details: z
        .boolean()
        .default(true)
        .describe('Include detailed TCP statistics'),
});
export const perfCgroupSummaryInputSchema = z.object({
    pid: pidSchema.optional().describe('Find cgroup for this PID'),
    cgroup_path: z
        .string()
        .optional()
        .describe('Cgroup path (e.g., /sys/fs/cgroup/system.slice/myservice)'),
});
export const perfSchedLatencyInputSchema = z.object({
    duration_seconds: z
        .number()
        .int()
        .min(1)
        .max(30)
        .default(5)
        .describe('Duration in seconds (1-30)'),
    pid: pidSchema.optional().describe('Profile specific process'),
});
// Schema for tool list response
export const toolSchemas = {
    perf_info: {
        input: perfInfoInputSchema,
        description: 'Get system information, capabilities, and available features for performance analysis',
    },
    perf_snapshot: {
        input: perfSnapshotInputSchema,
        description: 'Capture a point-in-time snapshot of CPU, memory, I/O, and network metrics',
    },
    perf_use_check: {
        input: perfUseCheckInputSchema,
        description: 'Analyze system using USE method (Utilization, Saturation, Errors) and identify bottlenecks',
    },
    perf_cpu_profile: {
        input: perfCpuProfileInputSchema,
        description: 'Profile on-CPU activity to identify which functions consume CPU time',
    },
    perf_offcpu_profile: {
        input: perfOffcpuProfileInputSchema,
        description: 'Analyze off-CPU time to identify what processes are waiting/blocked on',
    },
    perf_io_latency: {
        input: perfIoLatencyInputSchema,
        description: 'Measure block I/O latency and identify slow storage devices',
    },
    perf_net_health: {
        input: perfNetHealthInputSchema,
        description: 'Check network stack health including drops, errors, and retransmits',
    },
    perf_cgroup_summary: {
        input: perfCgroupSummaryInputSchema,
        description: 'Get resource usage summary for a cgroup (container/service)',
    },
    perf_sched_latency: {
        input: perfSchedLatencyInputSchema,
        description: 'Analyze scheduler run-queue latency by task',
    },
    perf_bio_latency: {
        description: 'Block I/O latency histogram using eBPF - shows distribution of storage I/O latencies (requires BCC)',
    },
    perf_tcp_trace: {
        description: 'TCP connection tracing using eBPF - shows connection lifecycle and latency (requires BCC)',
    },
    perf_runq_latency: {
        description: 'Run queue latency histogram using eBPF - shows CPU scheduler delays (requires BCC)',
    },
    perf_syscall_count: {
        description: 'Count syscalls per process with latency distribution using eBPF - identifies syscall hotspots (requires BCC)',
    },
    perf_exec_trace: {
        description: 'Trace process creation (fork/clone) and exec events using eBPF - comprehensive process lifecycle tracing with tree view support (requires bpftrace or BCC)',
    },
    perf_file_trace: {
        description: 'Trace file operations using eBPF - shows slow I/O, short-lived files, and open calls (requires BCC)',
    },
    perf_dns_latency: {
        description: 'Trace DNS lookup latency using eBPF - shows getaddrinfo/gethostbyname calls with timing (requires BCC)',
    },
    perf_thread_profile: {
        description: 'Per-thread CPU analysis - shows CPU usage, state, and optionally off-CPU time per thread',
    },
    perf_io_layers: {
        description: 'Compare VFS operations to block I/O to measure cache effectiveness and I/O layer behavior',
    },
    perf_fd_trace: {
        description: 'Monitor file descriptor usage and detect potential FD leaks for a process - no BCC required',
    },
    perf_vfs_latency: {
        description: 'VFS (Virtual File System) layer latency distribution - shows which file operations are slow using fileslower or bpftrace',
    },
    perf_triage: {
        description: 'Comprehensive incident triage - runs multiple tools and produces consolidated report with root cause analysis and recommended actions',
    },
};
//# sourceMappingURL=schemas.js.map