/**
 * Zod schemas for tool inputs and outputs
 * All tool parameters are validated before execution
 */
import { z } from 'zod';
export declare const durationSchema: z.ZodDefault<z.ZodNumber>;
export declare const sampleRateSchema: z.ZodDefault<z.ZodNumber>;
export declare const pidSchema: z.ZodNumber;
export declare const perfInfoInputSchema: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
export declare const perfSnapshotInputSchema: z.ZodObject<{
    include_per_cpu: z.ZodDefault<z.ZodBoolean>;
    include_per_device: z.ZodDefault<z.ZodBoolean>;
    include_psi: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    include_per_cpu: boolean;
    include_per_device: boolean;
    include_psi: boolean;
}, {
    include_per_cpu?: boolean | undefined;
    include_per_device?: boolean | undefined;
    include_psi?: boolean | undefined;
}>;
export declare const perfUseCheckInputSchema: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
export declare const perfCpuProfileInputSchema: z.ZodObject<{
    duration_seconds: z.ZodDefault<z.ZodNumber>;
    sample_rate_hz: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    pid: z.ZodOptional<z.ZodNumber>;
    include_kernel: z.ZodDefault<z.ZodBoolean>;
    output_format: z.ZodDefault<z.ZodEnum<["summary", "collapsed"]>>;
}, "strip", z.ZodTypeAny, {
    duration_seconds: number;
    include_kernel: boolean;
    output_format: "summary" | "collapsed";
    sample_rate_hz?: number | undefined;
    pid?: number | undefined;
}, {
    duration_seconds?: number | undefined;
    sample_rate_hz?: number | undefined;
    pid?: number | undefined;
    include_kernel?: boolean | undefined;
    output_format?: "summary" | "collapsed" | undefined;
}>;
export declare const perfOffcpuProfileInputSchema: z.ZodObject<{
    duration_seconds: z.ZodDefault<z.ZodNumber>;
    pid: z.ZodOptional<z.ZodNumber>;
    min_block_us: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    duration_seconds: number;
    min_block_us: number;
    pid?: number | undefined;
}, {
    duration_seconds?: number | undefined;
    pid?: number | undefined;
    min_block_us?: number | undefined;
}>;
export declare const perfIoLatencyInputSchema: z.ZodObject<{
    duration_seconds: z.ZodDefault<z.ZodNumber>;
    device: z.ZodOptional<z.ZodString>;
    mode: z.ZodDefault<z.ZodEnum<["snapshot", "trace"]>>;
}, "strip", z.ZodTypeAny, {
    duration_seconds: number;
    mode: "snapshot" | "trace";
    device?: string | undefined;
}, {
    duration_seconds?: number | undefined;
    device?: string | undefined;
    mode?: "snapshot" | "trace" | undefined;
}>;
export declare const perfNetHealthInputSchema: z.ZodObject<{
    interface: z.ZodOptional<z.ZodString>;
    include_tcp_details: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    include_tcp_details: boolean;
    interface?: string | undefined;
}, {
    interface?: string | undefined;
    include_tcp_details?: boolean | undefined;
}>;
export declare const perfCgroupSummaryInputSchema: z.ZodObject<{
    pid: z.ZodOptional<z.ZodNumber>;
    cgroup_path: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    pid?: number | undefined;
    cgroup_path?: string | undefined;
}, {
    pid?: number | undefined;
    cgroup_path?: string | undefined;
}>;
export declare const perfSchedLatencyInputSchema: z.ZodObject<{
    duration_seconds: z.ZodDefault<z.ZodNumber>;
    pid: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    duration_seconds: number;
    pid?: number | undefined;
}, {
    duration_seconds?: number | undefined;
    pid?: number | undefined;
}>;
export interface PerfResponse<T> {
    success: boolean;
    tool: string;
    tool_version: string;
    timestamp: string;
    duration_ms: number;
    host: string;
    data?: T;
    error?: {
        code: string;
        message: string;
        recoverable: boolean;
        suggestion?: string;
    };
    truncated?: boolean;
    warnings?: string[];
}
export interface PerfInfoData {
    system: {
        hostname: string;
        kernel: string;
        arch: string;
        uptime_seconds: number;
        boot_time: string;
    };
    cpu: {
        model: string;
        cores: number;
        threads: number;
        numa_nodes: number;
        scaling_governor: string;
    };
    virtualization: {
        type: string;
        container: boolean;
        cgroup_version: number;
    };
    capabilities: {
        perf_available: boolean;
        perf_permitted: boolean;
        bpf_available: boolean;
        bpf_permitted: boolean;
        btf_available: boolean;
        psi_enabled: boolean;
    };
    ebpf?: {
        bcc_installed: boolean;
        bcc_tools_available: number;
        bcc_tools_total: number;
        available_tools: string[];
        unavailable_tools: string[];
    };
    memory: {
        total_bytes: number;
        huge_pages_enabled: boolean;
        thp_enabled: boolean;
    };
}
export interface CpuUtilization {
    user: number;
    system: number;
    nice: number;
    idle: number;
    iowait: number;
    irq: number;
    softirq: number;
    steal: number;
}
export interface MemoryStats {
    total_bytes: number;
    available_bytes: number;
    used_bytes: number;
    buffers_bytes: number;
    cached_bytes: number;
    swap_used_bytes: number;
    swap_total_bytes: number;
    page_faults: number;
    major_faults: number;
}
export interface IoDeviceStats {
    name: string;
    reads_per_sec: number;
    writes_per_sec: number;
    read_bytes_per_sec: number;
    write_bytes_per_sec: number;
    avg_queue_size: number;
    utilization: number;
    avg_wait_ms: number;
}
export interface NetworkInterfaceStats {
    name: string;
    rx_bytes: number;
    tx_bytes: number;
    rx_packets: number;
    tx_packets: number;
    rx_errors: number;
    tx_errors: number;
    rx_dropped: number;
    tx_dropped: number;
}
export interface TcpStats {
    active_connections: number;
    passive_connections: number;
    retransmits: number;
    in_segs: number;
    out_segs: number;
}
export interface PsiMetrics {
    some_avg10: number;
    some_avg60: number;
    some_avg300: number;
    full_avg10: number;
    full_avg60: number;
    full_avg300: number;
    some_total: number;
    full_total: number;
}
export interface PerfSnapshotData {
    cpu: {
        load_avg: [number, number, number];
        run_queue: number;
        utilization: CpuUtilization;
        context_switches: number;
        interrupts: number;
    };
    memory: MemoryStats;
    io: {
        devices: IoDeviceStats[];
    };
    network: {
        interfaces: NetworkInterfaceStats[];
        tcp: TcpStats;
    };
    pressure?: {
        cpu: PsiMetrics;
        memory: PsiMetrics;
        io: PsiMetrics;
    };
}
export type UseStatus = 'ok' | 'warning' | 'critical';
export interface UseMetric {
    value?: number;
    count?: number;
    status: UseStatus;
    detail: string;
}
export interface UseResourceMetrics {
    utilization: UseMetric;
    saturation: UseMetric;
    errors: UseMetric;
}
export interface PerfUseCheckData {
    summary: {
        status: 'healthy' | 'warning' | 'critical';
        top_suspicions: string[];
    };
    resources: {
        cpu: UseResourceMetrics;
        memory: UseResourceMetrics;
        disk: UseResourceMetrics;
        network: UseResourceMetrics;
    };
}
export interface CpuProfileSample {
    symbol: string;
    module: string;
    percent: number;
    samples: number;
}
export interface PerfCpuProfileData {
    total_samples: number;
    duration_seconds: number;
    sample_rate: number;
    top_functions: CpuProfileSample[];
    kernel_percent: number;
    user_percent: number;
    notes: string[];
}
export interface OffcpuSample {
    task: string;
    pid: number;
    total_time_ms: number;
    wait_type: string;
    call_chain: string[];
}
export interface PerfOffcpuProfileData {
    total_blocked_ms: number;
    duration_seconds: number;
    top_blockers: OffcpuSample[];
    notes: string[];
}
export interface PerfIoLatencyData {
    mode: string;
    duration_seconds: number;
    devices: IoDeviceStats[];
    latency_histogram?: {
        bucket_ms: number;
        count: number;
    }[];
    notes: string[];
}
export interface PerfNetHealthData {
    interfaces: Array<NetworkInterfaceStats & {
        speed_mbps?: number;
        duplex?: string;
    }>;
    tcp: TcpStats & {
        retransmit_rate: number;
        reset_rate: number;
    };
    socket_summary: {
        tcp_total: number;
        tcp_established: number;
        tcp_time_wait: number;
        udp_total: number;
    };
    issues: string[];
}
export interface CgroupCpuStats {
    usage_usec: number;
    user_usec: number;
    system_usec: number;
    nr_throttled: number;
    throttled_usec: number;
}
export interface CgroupMemoryStats {
    current_bytes: number;
    max_bytes: number;
    usage_percent: number;
    anon_bytes: number;
    file_bytes: number;
    oom_kills: number;
}
export interface CgroupIoStats {
    devices: Array<{
        device: string;
        rbytes: number;
        wbytes: number;
        rios: number;
        wios: number;
    }>;
}
export interface PerfCgroupSummaryData {
    cgroup_path: string;
    cpu: CgroupCpuStats & {
        limit_cores?: number;
        pressure?: PsiMetrics;
    };
    memory: CgroupMemoryStats & {
        pressure?: PsiMetrics;
    };
    io: CgroupIoStats & {
        pressure?: PsiMetrics;
    };
    pids: {
        current: number;
        max: number;
    };
    issues: string[];
}
export interface SchedLatencyTask {
    task: string;
    pid: number;
    runtime_ms: number;
    wait_time_ms: number;
    max_wait_ms: number;
    switches: number;
}
export interface PerfSchedLatencyData {
    duration_seconds: number;
    tasks: SchedLatencyTask[];
    summary: {
        total_tasks: number;
        avg_wait_ms: number;
        max_wait_ms: number;
        context_switches: number;
    };
    notes: string[];
}
export declare const toolSchemas: {
    readonly perf_info: {
        readonly input: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
        readonly description: "Get system information, capabilities, and available features for performance analysis";
    };
    readonly perf_snapshot: {
        readonly input: z.ZodObject<{
            include_per_cpu: z.ZodDefault<z.ZodBoolean>;
            include_per_device: z.ZodDefault<z.ZodBoolean>;
            include_psi: z.ZodDefault<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            include_per_cpu: boolean;
            include_per_device: boolean;
            include_psi: boolean;
        }, {
            include_per_cpu?: boolean | undefined;
            include_per_device?: boolean | undefined;
            include_psi?: boolean | undefined;
        }>;
        readonly description: "Capture a point-in-time snapshot of CPU, memory, I/O, and network metrics";
    };
    readonly perf_use_check: {
        readonly input: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
        readonly description: "Analyze system using USE method (Utilization, Saturation, Errors) and identify bottlenecks";
    };
    readonly perf_cpu_profile: {
        readonly input: z.ZodObject<{
            duration_seconds: z.ZodDefault<z.ZodNumber>;
            sample_rate_hz: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
            pid: z.ZodOptional<z.ZodNumber>;
            include_kernel: z.ZodDefault<z.ZodBoolean>;
            output_format: z.ZodDefault<z.ZodEnum<["summary", "collapsed"]>>;
        }, "strip", z.ZodTypeAny, {
            duration_seconds: number;
            include_kernel: boolean;
            output_format: "summary" | "collapsed";
            sample_rate_hz?: number | undefined;
            pid?: number | undefined;
        }, {
            duration_seconds?: number | undefined;
            sample_rate_hz?: number | undefined;
            pid?: number | undefined;
            include_kernel?: boolean | undefined;
            output_format?: "summary" | "collapsed" | undefined;
        }>;
        readonly description: "Profile on-CPU activity to identify which functions consume CPU time";
    };
    readonly perf_offcpu_profile: {
        readonly input: z.ZodObject<{
            duration_seconds: z.ZodDefault<z.ZodNumber>;
            pid: z.ZodOptional<z.ZodNumber>;
            min_block_us: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            duration_seconds: number;
            min_block_us: number;
            pid?: number | undefined;
        }, {
            duration_seconds?: number | undefined;
            pid?: number | undefined;
            min_block_us?: number | undefined;
        }>;
        readonly description: "Analyze off-CPU time to identify what processes are waiting/blocked on";
    };
    readonly perf_io_latency: {
        readonly input: z.ZodObject<{
            duration_seconds: z.ZodDefault<z.ZodNumber>;
            device: z.ZodOptional<z.ZodString>;
            mode: z.ZodDefault<z.ZodEnum<["snapshot", "trace"]>>;
        }, "strip", z.ZodTypeAny, {
            duration_seconds: number;
            mode: "snapshot" | "trace";
            device?: string | undefined;
        }, {
            duration_seconds?: number | undefined;
            device?: string | undefined;
            mode?: "snapshot" | "trace" | undefined;
        }>;
        readonly description: "Measure block I/O latency and identify slow storage devices";
    };
    readonly perf_net_health: {
        readonly input: z.ZodObject<{
            interface: z.ZodOptional<z.ZodString>;
            include_tcp_details: z.ZodDefault<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            include_tcp_details: boolean;
            interface?: string | undefined;
        }, {
            interface?: string | undefined;
            include_tcp_details?: boolean | undefined;
        }>;
        readonly description: "Check network stack health including drops, errors, and retransmits";
    };
    readonly perf_cgroup_summary: {
        readonly input: z.ZodObject<{
            pid: z.ZodOptional<z.ZodNumber>;
            cgroup_path: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            pid?: number | undefined;
            cgroup_path?: string | undefined;
        }, {
            pid?: number | undefined;
            cgroup_path?: string | undefined;
        }>;
        readonly description: "Get resource usage summary for a cgroup (container/service)";
    };
    readonly perf_sched_latency: {
        readonly input: z.ZodObject<{
            duration_seconds: z.ZodDefault<z.ZodNumber>;
            pid: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            duration_seconds: number;
            pid?: number | undefined;
        }, {
            duration_seconds?: number | undefined;
            pid?: number | undefined;
        }>;
        readonly description: "Analyze scheduler run-queue latency by task";
    };
    readonly perf_bio_latency: {
        readonly description: "Block I/O latency histogram using eBPF - shows distribution of storage I/O latencies (requires BCC)";
    };
    readonly perf_tcp_trace: {
        readonly description: "TCP connection tracing using eBPF - shows connection lifecycle and latency (requires BCC)";
    };
    readonly perf_runq_latency: {
        readonly description: "Run queue latency histogram using eBPF - shows CPU scheduler delays (requires BCC)";
    };
    readonly perf_syscall_count: {
        readonly description: "Count syscalls per process with latency distribution using eBPF - identifies syscall hotspots (requires BCC)";
    };
    readonly perf_exec_trace: {
        readonly description: "Trace process creation (fork/clone) and exec events using eBPF - comprehensive process lifecycle tracing with tree view support (requires bpftrace or BCC)";
    };
    readonly perf_file_trace: {
        readonly description: "Trace file operations using eBPF - shows slow I/O, short-lived files, and open calls (requires BCC)";
    };
    readonly perf_dns_latency: {
        readonly description: "Trace DNS lookup latency using eBPF - shows getaddrinfo/gethostbyname calls with timing (requires BCC)";
    };
    readonly perf_thread_profile: {
        readonly description: "Per-thread CPU analysis - shows CPU usage, state, and optionally off-CPU time per thread";
    };
    readonly perf_io_layers: {
        readonly description: "Compare VFS operations to block I/O to measure cache effectiveness and I/O layer behavior";
    };
    readonly perf_fd_trace: {
        readonly description: "Monitor file descriptor usage and detect potential FD leaks for a process - no BCC required";
    };
    readonly perf_vfs_latency: {
        readonly description: "VFS (Virtual File System) layer latency distribution - shows which file operations are slow using fileslower or bpftrace";
    };
    readonly perf_triage: {
        readonly description: "Comprehensive incident triage - runs multiple tools and produces consolidated report with root cause analysis and recommended actions";
    };
};
export type ToolName = keyof typeof toolSchemas;
//# sourceMappingURL=schemas.d.ts.map