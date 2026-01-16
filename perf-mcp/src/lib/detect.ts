/**
 * Capability detection module
 * Detects system capabilities at startup and caches results
 */

import { access, constants, readFile } from 'node:fs/promises';
import { isCommandAvailable, safeReadFile } from './exec.js';

export interface SystemCapabilities {
  // Kernel info
  kernelVersion: string;
  kernelMajor: number;
  kernelMinor: number;

  // Tool availability
  hasPerf: boolean;
  hasBpftool: boolean;
  hasBpftrace: boolean;
  hasIostat: boolean;
  hasVmstat: boolean;
  hasSar: boolean;
  hasSs: boolean;
  hasNstat: boolean;

  // BCC tools availability
  hasBcc: boolean;
  bccTools: BccToolAvailability;

  // Permission levels
  perfEventParanoid: number;
  isRoot: boolean;
  canUsePerf: boolean;
  canUseBpf: boolean;

  // Feature availability
  hasBtf: boolean;
  hasPsi: boolean;
  cgroupVersion: 1 | 2;
  hasThp: boolean;

  // Environment
  isContainer: boolean;
  virtualization: VirtualizationType;
  cpuCount: number;
  numaNodes: number;
}

export interface BccToolAvailability {
  offcputime: boolean;
  biolatency: boolean;
  runqlat: boolean;
  tcplife: boolean;
  tcpconnect: boolean;
  execsnoop: boolean;
  syscount: boolean;
  funclatency: boolean;
  gethostlatency: boolean;
  filelife: boolean;
  fileslower: boolean;
  bitesize: boolean;
  opensnoop: boolean;
  vfsstat: boolean;
  vfscount: boolean;
}

export type VirtualizationType =
  | 'none'
  | 'kvm'
  | 'xen'
  | 'vmware'
  | 'hyperv'
  | 'docker'
  | 'lxc'
  | 'podman'
  | 'unknown';

let cachedCapabilities: SystemCapabilities | null = null;

/**
 * Parse kernel version string to major.minor
 */
function parseKernelVersion(version: string): { major: number; minor: number } {
  const match = version.match(/^(\d+)\.(\d+)/);
  if (match) {
    return { major: parseInt(match[1], 10), minor: parseInt(match[2], 10) };
  }
  return { major: 0, minor: 0 };
}

/**
 * Detect virtualization type
 */
async function detectVirtualization(): Promise<{
  type: VirtualizationType;
  isContainer: boolean;
}> {
  // Check for container first
  try {
    const cgroup = await safeReadFile('/proc/1/cgroup');
    if (cgroup.success) {
      const content = cgroup.content;
      if (content.includes('docker') || content.includes('containerd')) {
        return { type: 'docker', isContainer: true };
      }
      if (content.includes('lxc')) {
        return { type: 'lxc', isContainer: true };
      }
      if (content.includes('podman')) {
        return { type: 'podman', isContainer: true };
      }
    }
  } catch {
    // Ignore
  }

  // Check /.dockerenv
  try {
    await access('/.dockerenv', constants.F_OK);
    return { type: 'docker', isContainer: true };
  } catch {
    // Not docker
  }

  // Check for VM hypervisor via DMI
  try {
    const vendor = await readFile('/sys/class/dmi/id/sys_vendor', 'utf-8').catch(() => '');
    const product = await readFile('/sys/class/dmi/id/product_name', 'utf-8').catch(() => '');
    const combined = (vendor + product).toLowerCase();

    if (combined.includes('kvm') || combined.includes('qemu')) {
      return { type: 'kvm', isContainer: false };
    }
    if (combined.includes('vmware')) {
      return { type: 'vmware', isContainer: false };
    }
    if (combined.includes('xen')) {
      return { type: 'xen', isContainer: false };
    }
    if (combined.includes('microsoft') || combined.includes('hyper-v')) {
      return { type: 'hyperv', isContainer: false };
    }
  } catch {
    // Ignore DMI errors
  }

  // Check /proc/cpuinfo for hypervisor flag
  try {
    const cpuinfo = await safeReadFile('/proc/cpuinfo');
    if (cpuinfo.success && cpuinfo.content.includes('hypervisor')) {
      return { type: 'unknown', isContainer: false };
    }
  } catch {
    // Ignore
  }

  return { type: 'none', isContainer: false };
}

/**
 * Detect cgroup version
 */
async function detectCgroupVersion(): Promise<1 | 2> {
  try {
    // Check for cgroup v2 unified hierarchy
    const controllerPath = '/sys/fs/cgroup/cgroup.controllers';
    await access(controllerPath, constants.R_OK);
    return 2;
  } catch {
    return 1;
  }
}

/**
 * Count CPU cores
 */
async function countCpus(): Promise<number> {
  try {
    const cpuinfo = await safeReadFile('/proc/cpuinfo');
    if (cpuinfo.success) {
      const matches = cpuinfo.content.match(/^processor\s*:/gm);
      return matches?.length ?? 1;
    }
  } catch {
    // Fallback
  }
  return 1;
}

/**
 * Detect NUMA nodes
 */
async function countNumaNodes(): Promise<number> {
  try {
    // Count directories matching /sys/devices/system/node/node*
    const { readdir } = await import('node:fs/promises');
    const entries = await readdir('/sys/devices/system/node');
    const nodes = entries.filter((e) => e.startsWith('node'));
    return nodes.length || 1;
  } catch {
    return 1;
  }
}

/**
 * Check if a BCC tool is available
 */
