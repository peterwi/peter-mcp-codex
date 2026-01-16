# perf-mcp Tool Reference

Complete reference documentation for all perf-mcp tools.

## perf_info

Get system information, capabilities, and available features for performance analysis.

### Parameters

None required.

### Response

```json
{
  "system": {
    "hostname": "myserver",
    "kernel": "6.5.0-generic",
    "arch": "x64",
    "uptime_seconds": 123456,
    "boot_time": "2025-01-01T00:00:00.000Z"
  },
  "cpu": {
    "model": "Intel(R) Core(TM) i7-9700K CPU @ 3.60GHz",
    "cores": 8,
    "threads": 8,
    "numa_nodes": 1,
    "scaling_governor": "performance"
  },
  "virtualization": {
    "type": "kvm",
    "container": false,
    "cgroup_version": 2
  },
  "capabilities": {
    "perf_available": true,
    "perf_permitted": true,
    "bpf_available": false,
    "btf_available": true,
    "psi_enabled": true
  },
  "memory": {
    "total_bytes": 17179869184,
    "huge_pages_enabled": false,
    "thp_enabled": true
  }
}
```

### Warnings

- `perf tool not installed` - Install linux-tools-generic
- `perf access restricted` - Run as root or adjust perf_event_paranoid
- `PSI not enabled` - Kernel doesn't have PSI support
- `BTF not available` - Some eBPF features limited

---

## perf_snapshot

Capture a point-in-time snapshot of CPU, memory, I/O, and network metrics.

### Parameters

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `include_per_cpu` | boolean | false | Include per-CPU breakdown |
| `include_per_device` | boolean | true | Include per-device I/O stats |
| `include_psi` | boolean | true | Include PSI metrics (if available) |

### Response

```json
{
  "cpu": {
    "load_avg": [1.23, 1.45, 1.67],
    "run_queue": 3,
    "utilization": {
      "user": 25.5,
      "system": 12.3,
      "nice": 0.0,
      "idle": 58.2,
      "iowait": 3.5,
      "irq": 0.2,
      "softirq": 0.3,
      "steal": 0.0
    },
    "context_switches": 123456,
    "interrupts": 789012
  },
  "memory": {
    "total_bytes": 17179869184,
    "available_bytes": 8589934592,
    "used_bytes": 8589934592,
    "buffers_bytes": 536870912,
    "cached_bytes": 4294967296,
    "swap_used_bytes": 0,
    "swap_total_bytes": 8589934592,
    "page_faults": 12345,
    "major_faults": 12
  },
  "io": {
    "devices": [
      {
        "name": "sda",
        "reads_per_sec": 10.5,
        "writes_per_sec": 25.3,
        "read_bytes_per_sec": 524288,
        "write_bytes_per_sec": 1048576,
        "avg_queue_size": 1.2,
        "utilization": 45.5,
        "avg_wait_ms": 2.3
      }
    ]
  },
  "network": {
    "interfaces": [
      {
        "name": "eth0",
        "rx_bytes": 1234567890,
        "tx_bytes": 987654321,
        "rx_packets": 12345678,
        "tx_packets": 9876543,
        "rx_errors": 0,
        "tx_errors": 0,
        "rx_dropped": 0,
        "tx_dropped": 0
      }
    ],
    "tcp": {
      "active_connections": 1234,
      "passive_connections": 5678,
      "retransmits": 12,
      "in_segs": 123456,
      "out_segs": 234567
    }
  },
  "pressure": {
    "cpu": {
      "some_avg10": 1.23,
      "some_avg60": 1.45,
      "some_avg300": 1.67,
      "full_avg10": 0.12,
      "full_avg60": 0.23,
      "full_avg300": 0.34,
      "some_total": 123456,
      "full_total": 12345
    },
    "memory": { ... },
    "io": { ... }
  }
}
```

---

## perf_use_check

Analyze system using USE method (Utilization, Saturation, Errors) and identify bottlenecks.

### Parameters

None required.

### Response

```json
{
  "summary": {
    "status": "warning",
    "top_suspicions": [
      "CPU utilization elevated: 78.5% busy (user=65.2%, sys=13.3%)",
      "Disk saturation detected: sda: queue=3.2"
    ]
  },
  "resources": {
    "cpu": {
      "utilization": {
        "value": 78.5,
        "status": "warning",
        "detail": "78.5% busy (user=65.2%, sys=13.3%, iowait=0.0%)"
      },
      "saturation": {
        "value": 12,
        "status": "ok",
        "detail": "Run queue: 3, Load: 1.23"
      },
      "errors": {
        "count": 0,
        "status": "ok",
        "detail": "No CPU errors detected"
      }
    },
    "memory": { ... },
    "disk": { ... },
    "network": { ... }
  }
}
```

