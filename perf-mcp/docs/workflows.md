# perf-mcp Workflows Guide

This guide provides step-by-step workflows for common performance troubleshooting scenarios using perf-mcp.

## Quick Reference

| Scenario | Primary Tools | Duration |
|----------|--------------|----------|
| Quick Triage | `perf_info` + `perf_snapshot` + `perf_use_check` | 60-120s |
| CPU Bound | `perf_cpu_profile` + `perf_sched_latency` | 30-60s |
| Latency Bound | `perf_offcpu_profile` + `perf_io_latency` | 30-60s |
| Memory Pressure | `perf_snapshot` (PSI) + `perf_cgroup_summary` | 30s |
| I/O Bottleneck | `perf_io_latency` + `perf_bio_latency` | 30-60s |
| Network Issues | `perf_net_health` + `perf_tcp_trace` | 30s |
| Container Issues | `perf_cgroup_summary` + `perf_snapshot` | 30s |
| Deep I/O Analysis | `perf_io_layers` + `perf_bio_latency` + `perf_vfs_latency` | 30-60s |
| FD Leak Detection | `perf_fd_trace` | 30-60s |
| Time-Series Analysis | `perf_snapshot` (interval mode) | 60-300s |
| Syscall Analysis | `perf_syscall_count` | 10-30s |
| Process Execution | `perf_exec_trace` | 10-30s |
| DNS Issues | `perf_dns_latency` | 10-30s |
| Thread Analysis | `perf_thread_profile` | 10-30s |

---

## Workflow 1: Quick Performance Triage

**When to use**: First response to "the system is slow" reports.

**Objective**: Identify the resource bottleneck category within 2 minutes.

### Steps

```
Step 1: Gather system context
─────────────────────────────
Tool: perf_info

Questions answered:
- What kernel/OS version?
- Is this a VM/container?
- What capabilities are available for deeper analysis?
- How many CPUs/NUMA nodes?

Step 2: Capture baseline metrics
─────────────────────────────
Tool: perf_snapshot

Questions answered:
- Current CPU utilization breakdown
- Memory availability and swap usage
- Per-device I/O metrics
- Network interface stats
- PSI pressure indicators

Step 3: Apply USE method analysis
─────────────────────────────
Tool: perf_use_check

Questions answered:
- Which resources show high utilization?
- Which resources are saturated (queued work)?
- Are there any errors?
- What are the top suspected bottlenecks?
```

### Example Agent Interaction

**User**: "The application server is running slowly."

**Agent Response**:
```
Let me perform a quick performance triage.

1. First, I'll gather system information...
   [perf_info result]

   System: Ubuntu 22.04, kernel 6.5.0, 16 cores, KVM guest
   Capabilities: perf available, PSI enabled, cgroups v2

2. Now capturing a metrics snapshot...
   [perf_snapshot result]

   CPU: 78% user, 12% system, 2% iowait
   Memory: 12GB/32GB used, 18GB available
   Disk sda: 45% utilization, avg queue 1.2
   Network: 0 drops, 0.3% retransmit rate
   PSI CPU some: 15.2%

3. Applying USE method analysis...
   [perf_use_check result]

   SUMMARY: Warning - CPU pressure detected

   Top Suspicions:
   1. CPU utilization approaching saturation (78% user)
   2. CPU PSI showing contention (15.2% some)
   3. Run queue slightly elevated (18 vs 16 cores)

   Recommendation: Profile CPU to identify hot functions.
```

---

## Workflow 2: CPU-Bound Investigation

**When to use**: High CPU utilization identified in triage.

**Objective**: Identify which code paths consume CPU cycles.

### Steps

```
Step 1: Confirm CPU-bound condition
─────────────────────────────
Tool: perf_snapshot

Look for:
- User CPU > 70%
- Low iowait (< 5%)
- Low steal (if VM)
- Run queue elevated

Step 2: Profile on-CPU activity
─────────────────────────────
Tool: perf_cpu_profile
Parameters: duration_seconds=10, sample_rate_hz=99

Output:
- Top functions by CPU time
- Call stack context
- Kernel vs userspace breakdown

Step 3: Check for scheduler issues
─────────────────────────────
Tool: perf_sched_latency
Parameters: duration_seconds=5

Look for:
- High max latency (> 10ms)
- Context switch storms
- Priority inversion hints
```

### Interpreting Results