async function isBccToolAvailable(tool: string): Promise<boolean> {
  const paths = [
    `/usr/share/bcc/tools/${tool}`,
    `/usr/sbin/${tool}-bpfcc`,
    `/usr/bin/${tool}`,
  ];

  for (const path of paths) {
    try {
      await access(path, constants.X_OK);
      return true;
    } catch {
      // Try next path
    }
  }
  return false;
}

/**
 * Detect all available BCC tools
 */
async function detectBccTools(): Promise<BccToolAvailability> {
  const tools = [
    'offcputime', 'biolatency', 'runqlat', 'tcplife', 'tcpconnect',
    'execsnoop', 'syscount', 'funclatency', 'gethostlatency',
    'filelife', 'fileslower', 'bitesize', 'opensnoop', 'vfsstat', 'vfscount'
  ] as const;

  const results = await Promise.all(tools.map(isBccToolAvailable));

  return {
    offcputime: results[0],
    biolatency: results[1],
    runqlat: results[2],
    tcplife: results[3],
    tcpconnect: results[4],
    execsnoop: results[5],
    syscount: results[6],
    funclatency: results[7],
    gethostlatency: results[8],
    filelife: results[9],
    fileslower: results[10],
    bitesize: results[11],
    opensnoop: results[12],
    vfsstat: results[13],
    vfscount: results[14],
  };
}

/**
 * Detect all system capabilities
 */
export async function detectCapabilities(): Promise<SystemCapabilities> {
  if (cachedCapabilities) {
    return cachedCapabilities;
  }

  // Kernel version
  let kernelVersion = 'unknown';
  try {
    const version = await safeReadFile('/proc/version');
    if (version.success) {
      const match = version.content.match(/Linux version ([\d.]+)/);
      kernelVersion = match?.[1] ?? 'unknown';
    }
  } catch {
    // Ignore
  }
  const { major: kernelMajor, minor: kernelMinor } = parseKernelVersion(kernelVersion);

  // Tool availability (parallel checks)
  const [hasPerf, hasBpftool, hasBpftrace, hasIostat, hasVmstat, hasSar, hasSs, hasNstat] =
    await Promise.all([
      isCommandAvailable('perf'),
      isCommandAvailable('bpftool'),
      isCommandAvailable('which').then(async (hasWhich) => {
        if (!hasWhich) return false;
        // bpftrace might be in different locations
        try {
          await access('/usr/bin/bpftrace', constants.X_OK);
          return true;
        } catch {
          return false;
        }
      }),
      isCommandAvailable('iostat'),
      isCommandAvailable('vmstat'),
      isCommandAvailable('sar'),
      isCommandAvailable('ss'),
      isCommandAvailable('nstat'),
    ]);

  // perf_event_paranoid
  let perfEventParanoid = 4; // Default to most restrictive
  try {
    const paranoid = await safeReadFile('/proc/sys/kernel/perf_event_paranoid');
    if (paranoid.success) {
      perfEventParanoid = parseInt(paranoid.content.trim(), 10);
    }
  } catch {
    // Ignore
  }

  // Check root
  const isRoot = process.getuid?.() === 0;

  // Can use perf: either root, or paranoid <= 1, or has CAP_PERFMON
  // For simplicity, we check root and paranoid level
  const canUsePerf = hasPerf && (isRoot || perfEventParanoid <= 1);

  // BCC tools detection
  const bccTools = await detectBccTools();
  const hasBcc = Object.values(bccTools).some((v) => v);

  // Can use BPF: typically requires root or CAP_BPF + CAP_PERFMON
  // BTF being available is a good indicator the kernel supports modern eBPF
  const canUseBpf = isRoot && hasBcc;

  // BTF availability
  let hasBtf = false;
  try {
    await access('/sys/kernel/btf/vmlinux', constants.R_OK);
    hasBtf = true;
  } catch {
    // No BTF
  }

  // PSI availability
  let hasPsi = false;
  try {
    await access('/proc/pressure/cpu', constants.R_OK);
    hasPsi = true;
  } catch {
    // No PSI
  }

  // THP availability
  let hasThp = false;
  try {
    await access('/sys/kernel/mm/transparent_hugepage/enabled', constants.R_OK);
    hasThp = true;
  } catch {
    // No THP
  }

  // Cgroup version
  const cgroupVersion = await detectCgroupVersion();

  // Virtualization
  const { type: virtualization, isContainer } = await detectVirtualization();

  // CPU count
  const cpuCount = await countCpus();

  // NUMA nodes
  const numaNodes = await countNumaNodes();

  cachedCapabilities = {
    kernelVersion,
    kernelMajor,
    kernelMinor,
    hasPerf,
    hasBpftool,
    hasBpftrace,
    hasIostat,
    hasVmstat,
    hasSar,
    hasSs,
    hasNstat,
    hasBcc,
    bccTools,
    perfEventParanoid,
    isRoot,
    canUsePerf,
    canUseBpf,
    hasBtf,
    hasPsi,
    cgroupVersion,
    hasThp,
    isContainer,
    virtualization,
    cpuCount,
    numaNodes,
  };

  return cachedCapabilities;
}

/**
 * Clear cached capabilities (for testing)
 */
export function clearCapabilityCache(): void {
  cachedCapabilities = null;
}

/**
 * Get cached capabilities (throws if not detected)
 */
export function getCachedCapabilities(): SystemCapabilities {
  if (!cachedCapabilities) {
    throw new Error('Capabilities not detected. Call detectCapabilities() first.');
  }
  return cachedCapabilities;
}
