# perf-mcp Design Specification

A production-quality Model Context Protocol (MCP) server for Linux performance troubleshooting.

## Executive Summary

`perf-mcp` provides structured, safe access to Linux performance observability tools, enabling AI agents to diagnose performance bottlenecks using established methodologies (USE method) and standard Linux tooling (procfs, perf, eBPF, sysstat).

**Key Principles:**
- **Safe by default**: No shell execution, strict schema validation, allowlisted executables only
- **Methodology-driven**: Built around USE method (Utilization, Saturation, Errors)
- **Structured outputs**: JSON schemas suitable for LLM orchestration
- **Graceful degradation**: Works with reduced capabilities when tools/permissions unavailable

---

## 1. Threat Model & Safety Constraints

### 1.1 Threat Vectors

| Threat | Mitigation |
|--------|------------|
| **Command injection** | No shell execution; spawn executables with argv arrays only |
| **Path traversal** | Allowlist of readable paths (procfs, sysfs, cgroup fs) |
| **Resource exhaustion** | Timeouts (5-60s), output size limits (64KB default) |
| **Information disclosure** | Limit sensitive paths; no arbitrary file reads |
| **Denial of service** | Rate limiting, single concurrent profiler |
| **Privilege escalation** | Capability detection; graceful fallback |

### 1.2 Safety Constraints (Non-Negotiable)

1. **No shell execution**: Never use `shell=true`, `bash -c`, or string-based command construction
2. **Allowlist executables**: Only spawn from predefined list with validated subcommands
3. **Strict schemas**: All inputs validated via Zod before execution
4. **Bounded execution**: All tools have timeouts (default 15s, max 60s for profilers)
5. **Output limits**: Truncate output at 64KB with truncation indicator
6. **Read-only by default**: All tools marked `readOnlyHint: true` unless explicitly destructive

### 1.3 Executable Allowlist

```typescript
const ALLOWED_EXECUTABLES = {
  // System info (no special permissions)
  'uname': ['-a', '-r', '-m'],
  'lscpu': ['--json', '-e'],
  'lsblk': ['--json', '-o', 'NAME,SIZE,TYPE,MOUNTPOINT,MODEL'],
  'hostname': [],

  // Procfs/sysfs readers (read-only)
  'cat': ['/proc/*', '/sys/*'],  // path-validated

  // Network tools
  'ss': ['-tunap', '-s', '--no-header'],
  'ip': ['-s', 'link', 'addr', '-j'],
  'nstat': ['-az'],

  // Sysstat tools
  'vmstat': ['<count>', '<interval>'],
  'iostat': ['-xz', '-d', '-c', '<interval>', '<count>'],
  'mpstat': ['-P', 'ALL', '<interval>', '<count>'],
  'pidstat': ['-u', '-d', '-r', '-w', '<interval>', '<count>'],
  'sar': ['-u', '-r', '-b', '-n', 'DEV', '-q'],

  // Perf (requires CAP_PERFMON or root)
  'perf': ['stat', 'record', 'report', 'script', 'sched'],

  // Optional eBPF tools (requires CAP_BPF/CAP_SYS_ADMIN)
  'bpftrace': ['<validated-script>'],  // curated scripts only
  'bpftool': ['prog', 'map', 'btf', 'feature'],
} as const;
```

### 1.4 Path Validation Rules

```typescript
const ALLOWED_READ_PATHS = [
  /^\/proc\/(stat|meminfo|loadavg|vmstat|diskstats|net\/.*|pressure\/.*)$/,
  /^\/proc\/\d+\/(stat|status|schedstat|cgroup|io|maps)$/,
  /^\/sys\/fs\/cgroup\/.*\/(cpu\.stat|memory\..*|io\..*|pids\..*)$/,
  /^\/sys\/block\/[a-z]+\/stat$/,
  /^\/sys\/devices\/system\/cpu\/.*$/,
  /^\/sys\/kernel\/mm\/transparent_hugepage\/.*$/,
];
```

---

## 2. Tool Taxonomy & Naming

### 2.1 Naming Convention

```
perf_<domain>_<action>
```

- **Domain**: `info`, `cpu`, `mem`, `io`, `net`, `sched`, `cgroup`
- **Action**: `snapshot`, `profile`, `check`, `latency`, `summary`

### 2.2 Tool Categories