**Healthy CPU Profile**:
- Samples spread across expected application code
- No single function dominating (< 30%)
- Kernel time < 20%

**Problematic Patterns**:
- Single function > 50% → hot loop, consider optimization
- Kernel syscall overhead high → excessive syscalls
- Lock contention symbols → mutex contention
- Garbage collection → memory pressure causing GC

### Example Agent Interaction

**User**: "After the triage shows CPU issues, what's next?"

**Agent Response**:
```
I'll profile the CPU to identify what's consuming cycles.

[perf_cpu_profile with duration=10s]

Top CPU Consumers:
1. myapp::processRequest    28.5%
2. [kernel] copy_user       12.3%
3. myapp::serialize         11.2%
4. libc::malloc              8.1%
5. myapp::validateInput      6.7%

Analysis:
- processRequest is expected to be high (main work)
- High copy_user suggests large data transfers to/from userspace
- malloc at 8.1% indicates memory allocation pressure
- Combined with GC symbols at 5%, memory churn is significant

Recommendations:
1. Consider object pooling to reduce malloc pressure
2. Review processRequest for optimization opportunities
3. Check if copy_user relates to large network buffers
```

---

## Workflow 3: Latency-Bound Investigation (Off-CPU)

**When to use**: Application is slow but CPU utilization is low.

**Objective**: Identify what the application is waiting for.

### Steps

```
Step 1: Confirm latency-bound condition
─────────────────────────────
Tool: perf_snapshot

Look for:
- CPU utilization low (< 50%)
- Application reported as slow
- High iowait possibly
- High PSI full metrics

Step 2: Profile off-CPU time
─────────────────────────────
Tool: perf_offcpu_profile
Parameters: duration_seconds=10

Output:
- Time spent blocked/sleeping
- What resources are waited on
- Call stacks at block time

Step 3: Identify wait category
─────────────────────────────
Based on off-CPU results:
- I/O wait → perf_io_latency
- Network wait → perf_net_health
- Lock contention → look for futex/mutex
- Sleep calls → intentional waits
```

### Common Off-CPU Patterns

| Stack Pattern | Indicates | Next Step |
|---------------|-----------|-----------|
| `io_schedule` | Disk I/O wait | `perf_io_latency` |
| `tcp_recvmsg` | Network wait | Check network/peer |
| `futex_wait` | Lock contention | Profile lock holders |
| `epoll_wait` | Event loop idle | Normal if low load |
| `nanosleep` | Intentional sleep | Review sleep calls |

### Example Agent Interaction

**User**: "API response times are 2s but CPU is only 20%."

**Agent Response**:
```
Low CPU with high latency suggests the application is waiting for something.
Let me analyze off-CPU time.

[perf_offcpu_profile duration=10s]

Off-CPU Time Breakdown:
1. io_schedule_timeout     45.2%  (I/O wait)
2. tcp_recvmsg_wait        28.1%  (network)
3. futex_wait               8.3%  (locks)
4. epoll_wait              18.4%  (idle)

The application spends most blocked time waiting for:
1. Disk I/O (45%) - investigating further...

[perf_io_latency]

I/O Latency by Device:
- sda: avg 12ms, p99 85ms (SSD expected < 5ms)
- High queue depth detected (avg 4.2)

Root Cause: Disk I/O latency is elevated.
The SSD is showing 12ms average latency (expected < 5ms).

Recommendations:
1. Check disk health (smartctl)
2. Review I/O patterns (random vs sequential)
3. Consider if database needs index optimization
4. Check for noisy neighbors if shared storage
```

---

## Workflow 4: Memory Pressure Investigation

**When to use**: OOM kills, high swap usage, or memory-related slowness.

**Objective**: Identify memory pressure sources and severity.

### Steps

```
Step 1: Assess memory state
─────────────────────────────
Tool: perf_snapshot

Key metrics:
- available vs total
- swap used
- page faults (major/minor)
- PSI memory metrics

Step 2: Check USE method for memory
─────────────────────────────
Tool: perf_use_check

Look for:
- Memory utilization > 80%
- Saturation: swap > 0, high major faults
- Errors: OOM events

Step 3: If containerized, check limits
─────────────────────────────
Tool: perf_cgroup_summary

Look for:
- memory.current vs memory.max
- memory.pressure metrics
- OOM kill count
```

### Memory Pressure Levels

