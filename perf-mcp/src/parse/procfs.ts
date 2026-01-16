/**
 * Parsers for /proc filesystem files
 */

import type {
  CpuUtilization,
  MemoryStats,
  NetworkInterfaceStats,
  PsiMetrics,
  TcpStats,
} from '../lib/schemas.js';

/**
 * Parse /proc/stat for CPU statistics
 */
export function parseProcStat(content: string): {
  cpu: CpuUtilization;
  contextSwitches: number;
  interrupts: number;
  runQueue: number;
  processesRunning: number;
} {
  const lines = content.split('\n');

  // Parse aggregate CPU line (first cpu line without number)
  const cpuLine = lines.find((l) => l.startsWith('cpu '));
  const cpuParts = cpuLine?.split(/\s+/).slice(1).map(Number) ?? [];

  // CPU time is in jiffies (typically 100 per second)
  const [user = 0, nice = 0, system = 0, idle = 0, iowait = 0, irq = 0, softirq = 0, steal = 0] =
    cpuParts;

  const total = user + nice + system + idle + iowait + irq + softirq + steal;
  const toPercent = (v: number) => (total > 0 ? (v / total) * 100 : 0);

  // Parse other stats
  let contextSwitches = 0;
  let interrupts = 0;
  let processesRunning = 0;
  let processesBlocked = 0;

  for (const line of lines) {
    if (line.startsWith('ctxt ')) {
      contextSwitches = parseInt(line.split(' ')[1], 10);
    } else if (line.startsWith('intr ')) {
      interrupts = parseInt(line.split(' ')[1], 10);
    } else if (line.startsWith('procs_running ')) {
      processesRunning = parseInt(line.split(' ')[1], 10);
    } else if (line.startsWith('procs_blocked ')) {
      processesBlocked = parseInt(line.split(' ')[1], 10);
    }
  }

  return {
    cpu: {
      user: toPercent(user),
      nice: toPercent(nice),
      system: toPercent(system),
      idle: toPercent(idle),
      iowait: toPercent(iowait),
      irq: toPercent(irq),
      softirq: toPercent(softirq),
      steal: toPercent(steal),
    },
    contextSwitches,
    interrupts,
    runQueue: processesRunning + processesBlocked,
    processesRunning,
  };
}

/**
 * Parse /proc/loadavg
 */
export function parseProcLoadavg(content: string): {
  loadAvg: [number, number, number];
  runQueue: number;
  totalProcesses: number;
} {
  const parts = content.trim().split(/\s+/);
  const loadAvg: [number, number, number] = [
    parseFloat(parts[0]) || 0,
    parseFloat(parts[1]) || 0,
    parseFloat(parts[2]) || 0,
  ];

  // Fourth field is running/total processes (e.g., "1/234")
  const [running, total] = (parts[3] ?? '0/0').split('/').map(Number);

  return {
    loadAvg,
    runQueue: running || 0,
    totalProcesses: total || 0,
  };
}

/**
 * Parse /proc/meminfo
 */
export function parseProcMeminfo(content: string): MemoryStats {
  const values: Record<string, number> = {};

  for (const line of content.split('\n')) {
    const match = line.match(/^(\w+):\s+(\d+)/);
    if (match) {
      // Values are in kB, convert to bytes
      values[match[1]] = parseInt(match[2], 10) * 1024;
    }
  }

  const total = values['MemTotal'] ?? 0;
  const available = values['MemAvailable'] ?? values['MemFree'] ?? 0;
  const buffers = values['Buffers'] ?? 0;
  const cached = values['Cached'] ?? 0;
  const swapTotal = values['SwapTotal'] ?? 0;
  const swapFree = values['SwapFree'] ?? 0;

  return {
    total_bytes: total,
    available_bytes: available,
    used_bytes: total - available,
    buffers_bytes: buffers,
    cached_bytes: cached,
    swap_used_bytes: swapTotal - swapFree,
    swap_total_bytes: swapTotal,
    page_faults: 0, // From vmstat
    major_faults: 0, // From vmstat
  };
}

/**
 * Parse /proc/vmstat for page fault info
 */
export function parseProcVmstat(content: string): {
  pgfault: number;
  pgmajfault: number;
  pswpin: number;
  pswpout: number;
} {
  const values: Record<string, number> = {};

  for (const line of content.split('\n')) {
    const parts = line.split(' ');
    if (parts.length === 2) {
      values[parts[0]] = parseInt(parts[1], 10);
    }
  }

  return {
    pgfault: values['pgfault'] ?? 0,
    pgmajfault: values['pgmajfault'] ?? 0,
    pswpin: values['pswpin'] ?? 0,
    pswpout: values['pswpout'] ?? 0,
  };
}

/**
 * Parse /proc/uptime
 */
export function parseProcUptime(content: string): {
  uptimeSeconds: number;
  idleSeconds: number;
} {
  const parts = content.trim().split(/\s+/);
  return {
    uptimeSeconds: parseFloat(parts[0]) || 0,
    idleSeconds: parseFloat(parts[1]) || 0,
  };
}

/**
 * Parse /proc/net/dev for network interface statistics
 */
export function parseProcNetDev(content: string): NetworkInterfaceStats[] {
  const interfaces: NetworkInterfaceStats[] = [];
  const lines = content.split('\n');

  // Skip header lines (first 2 lines)
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Format: iface: rx_bytes rx_packets rx_errs rx_drop ... tx_bytes tx_packets tx_errs tx_drop ...
    const match = line.match(/^(\w+):\s*(.+)/);
    if (!match) continue;

    const name = match[1];
    const values = match[2].split(/\s+/).map(Number);

    // Skip loopback for most purposes
    if (name === 'lo') continue;

    interfaces.push({
      name,
      rx_bytes: values[0] ?? 0,
      rx_packets: values[1] ?? 0,
      rx_errors: values[2] ?? 0,
      rx_dropped: values[3] ?? 0,
      tx_bytes: values[8] ?? 0,
      tx_packets: values[9] ?? 0,
      tx_errors: values[10] ?? 0,
      tx_dropped: values[11] ?? 0,
    });
  }

  return interfaces;
}