| Category | Tools | Purpose |
|----------|-------|---------|
| **Discovery** | `perf_info` | System/capability detection |
| **Snapshot** | `perf_snapshot` | Point-in-time metrics |
| **Methodology** | `perf_use_check` | USE method analysis |
| **CPU** | `perf_cpu_profile`, `perf_offcpu_profile` | On/off-CPU analysis |
| **I/O** | `perf_io_latency` | Block I/O performance |
| **Network** | `perf_net_health` | Network stack health |
| **Container** | `perf_cgroup_summary` | Cgroup v2 resource usage |

### 2.3 Complete Tool List

```typescript
const TOOLS = [
  // Tier 1: Always available (no special permissions)
  'perf_info',           // System info, capability detection
  'perf_snapshot',       // One-shot system metrics (supports interval mode)
  'perf_use_check',      // USE method analysis
  'perf_fd_trace',       // FD leak detection (procfs only)

  // Tier 2: May require elevated permissions
  'perf_cpu_profile',    // On-CPU profiling (perf record)
  'perf_offcpu_profile', // Off-CPU analysis (perf sched)
  'perf_io_latency',     // Block I/O latency
  'perf_net_health',     // Network health summary
  'perf_cgroup_summary', // Cgroup v2 analysis
  'perf_thread_profile', // Per-thread CPU analysis

  // Tier 3: eBPF power tools (require BCC)
  'perf_bio_latency',    // Block I/O histogram (log2 or linear)
  'perf_runq_latency',   // Run queue latency histogram
  'perf_tcp_trace',      // TCP connection tracing
  'perf_syscall_count',  // Syscall counting with latency
  'perf_exec_trace',     // Process exec tracing
  'perf_file_trace',     // File operation tracing
  'perf_dns_latency',    // DNS lookup latency
  'perf_io_layers',      // VFS vs block I/O comparison
  'perf_vfs_latency',    // VFS layer latency distribution
] as const;
```

---

## 3. Output Contracts

### 3.1 Base Response Schema

```typescript
interface PerfResponse<T> {
  success: boolean;
  tool: string;
  tool_version: string;
  timestamp: string;           // ISO 8601
  duration_ms: number;
  host: string;

  // Success case
  data?: T;

  // Error case
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
    suggestion?: string;
  };

  // Truncation indicator
  truncated?: boolean;
  truncated_at?: number;

  // Capability warnings
  warnings?: string[];
}
```

### 3.2 Domain-Specific Schemas

#### perf_info Response

```typescript
interface PerfInfoData {
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
    type: 'none' | 'kvm' | 'xen' | 'vmware' | 'hyperv' | 'docker' | 'lxc' | 'unknown';
    container: boolean;
    cgroup_version: 1 | 2;
  };
  capabilities: {
    perf_available: boolean;
    perf_permitted: boolean;
    bpf_available: boolean;
    btf_available: boolean;
    psi_enabled: boolean;
  };
  memory: {
    total_bytes: number;
    huge_pages_enabled: boolean;
    thp_enabled: boolean;
  };
}
```

#### perf_snapshot Response

```typescript
interface PerfSnapshotData {
  cpu: {
    load_avg: [number, number, number];
    run_queue: number;
    utilization: {
      user: number;
      system: number;
      iowait: number;
      steal: number;
      idle: number;
    };
    context_switches: number;
    interrupts: number;
  };
  memory: {
    total_bytes: number;
    available_bytes: number;
    used_bytes: number;
    buffers_bytes: number;
    cached_bytes: number;
    swap_used_bytes: number;
    swap_total_bytes: number;
    page_faults: number;
    major_faults: number;
  };
  io: {
    devices: Array<{
      name: string;
      reads_per_sec: number;
      writes_per_sec: number;
      read_bytes_per_sec: number;
      write_bytes_per_sec: number;
      avg_queue_size: number;
      utilization: number;
      avg_wait_ms: number;
    }>;
  };
  network: {
    interfaces: Array<{
      name: string;
      rx_bytes: number;
      tx_bytes: number;
      rx_packets: number;
      tx_packets: number;
      rx_errors: number;
      tx_errors: number;
      rx_dropped: number;
      tx_dropped: number;
    }>;
    tcp: {
      active_connections: number;
      passive_connections: number;
      retransmits: number;
      in_segs: number;
      out_segs: number;
    };
  };
  pressure?: {  // PSI if available
    cpu: { some_avg10: number; some_avg60: number; full_avg10: number; full_avg60: number };
    memory: { some_avg10: number; some_avg60: number; full_avg10: number; full_avg60: number };
    io: { some_avg10: number; some_avg60: number; full_avg10: number; full_avg60: number };
  };
}
```