| Level | Indicators | Impact |
|-------|------------|--------|
| None | Available > 30%, no swap | Normal |
| Light | Available 10-30%, minor swap | Acceptable |
| Moderate | Available < 10%, active swap | Noticeable slowdown |
| Severe | Near memory.max, high PSI | Significant degradation |
| Critical | OOM kills, thrashing | Application failures |

### Example Agent Interaction

**User**: "Application killed by OOM, but we have 64GB RAM."

**Agent Response**:
```
Let me investigate the memory pressure situation.

[perf_snapshot]

Memory State:
- Total: 64GB
- Used: 58GB
- Available: 4GB (6%)
- Swap: 2GB used of 8GB
- Major page faults: 1,245/s
- PSI memory some: 35%

This shows severe memory pressure. Let me check container limits.

[perf_cgroup_summary for the application]

Cgroup Memory:
- memory.current: 31.2GB
- memory.max: 32GB (97% used!)
- memory.events:
  - max: 847 (hit limit 847 times)
  - oom_kill: 3

Root Cause: Container memory limit (32GB) is too restrictive.
The application has been OOM-killed 3 times.

Recommendations:
1. Increase container memory limit
2. Or reduce application memory usage:
   - Review heap size configuration
   - Check for memory leaks
   - Consider memory profiling
3. Set memory.high for gradual throttling before hard limit
```

---

## Workflow 5: Block I/O Bottleneck

**When to use**: High iowait, slow database queries, disk-intensive workloads.

**Objective**: Identify I/O bottleneck cause and device.

### Steps

```
Step 1: Identify I/O-bound condition
─────────────────────────────
Tool: perf_snapshot

Look for:
- iowait > 10%
- PSI io some > 10%
- Device utilization > 60%

Step 2: Analyze I/O latency
─────────────────────────────
Tool: perf_io_latency mode=snapshot

Look for:
- High await (> 10ms for SSD, > 20ms for HDD)
- High avgqu-sz (> 2)
- Device utilization saturation

Step 3: Apply USE for disk
─────────────────────────────
Tool: perf_use_check

Disk metrics:
- Utilization: device busy %
- Saturation: queue depth
- Errors: device errors
```

### I/O Performance Reference

| Device Type | Good Latency | Warning | Critical |
|-------------|--------------|---------|----------|
| NVMe SSD | < 1ms | > 5ms | > 20ms |
| SATA SSD | < 5ms | > 15ms | > 50ms |
| HDD | < 10ms | > 30ms | > 100ms |
| Network (NFS/iSCSI) | < 5ms | > 20ms | > 100ms |

### Example Agent Interaction

**User**: "Database queries taking 5x longer than normal."

**Agent Response**:
```
Database slowness often relates to I/O. Let me investigate.

[perf_io_latency]

I/O Statistics:
Device    r/s    w/s   rMB/s   wMB/s  await  %util
sda     1,234  2,456   48.2    96.4   18.2    87%
sdb       125    256    5.0    10.2    2.1    12%

Analysis:
- sda (database disk) is highly utilized (87%)
- Latency elevated at 18.2ms average
- Read/write ratio suggests write-heavy workload
- Queue building up (implied by high util + latency)

[perf_use_check - disk section]

Disk USE Analysis:
- Utilization: CRITICAL (87% - approaching saturation)
- Saturation: WARNING (queue depth 3.2)
- Errors: OK (0)

Root Cause: sda is I/O saturated with high write load.

Recommendations:
1. Short term: Reduce concurrent queries
2. Consider moving to faster storage (NVMe)
3. Review database:
   - Index optimization
   - Query optimization
   - Write batching
4. If virtualized, check for storage oversubscription
```

---

## Workflow 6: Network Performance Issues

**When to use**: Connection failures, timeouts, or slow network operations.

**Objective**: Identify network stack health issues.

### Steps

```
Step 1: Check network health
─────────────────────────────
Tool: perf_net_health

Look for:
- Interface drops/errors
- TCP retransmits
- Socket buffer issues
- Connection states

Step 2: Correlate with system metrics
─────────────────────────────
Tool: perf_snapshot

Look for:
- Network interface counters
- TCP statistics
- PSI (if network causing backpressure)

Step 3: Check for software limits
─────────────────────────────
Tool: perf_info + manual check

Look for:
- File descriptor limits
- Socket buffer sizes
- Connection tracking limits
```

