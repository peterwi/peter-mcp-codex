# perf-mcp

A production-quality Model Context Protocol (MCP) server for Linux performance troubleshooting.

## Overview

`perf-mcp` enables AI agents to diagnose performance bottlenecks using:
- **USE Method** - Utilization, Saturation, Errors analysis for each resource
- **Standard Linux tooling** - procfs, perf, sysstat, ss, and more
- **Safe execution** - No shell escapes, strict schemas, allowlisted commands
- **Structured outputs** - JSON responses suitable for LLM orchestration

## Quick Start

### Installation

```bash
# Install globally
npm install -g perf-mcp

# Or run with npx
npx perf-mcp
```

### Claude Desktop Integration

Add to your Claude Desktop configuration (`~/.config/claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "perf-mcp": {
      "command": "npx",
      "args": ["perf-mcp"]
    }
  }
}
```

### MCP Inspector Testing

```bash
npx @modelcontextprotocol/inspector npx perf-mcp
```

## Available Tools

### Basic Tools (No special permissions)

| Tool | Description |
|------|-------------|
| `perf_info` | System info, capabilities, and feature detection |
| `perf_snapshot` | Point-in-time metrics (CPU, memory, I/O, network, PSI) |
| `perf_use_check` | USE method analysis with bottleneck detection |
| `perf_io_latency` | Block I/O latency and device utilization |
| `perf_net_health` | Network stack health (drops, errors, retransmits) |
| `perf_cgroup_summary` | Cgroup v2 resource usage for containers |
| `perf_fd_trace` | File descriptor usage monitoring and leak detection |

### Profiling Tools (Require CAP_PERFMON or root)

| Tool | Description |
|------|-------------|
| `perf_cpu_profile` | On-CPU profiling with top functions |
| `perf_thread_profile` | Per-thread CPU analysis with state and context switches |

### eBPF Tools (Require BCC/bpftrace + root)

| Tool | Description |
|------|-------------|
| `perf_offcpu_profile` | Off-CPU analysis - what processes are waiting on |
| `perf_bio_latency` | Block I/O latency histogram |
| `perf_runq_latency` | CPU run queue latency histogram |
| `perf_tcp_trace` | TCP connection lifecycle tracing |
| `perf_syscall_count` | Syscall counting with latency distribution |
| `perf_exec_trace` | Process creation (fork/clone) and exec tracing with tree view |
| `perf_file_trace` | File operation tracing (slow I/O, short-lived files) |
| `perf_dns_latency` | DNS lookup latency tracing |
| `perf_io_layers` | VFS to block I/O comparison for cache effectiveness |
| `perf_vfs_latency` | VFS layer latency distribution for slow file operations |

### High-Level Workflow Tools

| Tool | Description |
|------|-------------|
| `perf_triage` | Automated incident triage - runs multiple tools, correlates findings, identifies root causes |

The `perf_triage` tool supports three modes:
- **quick** (5s) - Fast overview using perf_snapshot and perf_use_check
- **standard** (10s) - Includes syscall and thread analysis
- **deep** (30s) - Full analysis including I/O layers and file tracing

## Example Prompts

### Automated Triage

```
Run perf_triage in standard mode to diagnose the system.
Identify the top root causes and recommended actions.
```

### Quick Manual Triage

```
Run a quick performance triage. Start with system info, take a metrics snapshot,
then analyze using the USE method. Report the top 3 suspected bottlenecks.
```

### CPU Investigation

```
CPU utilization is at 90%. Profile the CPU for 10 seconds
and identify the top consuming functions.
```

### Memory Pressure

```
Check for memory pressure. Look at available memory, swap usage,
and PSI metrics. Is the system reclaiming aggressively?
```

### Container Troubleshooting

```
A containerized service is slower than expected.
Check cgroup limits, CPU throttling, and memory pressure.
```

## Requirements

### Minimum Requirements
- **Linux** - Kernel 4.18+ (5.x/6.x recommended)
- **Node.js** - 20+

### For Basic Tools
No special permissions required - uses procfs and standard utilities.

### For Profiling Tools
- `perf` (linux-tools-generic) - CPU profiling
- `sysstat` (iostat, sar, mpstat) - Extended metrics
- Root or `CAP_PERFMON` - For perf events access

### For eBPF Tools
- **BCC tools** (bcc-tools or bpfcc-tools package)
- **bpftrace** (optional - used as fallback)
- **Root access** - Required for BPF operations
- **BTF** (recommended) - `/sys/kernel/btf/vmlinux` for faster BPF compilation

Install on Ubuntu/Debian:
```bash
apt install bcc-tools bpftrace linux-tools-generic
```

Install on RHEL/Fedora:
```bash
dnf install bcc-tools bpftrace perf
```

## BCC Reliability Features

eBPF tools include several reliability improvements:

### Preflight Checks
Before running BCC tools, the system is checked for:
- Kernel headers availability
- BTF (BPF Type Format) support
- debugfs mount status
- Required kernel tracepoints

### Compile Caching
BCC tool compile state is cached to avoid recompilation on each invocation.
First run may take 10-30 seconds; subsequent runs use cached state.

### Dynamic Timeouts
Timeouts automatically adjust based on:
- First run vs cached state
- BTF availability (faster with BTF)
- CPU count (slower on single-core)
- Container environment overhead

### Fallback Mode
If BCC tools fail, compatible bpftrace scripts are used as fallbacks:
- `syscount` → bpftrace syscall tracing
- `gethostlatency` → bpftrace DNS tracing
- `biolatency` → bpftrace block I/O histogram
- `execsnoop` → bpftrace process tracing
- And more...

## Common Failure Modes

| Error | Cause | Solution |
|-------|-------|----------|
| `BPF not permitted` | Missing capabilities | Run as root or with CAP_BPF |
| `Failed to compile BPF` | Missing kernel headers | Install linux-headers-$(uname -r) |
| `No BTF found` | BTF not enabled | Install BTF-enabled kernel or expect slower compile |
| `Timeout during compile` | Slow system | Use longer timeout or ensure BTF is available |
| `Permission denied on procfs` | Restricted environment | May need container escape or host access |

## Safety Model

`perf-mcp` is designed with security as a primary concern:

1. **No shell execution** - Commands use argv arrays, never shell interpolation
2. **Allowlisted executables** - Only specific tools with validated arguments
3. **Path validation** - Only reads from allowed procfs/sysfs paths
4. **Timeouts** - All operations have enforced time limits
5. **Output limits** - Truncation prevents memory exhaustion

## Architecture

```
src/
├── index.ts             # Entry point
├── server.ts            # MCP server setup
├── lib/
│   ├── constants.ts     # Allowlists, thresholds, limits
│   ├── exec.ts          # Safe command execution
│   ├── detect.ts        # Capability detection
│   ├── schemas.ts       # Zod input/output schemas
│   ├── bcc-runtime.ts   # BCC preflight, caching, timeouts
│   ├── bpftrace-fallbacks.ts  # Embedded bpftrace scripts
│   └── output-schema.ts # Standardized finding/evidence format
├── tools/               # Tool implementations
│   ├── info.ts
│   ├── snapshot.ts
│   ├── use-check.ts
│   ├── triage.ts        # High-level incident triage
│   └── ...
└── parse/               # Output parsers
    ├── procfs.ts
    ├── iostat.ts
    ├── bcc.ts           # BCC tool output parsers
    └── ...
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development
npm run dev

# Run tests
npm test

# Type check
npm run typecheck

# Lint
npm run lint
```

## Response Format

All tools return structured JSON:

```json
{
  "success": true,
  "tool": "perf_snapshot",
  "tool_version": "1.0.0",
  "timestamp": "2025-01-12T10:30:00.000Z",
  "duration_ms": 1234,
  "host": "myserver",
  "data": { ... },
  "warnings": ["PSI not available on this system"]
}
```

Error responses include actionable suggestions:

```json
{
  "success": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "Cannot access perf events",
    "recoverable": true,
    "suggestion": "Run as root or grant CAP_PERFMON"
  }
}
```

## Methodologies

### USE Method

For each system resource (CPU, memory, disk, network):
- **Utilization** - How busy is the resource?
- **Saturation** - Is work queued waiting?
- **Errors** - Are there fault conditions?

### Thresholds

| Resource | Metric | Warning | Critical |
|----------|--------|---------|----------|
| CPU | Utilization | > 70% | > 90% |
| Memory | Available | < 20% | < 10% |
| Disk | Utilization | > 60% | > 80% |
| Network | Retransmits | > 1% | > 5% |

## Licence

MIT