#### perf_use_check Response

```typescript
interface UseCheckData {
  summary: {
    status: 'healthy' | 'warning' | 'critical';
    top_suspicions: string[];
  };
  resources: {
    cpu: UseMetrics;
    memory: UseMetrics;
    disk: UseMetrics;
    network: UseMetrics;
  };
}

interface UseMetrics {
  utilization: {
    value: number;
    status: 'ok' | 'warning' | 'critical';
    detail: string;
  };
  saturation: {
    value: number;
    status: 'ok' | 'warning' | 'critical';
    detail: string;
  };
  errors: {
    count: number;
    status: 'ok' | 'warning' | 'critical';
    detail: string;
  };
}
```

---

## 4. Execution Model

### 4.1 Timeouts

| Tool Category | Default Timeout | Max Timeout |
|---------------|-----------------|-------------|
| Snapshot tools | 5s | 15s |
| Profile tools | 15s | 60s |
| Trace tools | 10s | 30s |

### 4.2 Sampling Durations

For profiling/tracing tools that run for a duration:

```typescript
interface DurationParams {
  duration_seconds: number;  // min: 1, max: 60, default: 5
  sample_rate_hz?: number;   // min: 1, max: 999, default: 99
}
```

### 4.3 Concurrency

- Maximum 1 profiler running at a time (perf record, bpftrace)
- Snapshot tools can run concurrently
- Internal mutex for profiler access

### 4.4 Output Size Limits

```typescript
const OUTPUT_LIMITS = {
  default: 64 * 1024,       // 64KB
  profile: 256 * 1024,      // 256KB for flame data
  max: 1024 * 1024,         // 1MB absolute max
};
```

---

## 5. Capability Detection & Graceful Fallback

### 5.1 Detection Strategy

```typescript
interface Capabilities {
  // Check once at startup, cache results
  kernel_version: string;
  has_perf: boolean;
  perf_paranoid: number;      // /proc/sys/kernel/perf_event_paranoid
  has_bpftrace: boolean;
  has_bpftool: boolean;
  has_btf: boolean;           // /sys/kernel/btf/vmlinux exists
  has_psi: boolean;           // /proc/pressure/* exists
  cgroup_version: 1 | 2;
  is_container: boolean;
  effective_caps: string[];   // CAP_* we have
}
```

### 5.2 Fallback Strategies

| Scenario | Primary | Fallback |
|----------|---------|----------|
| No perf access | `perf record` | procfs sampling |
| No eBPF | bpftrace | perf tracepoints |
| No BTF | bpftrace with vmlinux | manual struct parsing |
| Container | Full host tools | cgroup-scoped procfs |
| No root | CAP_* tools | unprivileged procfs only |

### 5.3 Error Messages

```typescript
const CAPABILITY_ERRORS = {
  PERF_NOT_INSTALLED: {
    code: 'PERF_NOT_INSTALLED',
    message: 'perf tools not found',
    suggestion: 'Install linux-tools-generic or linux-perf package',
  },
  PERF_PARANOID: {
    code: 'PERF_PARANOID',
    message: 'perf_event_paranoid restricts access',
    suggestion: 'Run as root or set /proc/sys/kernel/perf_event_paranoid to -1',
  },
  NO_CAP_PERFMON: {
    code: 'NO_CAP_PERFMON',
    message: 'Missing CAP_PERFMON capability',
    suggestion: 'Run with sudo or grant CAP_PERFMON',
  },
  // ... etc
};
```

---

## 6. Golden Workflows

### 6.1 Quick Triage (60-120 seconds)

```
1. perf_info           → Understand system, detect capabilities
2. perf_snapshot       → Baseline metrics
3. perf_use_check      → USE method analysis
4. [Based on suspicions, drill down]
```

**Agent Prompt:**
> "Run a quick performance triage. Start with system info, take a metrics snapshot, then analyze using the USE method. Report the top 3 suspected bottlenecks."

### 6.2 CPU-Bound Investigation