### Network Health Indicators

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| RX drops/s | 0 | > 0 | > 100 |
| TX drops/s | 0 | > 0 | > 100 |
| Retransmits | < 0.1% | 0.1-1% | > 1% |
| Reset segs | Low | Rising | > 1000/s |
| Backlog | 0 | > 0 | Growing |

### Example Agent Interaction

**User**: "Intermittent connection timeouts to our service."

**Agent Response**:
```
Let me check the network stack health.

[perf_net_health]

Network Health Summary:

Interface eth0:
- RX: 125,432 pkt/s, 0 errors, 12 drops/s
- TX: 98,765 pkt/s, 0 errors, 0 drops

TCP Statistics:
- Active connections: 12,456
- Retransmit rate: 2.3%
- Reset segments: 234/s
- SYN backlog: 45 (max 128)

Socket Buffers:
- TCP memory: 450MB / 1GB
- Orphaned sockets: 123

Issues Detected:
1. RX drops (12/s) - interface buffer overruns
2. High retransmit rate (2.3%) - network congestion
3. SYN backlog at 35% capacity - potential for drops

Root Cause: Combination of:
- Receive buffer drops indicating high inbound rate
- Network path congestion causing retransmits

Recommendations:
1. Increase interface ring buffers:
   ethtool -G eth0 rx 4096
2. Tune TCP settings:
   - Increase backlog: net.core.somaxconn
   - Enable TCP timestamps
3. Investigate network path for congestion
4. Consider adding load balancing capacity
```

---

## Workflow 7: Container/Cgroup Troubleshooting

**When to use**: Containerized workload performance issues.

**Objective**: Identify resource limit impacts on container.

### Steps

```
Step 1: Identify cgroup constraints
─────────────────────────────
Tool: perf_info

Confirm:
- Container detected
- Cgroup v2 enabled
- PSI available

Step 2: Analyze cgroup resource usage
─────────────────────────────
Tool: perf_cgroup_summary (with container PID)

Look for:
- CPU throttling events
- Memory near limit
- I/O throttling (if configured)
- PSI metrics within cgroup

Step 3: Compare to host metrics
─────────────────────────────
Tool: perf_snapshot

Determine if:
- Host is under pressure
- Multiple containers competing
- Limits appropriately sized
```

### Container Resource Analysis

| Resource | Healthy | Throttled | Critical |
|----------|---------|-----------|----------|
| CPU | nr_throttled=0 | nr_throttled > 0 | throttled_usec growing |
| Memory | < 80% of max | > 80% of max | oom_kill > 0 |
| I/O | Within limits | Throttling events | Severe throttling |

### Example Agent Interaction

**User**: "Container is randomly slow every few seconds."

**Agent Response**:
```
Periodic slowness in containers often indicates resource throttling.

[perf_info]
Container detected: Yes (Docker)
Cgroup version: 2
PSI enabled: Yes

[perf_cgroup_summary for container]

CPU Cgroup:
- cpu.max: 200000 100000 (2 cores limit)
- cpu.stat:
  - usage_usec: 1,234,567,890
  - user_usec: 1,000,000,000
  - system_usec: 234,567,890
  - nr_throttled: 4,567 ← SIGNIFICANT
  - throttled_usec: 89,234,567 ← ~89 seconds throttled!

Memory Cgroup:
- memory.current: 1.8GB
- memory.max: 2GB (90% used)
- memory.pressure:
  - some avg10: 12.3%
  - full avg10: 3.2%

Root Cause: CPU throttling!
- Container limited to 2 cores (cpu.max 200000/100000)
- Throttled 4,567 times, losing ~89 seconds of CPU time
- This explains periodic 100-200ms stalls

Recommendations:
1. Increase CPU limit if workload requires it:
   docker update --cpus 4 <container>
2. Or optimize application to use less CPU
3. Memory is also at 90% - consider increasing to 3GB
4. Review if burst capacity (cpu.max burst) would help
```

---

## Workflow Summary Matrix

| Symptom | First Tool | Likely Cause | Deep Dive |
|---------|------------|--------------|-----------|
| High CPU | perf_snapshot | Application code | perf_cpu_profile |
| High latency, low CPU | perf_snapshot | Waiting on resource | perf_offcpu_profile |
| High iowait | perf_io_latency | Disk bottleneck | Device-level analysis |
| Memory warnings | perf_snapshot | Memory pressure | perf_cgroup_summary |
| Network errors | perf_net_health | Network issues | Interface/TCP tuning |
| Container slow | perf_cgroup_summary | Resource limits | Adjust limits |
| General slowness | perf_use_check | Multiple factors | Follow top suspicion |

