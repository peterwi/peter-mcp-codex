# Research Notes: Process Tracing Implementation

## Overview

This document captures research findings for implementing comprehensive process tracing (fork/clone/exec) in `perf_exec_trace`.

## Linux Kernel Tracepoints

### sched_process_fork

Triggered when a process creates a child via fork(), clone(), or vfork().

**Fields:**
```
field:char parent_comm[16];   # Parent process name
field:pid_t parent_pid;       # Parent PID
field:char child_comm[16];    # Child process name (initially same as parent)
field:pid_t child_pid;        # New child PID
```

**Format string:** `comm=%s pid=%d child_comm=%s child_pid=%d`

### sched_process_exec

Triggered when a process calls execve() to replace its image.

**Fields:**
```
field:__data_loc char[] filename;  # Path to executable
field:pid_t pid;                    # Process ID
field:pid_t old_pid;                # Old PID (before exec)
```

**Format string:** `filename=%s pid=%d old_pid=%d`

### sched_process_exit

Triggered when a process terminates.

**Fields:**
```
field:char comm[16];  # Process name
field:pid_t pid;      # Process ID
field:int prio;       # Priority (not exit code)
```

**Format string:** `comm=%s pid=%d prio=%d`

**Note:** The `prio` field is the scheduler priority, not the exit code. Exit codes require additional tracing or /proc access.

## BCC Tool Survey

### Available Tools

| Tool | Purpose | Our Use Case |
|------|---------|--------------|
| `execsnoop` | Traces exec() syscalls | Primary backend for exec-only mode |
| `threadsnoop` | Traces pthread_create via uprobe | Not suitable (userspace only) |
| `exitsnoop` | Traces process exits | Potential future enhancement |
| `pidpersec` | Counts process creation rate | Reference only |

### Key Finding: No procsnoop/forksnoop

BCC does **not** include dedicated tools for fork/clone tracing. The execsnoop tool only captures exec() events, missing:
- fork() without exec() (process forks then exits)
- clone() for thread creation
- vfork() scenarios

## Implementation Approach

### Backend Selection

1. **bpftrace comprehensive** (preferred for fork+exec+exit)
   - Uses embedded fixed script with sched tracepoints
   - Provides full process lifecycle visibility
   - Outputs parseable pipe-delimited format

2. **BCC execsnoop** (fallback for exec-only)
   - Legacy mode for systems with BCC but no bpftrace
   - Only captures exec() events
   - Well-tested and stable

### bpftrace Script Design

```bpftrace
tracepoint:sched:sched_process_fork
{
  printf("FORK|%llu|%d|%s|%d|%s\n",
    nsecs / 1000000,
    args->parent_pid,
    args->parent_comm,
    args->child_pid,
    args->child_comm);
}

tracepoint:sched:sched_process_exec
{
  printf("EXEC|%llu|%d|%s|%s\n",
    nsecs / 1000000,
    pid,
    comm,
    str(args->filename));
}

tracepoint:sched:sched_process_exit
{
  printf("EXIT|%llu|%d|%s|%d\n",
    nsecs / 1000000,
    pid,
    comm,
    args->prio);
}
```

### Output Format

Pipe-delimited for reliable parsing:
- `FORK|timestamp_ms|parent_pid|parent_comm|child_pid|child_comm`
- `EXEC|timestamp_ms|pid|comm|filename`
- `EXIT|timestamp_ms|pid|comm|prio`

## fork() vs clone() Distinction

The Linux kernel uses clone() internally for both process and thread creation:
- **Process creation**: clone() without CLONE_THREAD flag (new TGID)
- **Thread creation**: clone() with CLONE_THREAD flag (same TGID)

The `sched_process_fork` tracepoint fires for both cases. Distinguishing threads from processes would require:
1. Checking if child_pid == child_tgid (process) vs child_pid != child_tgid (thread)
2. The tracepoint doesn't expose TGID directly, so thread detection isn't trivial

For our implementation, we treat all fork events equally and rely on subsequent exec events to identify true process creation patterns.

## Safety Considerations

1. **Fixed embedded script** - No user-provided bpftrace code
2. **PID filtering** - Optional filter applied in bpftrace filter clause
3. **Duration limit** - Max 60 seconds
4. **Event cap** - Max 5000 events returned
5. **Output truncation** - Standard truncation markers

## Future Enhancements

1. **Thread-aware tracing** - Distinguish CLONE_THREAD from fork
2. **Exit code capture** - Use tracepoint:syscalls:sys_exit_exit_group
3. **Ancestry tracking** - Build full process ancestry chains
4. **Real-time streaming** - For long-running process monitoring

## References

- Linux kernel source: `include/trace/events/sched.h`
- bpftrace reference: https://github.com/bpftrace/bpftrace/blob/master/docs/reference_guide.md
- BCC tools: https://github.com/iovisor/bcc/tree/master/tools