```
1. perf_snapshot       → Confirm high CPU utilization
2. perf_cpu_profile    → On-CPU flame graph / top functions
3. perf_sched_latency  → Check for scheduler issues
```

**Agent Prompt:**
> "The system feels slow. CPU shows high utilization. Profile CPU usage for 10 seconds and identify the top CPU consumers."

### 6.3 Latency-Bound Investigation (Off-CPU)

```
1. perf_snapshot       → Low CPU but slow response
2. perf_offcpu_profile → Where is time spent waiting?
3. perf_io_latency     → Is it I/O bound?
```

**Agent Prompt:**
> "Application response times are high but CPU utilization is low. Analyze off-CPU time to find what the application is waiting on."

### 6.4 Memory Pressure

```
1. perf_snapshot       → Check memory metrics + PSI
2. perf_use_check      → Memory saturation indicators
3. perf_cgroup_summary → Container memory limits
```

**Agent Prompt:**
> "Check for memory pressure. Look at available memory, swap usage, page faults, and PSI metrics. Is the system reclaiming aggressively?"

### 6.5 Block I/O Performance

```
1. perf_snapshot       → Per-device I/O stats
2. perf_io_latency     → I/O latency distribution
3. perf_use_check      → Disk saturation (queue depth)
```

**Agent Prompt:**
> "Database queries are slow. Analyze block I/O latency and saturation. Which devices are bottlenecked?"

### 6.6 Network Issues

```
1. perf_net_health     → Drops, errors, retransmits
2. perf_snapshot       → Interface counters
3. [Optional] perf_trace_syscalls filter=network
```

**Agent Prompt:**
> "Network performance is degraded. Check for packet drops, TCP retransmits, and interface errors."

### 6.7 Container/Cgroup Bottlenecks

```
1. perf_info           → Detect container, cgroup version
2. perf_cgroup_summary → CPU throttling, memory limits
3. perf_snapshot       → PSI metrics
```

**Agent Prompt:**
> "A containerized application is throttled. Check cgroup CPU and memory limits, throttling events, and PSI."

---

## 7. Architecture

### 7.1 Directory Structure

```
perf-mcp/
├── package.json
├── tsconfig.json
├── biome.json
├── README.md
├── docs/
│   ├── design.md            # This document
│   ├── tool_reference.md    # Detailed tool documentation
│   └── workflows.md         # Usage workflows
├── src/
│   ├── index.ts             # Entry point
│   ├── server.ts            # MCP server setup
│   ├── tools/
│   │   ├── index.ts         # Tool registry
│   │   ├── info.ts          # perf_info
│   │   ├── snapshot.ts      # perf_snapshot
│   │   ├── use-check.ts     # perf_use_check
│   │   ├── cpu-profile.ts   # perf_cpu_profile
│   │   ├── offcpu-profile.ts
│   │   ├── io-latency.ts
│   │   ├── net-health.ts
│   │   ├── cgroup-summary.ts
│   │   └── sched-latency.ts
│   ├── lib/
│   │   ├── exec.ts          # Safe command execution
│   │   ├── detect.ts        # Capability detection
│   │   ├── schemas.ts       # Zod schemas
│   │   └── constants.ts     # Allowlists, limits
│   ├── parse/
│   │   ├── procfs.ts        # /proc parsers
│   │   ├── sysfs.ts         # /sys parsers
│   │   ├── iostat.ts        # iostat output parser
│   │   ├── vmstat.ts        # vmstat output parser
│   │   ├── perf.ts          # perf output parser
│   │   └── ss.ts            # ss output parser
│   └── resources/
│       └── artifacts.ts     # Artifact storage/retrieval
├── tests/
│   ├── unit/
│   │   ├── parse/           # Parser unit tests
│   │   └── lib/             # Lib unit tests
│   └── integration/
│       └── smoke.test.ts    # Integration smoke tests
└── evals/
    └── questions.xml        # Evaluation pack
```

### 7.2 Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| `server.ts` | MCP protocol, tool registration, request routing |
| `lib/exec.ts` | Safe subprocess spawning with allowlist enforcement |
| `lib/detect.ts` | Capability detection at startup |
| `tools/*` | Individual tool implementations |
| `parse/*` | Convert command output to structured JSON |
| `resources/artifacts.ts` | Store/retrieve profiling artifacts |

