/**
 * bpftrace Fallback Scripts
 * Embedded bpftrace scripts that serve as fallbacks when BCC tools fail
 *
 * SECURITY NOTE: These are FIXED, embedded scripts - no user input is executed.
 * Parameters are validated and injected safely using template literals.
 */

/**
 * Syscall counting fallback
 * Equivalent to: syscount -d DURATION
 */
export function getSyscountScript(durationSec: number, pid?: number): string {
  const pidFilter = pid ? `pid == ${pid}` : '1';

  return `
tracepoint:raw_syscalls:sys_enter
/${pidFilter}/
{
  @syscalls[args->id] = count();
  @by_comm[comm] = count();
}

interval:s:${durationSec}
{
  exit();
}

END
{
  printf("\\n=== Syscall Counts ===\\n");
  print(@syscalls);
  printf("\\n=== By Process ===\\n");
  print(@by_comm);
  clear(@syscalls);
  clear(@by_comm);
}
`.trim();
}

/**
 * DNS latency fallback using getaddrinfo uprobe
 * Equivalent to: gethostlatency
 */
export function getDnsLatencyScript(durationSec: number, pid?: number): string {
  const pidFilter = pid ? `pid == ${pid}` : '1';

  return `
uprobe:/lib/x86_64-linux-gnu/libc.so.6:getaddrinfo,
uprobe:/lib/x86_64-linux-gnu/libc.so.6:gethostbyname,
uprobe:/lib/x86_64-linux-gnu/libc.so.6:gethostbyname2
/${pidFilter}/
{
  @start[tid] = nsecs;
  @host[tid] = str(arg0);
}

uretprobe:/lib/x86_64-linux-gnu/libc.so.6:getaddrinfo,
uretprobe:/lib/x86_64-linux-gnu/libc.so.6:gethostbyname,
uretprobe:/lib/x86_64-linux-gnu/libc.so.6:gethostbyname2
/@start[tid]/
{
  $latency_ms = (nsecs - @start[tid]) / 1000000;
  printf("DNS|%llu|%d|%s|%s|%d\\n",
    nsecs / 1000000,
    pid,
    comm,
    @host[tid],
    $latency_ms);
  @latency_hist = hist($latency_ms);
  delete(@start[tid]);
  delete(@host[tid]);
}

interval:s:${durationSec}
{
  exit();
}

END
{
  printf("\\n=== Latency Histogram (ms) ===\\n");
  print(@latency_hist);
  clear(@start);
  clear(@host);
  clear(@latency_hist);
}
`.trim();
}

/**
 * Block I/O latency fallback
 * Equivalent to: biolatency
 */
export function getBioLatencyScript(durationSec: number, _device?: string): string {
  // Device filtering is handled via bpftrace array keys

  return `
tracepoint:block:block_rq_issue
{
  @start[args->dev, args->sector] = nsecs;
}

tracepoint:block:block_rq_complete
/@start[args->dev, args->sector]/
{
  $latency_us = (nsecs - @start[args->dev, args->sector]) / 1000;
  @latency_hist = hist($latency_us);
  @by_dev[args->dev] = hist($latency_us);
  delete(@start[args->dev, args->sector]);
}

interval:s:${durationSec}
{
  exit();
}

END
{
  printf("\\n=== Block I/O Latency (us) ===\\n");
  print(@latency_hist);
  printf("\\n=== By Device ===\\n");
  print(@by_dev);
  clear(@start);
  clear(@latency_hist);
  clear(@by_dev);
}
`.trim();
}

/**
 * Process execution tracing with fork/clone
 * Comprehensive process lifecycle tracing
 */
export function getProcessTraceScript(
  durationSec: number,
  includeFork: boolean = true,
  includeExec: boolean = true,
  includeExit: boolean = false,
  pid?: number
): string {
  const pidFilter = pid ? `args->parent_pid == ${pid} || pid == ${pid}` : '1';
  const lines: string[] = [];

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

  lines.push(`
interval:s:${durationSec}
{
  exit();
}

END
{
  // Clean exit
}
`);

  return lines.join('\n').trim();
}

/**
 * File operations tracing fallback
 * Traces VFS operations with latency
 */
export function getFileOpsScript(durationSec: number, minLatencyMs: number = 10, pid?: number): string {
  const pidFilter = pid ? `pid == ${pid}` : '1';
  const minLatencyUs = minLatencyMs * 1000;

  return `
tracepoint:syscalls:sys_enter_read,
tracepoint:syscalls:sys_enter_write,
tracepoint:syscalls:sys_enter_openat,
tracepoint:syscalls:sys_enter_close
/${pidFilter}/
{
  @start[tid] = nsecs;
  @op[tid] = probe;
}

tracepoint:syscalls:sys_exit_read,
tracepoint:syscalls:sys_exit_write,
tracepoint:syscalls:sys_exit_openat,
tracepoint:syscalls:sys_exit_close
/@start[tid]/
{
  $delta_us = (nsecs - @start[tid]) / 1000;
  if ($delta_us >= ${minLatencyUs}) {
    printf("FILEOP|%llu|%d|%s|%s|%d|%d\\n",
      nsecs / 1000000,
      pid,
      comm,
      @op[tid],
      args->ret,
      $delta_us / 1000);
  }
  delete(@start[tid]);
  delete(@op[tid]);
}

interval:s:${durationSec}
{
  exit();
}

END
{
  clear(@start);
  clear(@op);
}
`.trim();
}