/**
 * Parse /proc/net/snmp for TCP statistics
 */
export function parseProcNetSnmp(content: string): TcpStats {
  const lines = content.split('\n');
  let tcpHeader: string[] = [];
  let tcpValues: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('Tcp:')) {
      if (tcpHeader.length === 0) {
        tcpHeader = line.split(/\s+/).slice(1);
      } else {
        tcpValues = line.split(/\s+/).slice(1).map(Number);
      }
    }
  }

  const getValue = (name: string): number => {
    const idx = tcpHeader.indexOf(name);
    return idx >= 0 ? (tcpValues[idx] ?? 0) : 0;
  };

  return {
    active_connections: getValue('ActiveOpens'),
    passive_connections: getValue('PassiveOpens'),
    retransmits: getValue('RetransSegs'),
    in_segs: getValue('InSegs'),
    out_segs: getValue('OutSegs'),
  };
}

/**
 * Parse /proc/pressure/* (PSI) files
 */
export function parseProcPressure(content: string): PsiMetrics {
  const result: PsiMetrics = {
    some_avg10: 0,
    some_avg60: 0,
    some_avg300: 0,
    full_avg10: 0,
    full_avg60: 0,
    full_avg300: 0,
    some_total: 0,
    full_total: 0,
  };

  for (const line of content.split('\n')) {
    const parts = line.split(' ');
    const type = parts[0]; // 'some' or 'full'

    if (type !== 'some' && type !== 'full') continue;

    for (const part of parts.slice(1)) {
      const [key, value] = part.split('=');
      const numValue = parseFloat(value);

      if (key === 'avg10') {
        result[`${type}_avg10` as keyof PsiMetrics] = numValue;
      } else if (key === 'avg60') {
        result[`${type}_avg60` as keyof PsiMetrics] = numValue;
      } else if (key === 'avg300') {
        result[`${type}_avg300` as keyof PsiMetrics] = numValue;
      } else if (key === 'total') {
        result[`${type}_total` as keyof PsiMetrics] = numValue;
      }
    }
  }

  return result;
}

/**
 * Parse /proc/<pid>/cgroup for cgroup path
 */
export function parseProcPidCgroup(content: string): string | null {
  // For cgroups v2, look for the unified hierarchy (0::)
  for (const line of content.split('\n')) {
    if (line.startsWith('0::')) {
      return line.slice(3).trim() || '/';
    }
  }

  // For cgroups v1, find the first non-empty path
  for (const line of content.split('\n')) {
    const parts = line.split(':');
    if (parts.length >= 3 && parts[2] && parts[2] !== '/') {
      return parts[2];
    }
  }

  return null;
}

/**
 * Parse /proc/cpuinfo for CPU model
 */
export function parseProcCpuinfo(content: string): {
  model: string;
  cores: number;
  threads: number;
} {
  let model = 'Unknown';
  let cores = 0;
  let threads = 0;
  const physicalIds = new Set<string>();
  const coreIds = new Set<string>();

  for (const line of content.split('\n')) {
    if (line.startsWith('model name')) {
      const match = line.match(/:\s*(.+)/);
      if (match) model = match[1].trim();
    } else if (line.startsWith('processor')) {
      threads++;
    } else if (line.startsWith('physical id')) {
      const match = line.match(/:\s*(\d+)/);
      if (match) physicalIds.add(match[1]);
    } else if (line.startsWith('core id')) {
      const match = line.match(/:\s*(\d+)/);
      if (match) coreIds.add(match[1]);
    } else if (line.startsWith('cpu cores')) {
      const match = line.match(/:\s*(\d+)/);
      if (match) cores = parseInt(match[1], 10);
    }
  }

  // If we didn't get cores from cpu cores field, estimate
  if (cores === 0) {
    cores = coreIds.size || threads;
  }

  return { model, cores, threads: threads || 1 };
}

/**
 * Parse /proc/diskstats
 */
export interface DiskStats {
  device: string;
  readsCompleted: number;
  readsMerged: number;
  sectorsRead: number;
  msReading: number;
  writesCompleted: number;
  writesMerged: number;
  sectorsWritten: number;
  msWriting: number;
  iosInProgress: number;
  msIo: number;
  weightedMsIo: number;
}

export function parseProcDiskstats(content: string): DiskStats[] {
  const stats: DiskStats[] = [];

  for (const line of content.split('\n')) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 14) continue;

    const device = parts[2];

    // Skip partitions (only whole devices)
    if (/\d+$/.test(device) && !/^(nvme\d+n\d+|mmcblk\d+)$/.test(device)) {
      continue;
    }

    // Skip loop and ram devices
    if (device.startsWith('loop') || device.startsWith('ram')) {
      continue;
    }

    stats.push({
      device,
      readsCompleted: parseInt(parts[3], 10),
      readsMerged: parseInt(parts[4], 10),
      sectorsRead: parseInt(parts[5], 10),
      msReading: parseInt(parts[6], 10),
      writesCompleted: parseInt(parts[7], 10),
      writesMerged: parseInt(parts[8], 10),
      sectorsWritten: parseInt(parts[9], 10),
      msWriting: parseInt(parts[10], 10),
      iosInProgress: parseInt(parts[11], 10),
      msIo: parseInt(parts[12], 10),
      weightedMsIo: parseInt(parts[13], 10),
    });
  }

  return stats;
}
