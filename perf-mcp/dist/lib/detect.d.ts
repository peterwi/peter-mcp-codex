/**
 * Capability detection module
 * Detects system capabilities at startup and caches results
 */
export interface SystemCapabilities {
    kernelVersion: string;
    kernelMajor: number;
    kernelMinor: number;
    hasPerf: boolean;
    hasBpftool: boolean;
    hasBpftrace: boolean;
    hasIostat: boolean;
    hasVmstat: boolean;
    hasSar: boolean;
    hasSs: boolean;
    hasNstat: boolean;
    hasBcc: boolean;
    bccTools: BccToolAvailability;
    perfEventParanoid: number;
    isRoot: boolean;
    canUsePerf: boolean;
    canUseBpf: boolean;
    hasBtf: boolean;
    hasPsi: boolean;
    cgroupVersion: 1 | 2;
    hasThp: boolean;
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
export type VirtualizationType = 'none' | 'kvm' | 'xen' | 'vmware' | 'hyperv' | 'docker' | 'lxc' | 'podman' | 'unknown';
/**
 * Detect all system capabilities
 */
export declare function detectCapabilities(): Promise<SystemCapabilities>;
/**
 * Clear cached capabilities (for testing)
 */
export declare function clearCapabilityCache(): void;
/**
 * Get cached capabilities (throws if not detected)
 */
export declare function getCachedCapabilities(): SystemCapabilities;
//# sourceMappingURL=detect.d.ts.map