---

## Agent Prompts for Common Scenarios

### General Investigation

```
"Perform a complete performance triage of this system.
Start with system info, take a metrics snapshot,
and apply USE method analysis."
```

### CPU Investigation

```
"CPU utilization is at 90%. Profile the CPU for 10 seconds
and identify the top consuming functions.
Also check for scheduler latency issues."
```

### Latency Investigation

```
"Application response times are high but CPU is only 30%.
Analyze off-CPU time to find what the application is waiting on."
```

### Memory Investigation

```
"We're seeing OOM kills. Check memory pressure,
swap usage, and container memory limits."
```

### I/O Investigation

```
"Database queries are slow. Check block I/O latency
and identify if any disk devices are saturated."
```

### Network Investigation

```
"Users report intermittent connection failures.
Check network health including drops, errors, and retransmits."
```

### Container Investigation

```
"A containerized service is slower than expected.
Check cgroup limits, CPU throttling, and memory pressure."
```

---

## Workflow 8: Deep I/O Analysis with eBPF

**When to use**: Need detailed I/O latency distribution or VFS-to-block layer comparison.

**Objective**: Identify exactly where I/O latency comes from (VFS, cache, block).

### Steps

```
Step 1: Check cache effectiveness
─────────────────────────────
Tool: perf_io_layers
Parameters: duration_seconds=10

Questions answered:
- What percentage of reads hit the cache?
- How effective is write coalescing?
- VFS ops vs actual block I/O ratio

Step 2: Get block I/O latency distribution
─────────────────────────────
Tool: perf_bio_latency
Parameters: duration_seconds=10, histogram_type="log2" or "linear"

Output:
- Latency histogram (log2 or linear buckets)
- Per-device breakdown if needed
- Percentile analysis (p50, p95, p99)

Step 3: Trace slow file operations
─────────────────────────────
Tool: perf_vfs_latency
Parameters: duration_seconds=10, min_latency_ms=10

Output:
- Which files have slow operations
- Read vs write breakdown
- Per-process aggregation
```

### Example Agent Interaction

**User**: "Database is slow, need to understand if it's cache misses or disk."

**Agent Response**:
```
Let me analyze the I/O layers to understand cache effectiveness.

[perf_io_layers duration=10s]

I/O Layer Analysis:
- VFS read ops: 45,230
- Block read ops: 12,456
- Read hit rate: 72.5% (cache serving most reads)
- VFS write ops: 8,934
- Block write ops: 2,145
- Write coalesce rate: 76.0%

Cache is working but 27.5% of reads go to disk.

[perf_bio_latency histogram_type=log2]

Block I/O Latency:
  0-1μs:    ████████ 12.3%
  1-2μs:    █████████████ 18.5%
  2-4μs:    ████████████████ 24.1%
  4-8μs:    ██████████ 15.2%
  8-16μs:   █████ 8.4%
  16-32μs:  ████ 6.2%
  32-64μs:  ███ 4.8%
  64-128μs: ██ 3.2%
  128-256μs: █ 2.1%
  >256μs:    █████ 5.2% ← Tail latency concern

Analysis:
- Most I/O is fast (< 64μs)
- But 5.2% of operations exceed 256μs
- This tail latency could cause occasional slow queries

Recommendations:
1. Check for I/O scheduling issues (deadline vs mq-deadline)
2. Consider increasing database buffer pool
3. Look for write barriers causing sync latency
```

---

## Workflow 9: File Descriptor Leak Detection

**When to use**: Process running out of file descriptors or suspected FD leak.

**Objective**: Track FD growth over time and identify leak sources.

### Steps

```
Step 1: Get current FD status
─────────────────────────────
Tool: perf_fd_trace
Parameters: pid=<pid>, include_fd_list=true

Questions answered:
- How many FDs are open?
- What types (sockets, files, pipes)?
- What are the FD limits?

Step 2: Monitor FD growth
─────────────────────────────
Tool: perf_fd_trace
Parameters: pid=<pid>, duration_seconds=30, interval_sec=5

Output:
- FD count over time
- Growth rate
- New FD types appearing
```

### Example Agent Interaction

**User**: "Application crashes with 'too many open files' after running for a day."