### Status Thresholds

| Resource | Metric | Warning | Critical |
|----------|--------|---------|----------|
| CPU | Utilization | > 70% | > 90% |
| CPU | Run Queue | > CPU count | > 2x CPU count |
| Memory | Available | < 20% | < 10% |
| Memory | Swap | > 10% | > 50% |
| Disk | Utilization | > 60% | > 80% |
| Disk | Queue Depth | > 2 | > 8 |
| Network | Drops | > 1/s | > 100/s |
| Network | Retransmits | > 1% | > 5% |

---

## perf_cpu_profile

Profile on-CPU activity to identify which functions consume CPU time.

### Parameters

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `duration_seconds` | number | 5 | Duration in seconds (1-60) |
| `sample_rate_hz` | number | 99 | Sample rate in Hz (1-999) |
| `pid` | number | - | Profile specific process |
| `include_kernel` | boolean | true | Include kernel functions |
| `output_format` | string | summary | Output format (summary/collapsed) |

### Requirements

- `perf` tool installed (linux-tools-generic)
- `CAP_PERFMON` capability or root, OR `perf_event_paranoid <= 1`

### Response

```json
{
  "total_samples": 4950,
  "duration_seconds": 5,
  "sample_rate": 99,
  "top_functions": [
    {
      "symbol": "processRequest",
      "module": "myapp",
      "percent": 28.5,
      "samples": 1411
    },
    {
      "symbol": "copy_user_enhanced_fast_string",
      "module": "[kernel.kallsyms]",
      "percent": 12.3,
      "samples": 609
    }
  ],
  "kernel_percent": 18.5,
  "user_percent": 81.5,
  "notes": [
    "Memory allocation functions detected - consider object pooling"
  ]
}
```

---

## perf_io_latency

Measure block I/O latency and identify slow storage devices.

### Parameters

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `duration_seconds` | number | 5 | Duration in seconds (1-30) |
| `device` | string | - | Filter by device name (e.g., sda) |
| `mode` | string | snapshot | snapshot for iostat, trace for perf |

### Response

```json
{
  "mode": "snapshot",
  "duration_seconds": 5,
  "devices": [
    {
      "name": "sda",
      "reads_per_sec": 125.5,
      "writes_per_sec": 256.3,
      "read_bytes_per_sec": 5242880,
      "write_bytes_per_sec": 10485760,
      "avg_queue_size": 1.8,
      "utilization": 67.5,
      "avg_wait_ms": 8.5
    }
  ],
  "notes": [
    "sda: High utilization (67.5%)"
  ]
}
```

---

## perf_net_health

Check network stack health including drops, errors, and retransmits.

### Parameters

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `interface` | string | - | Filter by interface name |
| `include_tcp_details` | boolean | true | Include detailed TCP statistics |

### Response

```json
{
  "interfaces": [
    {
      "name": "eth0",
      "rx_bytes": 1234567890,
      "tx_bytes": 987654321,
      "rx_packets": 12345678,
      "tx_packets": 9876543,
      "rx_errors": 0,
      "tx_errors": 0,
      "rx_dropped": 5,
      "tx_dropped": 0
    }
  ],
  "tcp": {
    "active_connections": 1234,
    "passive_connections": 5678,
    "retransmits": 45,
    "in_segs": 123456,
    "out_segs": 234567,
    "retransmit_rate": 0.019,
    "reset_rate": 12
  },
  "socket_summary": {
    "tcp_total": 1500,
    "tcp_established": 1200,
    "tcp_time_wait": 150,
    "udp_total": 50
  },
  "issues": [
    "Packet drops detected: eth0: rx=5, tx=0"
  ]
}
```

---

## perf_cgroup_summary

Get resource usage summary for a cgroup (container/service).

### Parameters

| Name | Type | Description |
|------|------|-------------|
| `pid` | number | Find cgroup for this PID |
| `cgroup_path` | string | Cgroup path directly |

One of `pid` or `cgroup_path` should be provided. If neither, uses root cgroup.

### Response