### 7.3 Request Flow

```
MCP Client
    │
    ▼
server.ts (validate request)
    │
    ▼
tools/<tool>.ts (prepare parameters)
    │
    ▼
lib/exec.ts (allowlist check, spawn)
    │
    ▼
parse/<parser>.ts (structure output)
    │
    ▼
Response (JSON)
```

---

## 8. MCP Resource Support

### 8.1 Artifact Storage

Profiling tools can store artifacts (raw output, collapsed stacks) for later retrieval.

```typescript
// Storage path
const ARTIFACT_DIR = '/tmp/perf-mcp/artifacts';

// Artifact metadata
interface Artifact {
  id: string;           // UUID
  run_id: string;       // Run session ID
  tool: string;         // Tool that created it
  type: 'raw' | 'collapsed' | 'json';
  filename: string;
  created_at: string;
  size_bytes: number;
  ttl_seconds: number;  // Auto-cleanup after TTL
}
```

### 8.2 Resource Tools

```typescript
// List artifacts for a run
perf_list_artifacts(run_id?: string): Artifact[]

// Get artifact content
perf_get_artifact(artifact_id: string): { content: string; metadata: Artifact }
```

---

## 9. Tool Specifications

### 9.1 perf_info

**Purpose**: System information and capability detection

**Parameters**: None

**Permissions**: None required

**Timeout**: 5s

**Implementation**:
- Read `/proc/version`, `/proc/cpuinfo`, `/proc/meminfo`
- Check tool availability via `which`
- Check `/proc/sys/kernel/perf_event_paranoid`
- Detect virtualization via `/sys/class/dmi/id/*` and `/proc/1/cgroup`
- Check cgroup version via `/sys/fs/cgroup/cgroup.controllers`

### 9.2 perf_snapshot

**Purpose**: One-shot system metrics across CPU/memory/I/O/network

**Parameters**:
```typescript
{
  include_per_cpu?: boolean;   // Default: false
  include_per_device?: boolean; // Default: true
  include_psi?: boolean;       // Default: true (if available)
}
```

**Permissions**: None (procfs readable)

**Timeout**: 10s

**Implementation**:
- Parse `/proc/stat`, `/proc/meminfo`, `/proc/loadavg`
- Parse `/proc/diskstats` or run `iostat -xz 1 1`
- Parse `/proc/net/dev`, `/proc/net/snmp`
- Read `/proc/pressure/*` if available

### 9.3 perf_use_check

**Purpose**: USE method analysis with suspicions

**Parameters**: None

**Permissions**: None

**Timeout**: 15s

**Implementation**:
- Collect perf_snapshot data
- Apply USE method thresholds:
  - CPU: utilization > 70% warning, > 90% critical; run_queue > cores saturation
  - Memory: available < 10% warning; swap_used > 0 saturation; OOM kills errors
  - Disk: utilization > 60% warning; avgqu-sz > 2 saturation
  - Network: drops > 0 warning; retransmits/s > 1% errors
- Generate suspicion list sorted by severity

### 9.4 perf_cpu_profile

**Purpose**: On-CPU profiling using perf

**Parameters**:
```typescript
{
  duration_seconds: number;  // 1-60, default 5
  sample_rate_hz?: number;   // 1-999, default 99
  pid?: number;              // Optional: profile specific process
  include_kernel?: boolean;  // Default: true
  output_format?: 'summary' | 'collapsed';  // Default: summary
}
```

**Permissions**: CAP_PERFMON or perf_event_paranoid <= 1

**Timeout**: duration_seconds + 10s

**Implementation**:
```bash
perf record -F <rate> -a -g -- sleep <duration>
perf report --stdio --no-children
```

### 9.5 perf_offcpu_profile

**Purpose**: Off-CPU (blocked time) analysis

**Parameters**:
```typescript
{
  duration_seconds: number;  // 1-60, default 5
  pid?: number;
  min_block_us?: number;     // Minimum block time to record, default 1000
}
```

**Permissions**: CAP_PERFMON + CAP_SYS_ADMIN (for sched tracepoints)

**Timeout**: duration_seconds + 15s

**Implementation**:
```bash
perf sched record -- sleep <duration>
perf sched timehist
```

### 9.6 perf_io_latency

**Purpose**: Block I/O latency analysis