**Agent Response**:
```
Let me investigate for file descriptor leaks.

[perf_fd_trace pid=12345 include_fd_list=true]

Current FD Status:
- Open FDs: 4,523
- Soft limit: 65536
- Hard limit: 65536
- Usage: 6.9%

FD Type Breakdown:
- socket: 3,891 (86.0%)
- regular: 412 (9.1%)
- pipe: 156 (3.4%)
- anon_inode: 64 (1.4%)

Top socket connections:
- 10.0.0.5:5432 (postgres) × 1,234
- 10.0.0.10:6379 (redis) × 892
- unix:/var/run/... × 1,765

[perf_fd_trace pid=12345 duration_seconds=60 interval_sec=10]

FD Growth Over 60s:
Time    Total   Sockets  Files
0s      4,523   3,891    412
10s     4,567   3,923    424
20s     4,612   3,956    436
30s     4,658   3,989    449
40s     4,703   4,022    461
50s     4,748   4,055    473
60s     4,794   4,088    486

Growth Analysis:
- FD growth rate: 4.5/second
- Primarily sockets (+197 in 60s)
- At this rate: exhausted in ~3.8 hours

Root Cause: Socket leak detected
- Database connections growing (+197 postgres sockets)
- Connection pool may not be releasing connections

Recommendations:
1. Check connection pool settings (max connections, idle timeout)
2. Look for unclosed database connections in code
3. Consider adding connection leak detection logging
```

---

## Workflow 10: Time-Series Performance Analysis

**When to use**: Need to capture performance trends over time.

**Objective**: Collect periodic snapshots for trend analysis.

### Steps

```
Step 1: Collect interval snapshots
─────────────────────────────
Tool: perf_snapshot
Parameters: interval_sec=5, count=12 (60 seconds of data)

Output:
- Multiple snapshots over time
- Trend analysis
- Min/max/avg for key metrics

Step 2: Analyze trends
─────────────────────────────
Look for:
- Growing memory usage
- Increasing I/O wait
- CPU utilization patterns
- Network throughput changes
```

### Example Agent Interaction

**User**: "Capture 1 minute of metrics to see the performance trend."

**Agent Response**:
```
Collecting performance metrics over 60 seconds.

[perf_snapshot interval_sec=10 count=6]

Trend Analysis (60 seconds):

CPU Utilization:
Time     User   Sys   IOWait  Idle
0s       45%    12%   3%      40%
10s      52%    14%   8%      26%
20s      58%    15%   12%     15%
30s      62%    16%   15%     7%
40s      55%    14%   10%     21%
50s      48%    13%   5%      34%

Trend: CPU spiked at 30s with high iowait

Memory:
- Used: 12.3GB → 12.8GB (+500MB)
- Available: 19.7GB → 19.2GB
- Trend: Slight growth, no concern

I/O (sda):
- Utilization: 23% → 78% → 45% (peaked at 30s)
- Await: 2.1ms → 18.5ms → 4.2ms

Summary:
- I/O burst at 30s caused CPU iowait spike
- Memory stable
- Likely batch job or backup ran during observation
```

---

## Workflow 11: Syscall Hotspot Analysis

**When to use**: Application making too many syscalls, need to identify which ones.

**Objective**: Find syscall hotspots and their latency impact.

### Steps

```
Step 1: Count syscalls
─────────────────────────────
Tool: perf_syscall_count
Parameters: pid=<pid>, duration_seconds=10, include_latency=true

Output:
- Top syscalls by count
- Latency distribution per syscall
- Error rates if any
```

### Example Agent Interaction

**User**: "Application seems to be making excessive syscalls."

**Agent Response**:
```
[perf_syscall_count pid=12345 duration=10s include_latency=true]

Top Syscalls (10 seconds):
Syscall         Count    %      Avg Lat  Max Lat
futex           45,234   42.3%  12μs     8.2ms
read            23,456   21.9%  45μs     125ms
write           15,234   14.2%  38μs     89ms
epoll_wait       8,923    8.3%  2.1ms    15ms
clock_gettime    7,234    6.8%  0.8μs    12μs
...

Analysis:
- futex dominates (42%) - lock contention
- read/write have occasional high latency
- clock_gettime called 700x/sec

Issues Detected:
1. Lock contention: 45K futex calls suggest mutex hotspot
2. I/O latency: Some reads taking 125ms

Recommendations:
1. Profile lock contention (off-CPU analysis)
2. Consider reducing lock granularity
3. Clock calls are cheap but could use VDSO
```