```json
{
  "cgroup_path": "/sys/fs/cgroup/system.slice/myservice.service",
  "cpu": {
    "usage_usec": 1234567890,
    "user_usec": 1000000000,
    "system_usec": 234567890,
    "nr_throttled": 45,
    "throttled_usec": 901234,
    "limit_cores": 2,
    "pressure": {
      "some_avg10": 5.5,
      "full_avg10": 1.2
    }
  },
  "memory": {
    "current_bytes": 1073741824,
    "max_bytes": 2147483648,
    "usage_percent": 50.0,
    "anon_bytes": 536870912,
    "file_bytes": 536870912,
    "oom_kills": 0,
    "pressure": {
      "some_avg10": 2.3,
      "full_avg10": 0.5
    }
  },
  "io": {
    "devices": [
      {
        "device": "8:0",
        "rbytes": 123456789,
        "wbytes": 234567890,
        "rios": 12345,
        "wios": 23456
      }
    ]
  },
  "pids": {
    "current": 25,
    "max": 100
  },
  "issues": [
    "CPU throttled 45 times"
  ]
}
```

---

## perf_syscall_count

Count syscalls per process with latency distribution using eBPF (requires BCC).

### Parameters

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `duration_seconds` | number | 10 | Duration in seconds (1-60) |
| `pid` | number | - | Filter by process ID |
| `top_n` | number | 20 | Number of top syscalls to return (1-50) |
| `include_latency` | boolean | true | Include syscall latency distribution |
| `per_process` | boolean | false | Show syscall counts per process |
| `include_errors` | boolean | false | Count only failed syscalls |

### Requirements

- BCC tools installed (bcc-tools package)
- Root privileges or CAP_BPF capability

### Response

```json
{
  "method": "bcc_syscount",
  "duration_seconds": 10,
  "target": "system-wide",
  "syscalls": [
    {
      "name": "read",
      "count": 12345,
      "rate_per_sec": 1234.5,
      "latency": {
        "total_us": 5678901,
        "avg_us": 460.1
      }
    }
  ],
  "summary": {
    "total_syscalls": 50000,
    "total_latency_us": 25000000,
    "unique_syscalls": 45,
    "top_by_count": ["read", "write", "futex"],
    "top_by_latency": ["futex", "nanosleep", "poll"]
  },
  "notes": ["High syscall rate: 5.0K/sec - check for busy polling"]
}
```

---

## perf_exec_trace

Trace process exec events using eBPF (requires BCC).

### Parameters

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `duration_seconds` | number | 5 | Duration in seconds (1-30) |
| `pid` | number | - | Filter by parent process ID |
| `name_pattern` | string | - | Filter by command name (substring match) |
| `uid` | number | - | Filter by user ID |
| `include_failed` | boolean | false | Only show failed exec calls |
| `max_args` | number | 10 | Maximum number of arguments to capture |
| `include_timestamps` | boolean | true | Include timestamps in output |

### Requirements

- BCC tools installed (bcc-tools package)
- Root privileges or CAP_BPF capability

### Response

```json
{
  "method": "bcc_execsnoop",
  "duration_seconds": 5,
  "events": [
    {
      "timestamp": "12:34:56",
      "parent_comm": "bash",
      "pid": 12345,
      "ppid": 12344,
      "return_code": 0,
      "command": "/usr/bin/ls",
      "args": "/usr/bin/ls -la"
    }
  ],
  "summary": {
    "total_execs": 150,
    "unique_commands": 25,
    "exec_rate_per_sec": 30.0,
    "failed_execs": 2,
    "by_command": {"ls": 50, "grep": 30, "awk": 20},
    "by_parent": {"bash": 100, "cron": 50}
  },
  "truncated": false,
  "notes": ["High exec rate: 30.0/sec"]
}
```

---

## perf_file_trace

Trace file operations using eBPF (requires BCC).

### Parameters

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `duration_seconds` | number | 5 | Duration in seconds (1-30) |
| `pid` | number | - | Filter by process ID |
| `min_latency_ms` | number | 10 | Minimum latency threshold for slow ops |
| `mode` | string | slow_ops | slow_ops, file_lifecycle, opens, or all |
| `include_all_files` | boolean | false | Include all file types |

### Requirements

- BCC tools installed (bcc-tools package)
- Root privileges or CAP_BPF capability

### Response