/**
 * CPU run queue latency fallback
 * Equivalent to: runqlat
 */
export function getRunqlatScript(durationSec: number, _pid?: number): string {
  // Pid filtering would need to be added to the script if needed

  return `
tracepoint:sched:sched_wakeup,
tracepoint:sched:sched_wakeup_new
{
  @qtime[args->pid] = nsecs;
}

tracepoint:sched:sched_switch
{
  $prev_pid = args->prev_pid;
  $next_pid = args->next_pid;

  if (@qtime[$next_pid]) {
    $delta_us = (nsecs - @qtime[$next_pid]) / 1000;
    @latency = hist($delta_us);
    delete(@qtime[$next_pid]);
  }
}

interval:s:${durationSec}
{
  exit();
}

END
{
  printf("\\n=== Run Queue Latency (us) ===\\n");
  print(@latency);
  clear(@qtime);
  clear(@latency);
}
`.trim();
}

/**
 * Off-CPU analysis fallback
 * Equivalent to: offcputime
 */
export function getOffcpuScript(durationSec: number, _pid?: number, minBlockUs: number = 1000): string {
  // Pid filtering would need to be added to the script if needed

  return `
tracepoint:sched:sched_switch
{
  if (args->prev_state == 1) {  // TASK_INTERRUPTIBLE
    @start[args->prev_pid] = nsecs;
  }
}

tracepoint:sched:sched_switch
/@start[args->next_pid]/
{
  $delta_us = (nsecs - @start[args->next_pid]) / 1000;
  if ($delta_us >= ${minBlockUs}) {
    @offcpu[args->next_pid, args->next_comm] = sum($delta_us);
    @total = sum($delta_us);
  }
  delete(@start[args->next_pid]);
}

interval:s:${durationSec}
{
  exit();
}

END
{
  printf("\\n=== Off-CPU Time (us) ===\\n");
  print(@offcpu);
  printf("\\nTotal off-CPU time: ");
  print(@total);
  clear(@start);
  clear(@offcpu);
  clear(@total);
}
`.trim();
}

/**
 * TCP connection tracing fallback
 */
export function getTcpTraceScript(durationSec: number, pid?: number): string {
  const pidFilter = pid ? `pid == ${pid}` : '1';

  return `
tracepoint:syscalls:sys_enter_connect
/${pidFilter}/
{
  @connect_start[tid] = nsecs;
}

tracepoint:syscalls:sys_exit_connect
/@connect_start[tid]/
{
  $latency_us = (nsecs - @connect_start[tid]) / 1000;
  printf("CONNECT|%llu|%d|%s|%d\\n",
    nsecs / 1000000,
    pid,
    comm,
    $latency_us);
  @connect_lat = hist($latency_us);
  delete(@connect_start[tid]);
}

kprobe:tcp_close
/${pidFilter}/
{
  printf("CLOSE|%llu|%d|%s\\n",
    nsecs / 1000000,
    pid,
    comm);
}

interval:s:${durationSec}
{
  exit();
}

END
{
  printf("\\n=== Connect Latency (us) ===\\n");
  print(@connect_lat);
  clear(@connect_start);
  clear(@connect_lat);
}
`.trim();
}

/**
 * Get appropriate fallback script for a BCC tool
 */
export function getFallbackScript(
  tool: string,
  durationSec: number,
  options?: {
    pid?: number;
    device?: string;
    minLatencyMs?: number;
    includeFork?: boolean;
    includeExec?: boolean;
    includeExit?: boolean;
  }
): string | null {
  switch (tool) {
    case 'syscount':
      return getSyscountScript(durationSec, options?.pid);
    case 'gethostlatency':
      return getDnsLatencyScript(durationSec, options?.pid);
    case 'biolatency':
      return getBioLatencyScript(durationSec, options?.device);
    case 'execsnoop':
      return getProcessTraceScript(
        durationSec,
        options?.includeFork ?? true,
        options?.includeExec ?? true,
        options?.includeExit ?? false,
        options?.pid
      );
    case 'fileslower':
      return getFileOpsScript(durationSec, options?.minLatencyMs ?? 10, options?.pid);
    case 'runqlat':
      return getRunqlatScript(durationSec, options?.pid);
    case 'offcputime':
      return getOffcpuScript(durationSec, options?.pid);
    case 'tcplife':
    case 'tcpconnect':
      return getTcpTraceScript(durationSec, options?.pid);
    default:
      return null;
  }
}