**Parameters**:
```typescript
{
  duration_seconds?: number;  // 1-30, default 5 (for tracing mode)
  device?: string;            // Filter by device name
  mode?: 'snapshot' | 'trace'; // Default: snapshot
}
```

**Permissions**: None for snapshot; CAP_PERFMON for trace

**Timeout**: duration_seconds + 10s

**Implementation**:
- Snapshot mode: `iostat -xz 1 2` (take second sample)
- Trace mode: `perf record -e block:block_rq_complete` + latency calculation

### 9.7 perf_net_health

**Purpose**: Network stack health summary

**Parameters**:
```typescript
{
  interface?: string;  // Filter by interface
  include_tcp_details?: boolean;  // Default: true
}
```

**Permissions**: None

**Timeout**: 10s

**Implementation**:
- Parse `/proc/net/dev` for interface stats
- Run `ss -s` for socket summary
- Parse `/proc/net/snmp` and `/proc/net/netstat` for TCP metrics
- Run `nstat -az` for detailed counters

### 9.8 perf_cgroup_summary

**Purpose**: Cgroup v2 resource usage for containers

**Parameters**:
```typescript
{
  pid?: number;         // Find cgroup for this PID
  cgroup_path?: string; // Or specify cgroup path directly
}
```

**Permissions**: Read access to /sys/fs/cgroup

**Timeout**: 5s

**Implementation**:
- Find cgroup from `/proc/<pid>/cgroup` or use provided path
- Read `cpu.stat` (usage_usec, throttled_usec, nr_throttled)
- Read `cpu.max` for limits
- Read `memory.current`, `memory.max`, `memory.stat`
- Read `memory.pressure` (PSI)
- Read `io.stat`, `io.pressure`
- Read `pids.current`, `pids.max`

### 9.9 perf_sched_latency

**Purpose**: Scheduler run-queue latency analysis

**Parameters**:
```typescript
{
  duration_seconds: number;  // 1-30, default 5
  pid?: number;
}
```

**Permissions**: CAP_PERFMON

**Timeout**: duration_seconds + 10s

**Implementation**:
```bash
perf sched record -- sleep <duration>
perf sched latency
```

### 9.10 perf_bio_latency

**Purpose**: Block I/O latency histogram using eBPF

**Parameters**:
```typescript
{
  duration_seconds: number;     // 1-30, default 5
  device?: string;              // Filter by device name
  per_device?: boolean;         // Show per-device histogram
  queued?: boolean;             // Include OS queued time
  milliseconds?: boolean;       // Show in milliseconds
  histogram_type?: 'log2' | 'linear';  // Default: log2
  linear_bucket_ms?: number;    // 1-100, default 10 (for linear mode)
}
```

**Permissions**: CAP_BPF + CAP_PERFMON (BCC biolatency or bpftrace)

**Timeout**: duration_seconds + 15s

**Implementation**:
- log2 mode: `biolatency -m <duration>` (BCC)
- linear mode: bpftrace with `lhist(lat, 0, max, bucket)` for fixed-width buckets

### 9.11 perf_tcp_trace

**Purpose**: TCP connection lifecycle tracing

**Parameters**:
```typescript
{
  duration_seconds: number;     // 1-60, default 10
  pid?: number;
  local_port?: number;
  remote_port?: number;
  mode?: 'lifecycle' | 'connections';  // Default: lifecycle
}
```

**Permissions**: CAP_BPF (BCC tcplife/tcpconnect)

**Implementation**:
- lifecycle: `tcplife` for full connection tracking
- connections: `tcpconnect` for new connections only

### 9.12 perf_syscall_count

**Purpose**: Count syscalls with optional latency distribution

**Parameters**:
```typescript
{
  duration_seconds: number;     // 1-60, default 10
  pid?: number;
  comm?: string;                // Filter by command name
  top_n?: number;               // 1-50, default 20
  include_latency?: boolean;    // Include per-syscall latency
  per_process?: boolean;        // Group by process
  include_errors?: boolean;     // Count only failed syscalls
}
```

**Permissions**: CAP_BPF (BCC syscount)

**Implementation**: `syscount -L -d <duration>` with optional filters

### 9.13 perf_exec_trace

**Purpose**: Trace process executions