```json
{
  "method": "fileslower+filelife+opensnoop",
  "duration_seconds": 5,
  "slow_ops": {
    "operations": [
      {
        "timestamp": 0.123,
        "pid": 12345,
        "comm": "python",
        "direction": "R",
        "bytes": 4096,
        "latency_ms": 15.67,
        "filename": "data.txt"
      }
    ],
    "summary": {
      "total_ops": 50,
      "avg_latency_ms": 18.5,
      "p95_latency_ms": 45.2,
      "max_latency_ms": 120.5,
      "read_ops": 30,
      "write_ops": 20
    }
  },
  "file_lifecycle": {
    "files": [
      {
        "timestamp": "12:34:56",
        "pid": 12345,
        "comm": "rm",
        "age_seconds": 0.5,
        "filename": "tempfile.txt"
      }
    ],
    "summary": {
      "total_files": 25,
      "avg_age_seconds": 1.5,
      "short_lived_count": 15
    }
  },
  "truncated": false,
  "notes": ["High file latency detected: max 120.5ms"]
}
```

---

## perf_dns_latency

Trace DNS lookup latency using eBPF (requires BCC).

### Parameters

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `duration_seconds` | number | 5 | Duration in seconds (1-30) |
| `pid` | number | - | Filter by process ID |

### Requirements

- BCC tools installed (bcc-tools package)
- Root privileges or CAP_BPF capability

### Response

```json
{
  "method": "bcc_gethostlatency",
  "duration_seconds": 5,
  "queries": [
    {
      "timestamp": "12:34:56",
      "pid": 12345,
      "comm": "curl",
      "latency_ms": 45.2,
      "host": "api.example.com"
    }
  ],
  "summary": {
    "total_queries": 100,
    "avg_latency_ms": 35.5,
    "p50_ms": 25.0,
    "p95_ms": 85.0,
    "p99_ms": 120.0,
    "max_latency_ms": 250.0,
    "by_host": {
      "api.example.com": {"count": 50, "avg_latency_ms": 40.0}
    },
    "by_process": {
      "curl": {"count": 80, "avg_latency_ms": 35.0}
    }
  },
  "truncated": false,
  "notes": ["High DNS latency detected: max 250.0ms"]
}
```

---

## perf_thread_profile

Per-thread CPU analysis for a specific process.

### Parameters

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `pid` | number | *required* | Process ID to analyze |
| `duration_seconds` | number | 5 | Duration in seconds (1-30) |
| `include_offcpu` | boolean | false | Include off-CPU time analysis (requires BCC) |

### Requirements

- pidstat (sysstat package)
- BCC tools for off-CPU analysis (optional)

### Response

```json
{
  "method": "pidstat+offcputime",
  "pid": 12345,
  "process_name": "myapp",
  "duration_seconds": 5,
  "threads": [
    {
      "tid": 12346,
      "name": "worker-1",
      "state": "R",
      "cpu_user_percent": 45.5,
      "cpu_system_percent": 12.3,
      "cpu_total_percent": 57.8,
      "voluntary_ctx_switches": 1234,
      "involuntary_ctx_switches": 56
    }
  ],
  "process_total": {
    "cpu_user_percent": 120.5,
    "cpu_system_percent": 35.2,
    "cpu_total_percent": 155.7,
    "total_threads": 8,
    "running_threads": 3,
    "blocked_threads": 1
  },
  "offcpu_summary": {
    "total_offcpu_us": 5000000,
    "top_blockers": [
      {"function": "futex_wait", "total_us": 2500000, "percent": 50.0}
    ]
  },
  "notes": ["Hot thread(s): worker-1(12346): 57.8%"]
}
```

---

## Error Codes

| Code | Description | Suggestion |
|------|-------------|------------|
| `INVALID_PARAMS` | Invalid input parameters | Check parameter types and constraints |
| `INVALID_DURATION` | Duration out of range | Use value between 1-60 seconds |
| `INVALID_PID` | Invalid process ID | Provide positive integer |
| `TOOL_NOT_FOUND` | Required tool not installed | Install package (e.g., linux-tools-generic) |
| `PERMISSION_DENIED` | Insufficient permissions | Run as root or grant capabilities |
| `TIMEOUT` | Operation timed out | Try shorter duration |
| `PARSE_ERROR` | Failed to parse output | Output format may have changed |
| `PID_NOT_FOUND` | Process not found | Process may have exited |
| `CGROUP_NOT_FOUND` | Cgroup path not found | Verify container/cgroup exists |
| `DEVICE_NOT_FOUND` | Device not found | Check device name with lsblk |