**Parameters**:
```typescript
{
  duration_seconds: number;     // 1-30, default 10
  pid?: number;                 // Filter by parent PID
  name_pattern?: string;        // Filter by command name
  uid?: number;
  include_failed?: boolean;     // Only show failed execs
  max_args?: number;            // Max args to capture (default 20)
  include_timestamps?: boolean;
}
```

**Permissions**: CAP_BPF (BCC execsnoop)

**Implementation**: `execsnoop -T` with filters

### 9.14 perf_file_trace

**Purpose**: Trace file operations (slow I/O, short-lived files, opens)

**Parameters**:
```typescript
{
  duration_seconds: number;     // 1-30, default 10
  pid?: number;
  min_latency_ms?: number;      // For slow_ops mode
  mode?: 'slow_ops' | 'file_lifecycle' | 'opens' | 'all';
  include_all_files?: boolean;  // Include special files
}
```

**Permissions**: CAP_BPF (BCC fileslower, filelife, opensnoop)

**Implementation**: Different BCC tool per mode

### 9.15 perf_dns_latency

**Purpose**: Trace DNS lookup latency

**Parameters**:
```typescript
{
  duration_seconds: number;     // 1-30, default 10
  pid?: number;
}
```

**Permissions**: CAP_BPF (BCC gethostlatency)

**Implementation**: `gethostlatency` traces getaddrinfo/gethostbyname

### 9.16 perf_thread_profile

**Purpose**: Per-thread CPU analysis

**Parameters**:
```typescript
{
  pid: number;                  // Required: process to analyze
  duration_seconds: number;     // 1-30, default 5
  include_offcpu?: boolean;     // Include off-CPU time (requires BCC)
}
```

**Permissions**: None for basic; CAP_BPF for off-CPU

**Implementation**:
- Basic: `pidstat -t -p <pid>` for per-thread stats
- With off-CPU: BCC offcputime filtered by PID

### 9.17 perf_io_layers

**Purpose**: Compare VFS operations to block I/O for cache analysis

**Parameters**:
```typescript
{
  duration_seconds: number;     // 1-30, default 10
  include_details?: boolean;    // Per-operation breakdown
}
```

**Permissions**: CAP_BPF for BCC vfsstat; None for procfs fallback

**Implementation**:
- BCC: `vfsstat` for VFS ops, compare with `/proc/diskstats`
- Fallback: Sample `/proc/diskstats` before/after, estimate from ratios

**Output**:
- VFS read/write ops
- Block read/write ops
- Read hit rate (cache effectiveness)
- Write coalesce rate

### 9.18 perf_fd_trace

**Purpose**: File descriptor leak detection

**Parameters**:
```typescript
{
  pid: number;                  // Required: process to analyze
  duration_seconds?: number;    // 1-60, default 30 (for monitoring)
  interval_sec?: number;        // 1-10, default 5 (sampling interval)
  include_fd_list?: boolean;    // List open FDs
  max_fds_listed?: number;      // 10-1000, default 100
}
```

**Permissions**: None (procfs only)

**Implementation**:
- Read `/proc/<pid>/fd/` directory
- Read `/proc/<pid>/limits` for FD limits
- Sample over time to detect growth
- Classify FD types (socket, pipe, file, etc.)

### 9.19 perf_vfs_latency

**Purpose**: VFS layer latency distribution

**Parameters**:
```typescript
{
  duration_seconds: number;     // 1-30, default 5
  min_latency_ms: number;       // 0-10000, default 10
  pid?: number;
  include_all_files?: boolean;  // Include sockets, FIFOs
}
```

**Permissions**: CAP_BPF (BCC fileslower or bpftrace)

**Implementation**:
- Primary: `fileslower <min_ms>` (BCC) - gives filenames
- Fallback: bpftrace script tracing read/write syscalls

**Output**:
- Slow operations with latency, filename, process
- Percentile statistics (p50, p95, p99)
- Aggregation by file and by process

---

## 10. Error Handling

### 10.1 Error Codes

```typescript
enum ErrorCode {
  // Input validation
  INVALID_PARAMS = 'INVALID_PARAMS',
  INVALID_DURATION = 'INVALID_DURATION',
  INVALID_PID = 'INVALID_PID',

  // Capability errors
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  CAPABILITY_MISSING = 'CAPABILITY_MISSING',

  // Execution errors
  TIMEOUT = 'TIMEOUT',
  EXECUTION_FAILED = 'EXECUTION_FAILED',
  PARSE_ERROR = 'PARSE_ERROR',

  // Resource errors
  OUTPUT_TRUNCATED = 'OUTPUT_TRUNCATED',
  PROFILER_BUSY = 'PROFILER_BUSY',

  // System errors
  CGROUP_NOT_FOUND = 'CGROUP_NOT_FOUND',
  DEVICE_NOT_FOUND = 'DEVICE_NOT_FOUND',
  PID_NOT_FOUND = 'PID_NOT_FOUND',
}
```

### 10.2 Error Response Format

```typescript
{
  success: false,
  error: {
    code: 'PERMISSION_DENIED',
    message: 'Cannot access perf events',
    recoverable: true,
    suggestion: 'Run with CAP_PERFMON or as root, or set perf_event_paranoid=-1'
  }
}
```

---

## 11. Transport Support

### 11.1 Primary: stdio

Default transport for MCP client integration:

```bash
# Run server
npx perf-mcp

# Or via installed binary
perf-mcp
```

### 11.2 Optional: HTTP (Streamable)

Behind `--http` flag:

```bash
perf-mcp --http --port 8080 --token <auth-token>
```

HTTP mode adds:
- Bearer token authentication
- CORS headers for browser clients
- Health endpoint at `/health`
- Streaming SSE for long-running tools

---

## 12. Testing Strategy

### 12.1 Unit Tests

- Parser tests with sample command outputs
- Schema validation tests
- Allowlist enforcement tests

### 12.2 Integration Tests

- Smoke tests that skip if tools unavailable
- Capability detection tests
- End-to-end tool execution tests

### 12.3 Test Fixtures

Sample outputs stored in `tests/fixtures/`:
- `vmstat.txt`, `iostat.txt`, `ss.txt`
- `proc_stat.txt`, `proc_meminfo.txt`
- `perf_report.txt`, `perf_sched_latency.txt`

---

## 13. Evaluation Criteria

See `evals/questions.xml` for 10 evaluation questions covering:
1. System information retrieval
2. Metrics snapshot accuracy
3. USE method analysis
4. CPU profiling interpretation
5. Memory pressure detection
6. I/O bottleneck identification
7. Network health assessment
8. Container resource limits
9. Capability fallback behavior
10. Error handling quality

---

## Appendix A: Command Reference

### Procfs/Sysfs Paths

| Path | Content |
|------|---------|
| `/proc/stat` | CPU times, context switches, interrupts |
| `/proc/meminfo` | Memory statistics |
| `/proc/loadavg` | Load averages, run queue |
| `/proc/diskstats` | Block device statistics |
| `/proc/net/dev` | Network interface counters |
| `/proc/net/snmp` | IP/TCP/UDP statistics |
| `/proc/pressure/*` | PSI metrics |
| `/proc/<pid>/cgroup` | Process cgroup membership |
| `/sys/fs/cgroup/...` | Cgroup v2 controllers |

### Tool Commands

| Tool | Primary Command |
|------|-----------------|
| perf_info | Multiple procfs reads |
| perf_snapshot | procfs + `iostat -xz 1 1` |
| perf_use_check | Same as snapshot + analysis |
| perf_cpu_profile | `perf record -F 99 -ag` |
| perf_offcpu_profile | `perf sched record/timehist` |
| perf_io_latency | `iostat -xz` or `perf record -e block:*` |
| perf_net_health | `ss -s` + `nstat -az` |
| perf_cgroup_summary | sysfs cgroup reads |
| perf_sched_latency | `perf sched latency` |

---

## Appendix B: Thresholds

### USE Method Thresholds

| Resource | Metric | Warning | Critical |
|----------|--------|---------|----------|
| CPU | Utilization | > 70% | > 90% |
| CPU | Run queue | > cores | > 2x cores |
| Memory | Available | < 20% | < 10% |
| Memory | Swap used | > 0 | > 50% |
| Disk | Utilization | > 60% | > 80% |
| Disk | Avg queue | > 2 | > 8 |
| Network | Drops/s | > 0 | > 100 |
| Network | Retransmit % | > 1% | > 5% |

### PSI Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| some avg10 | > 10% | > 25% |
| full avg10 | > 5% | > 15% |

---

*Version: 1.0.0*
*Last Updated: 2025-01-12*
