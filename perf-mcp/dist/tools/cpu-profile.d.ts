/**
 * perf_cpu_profile tool - On-CPU profiling
 */
import type { PerfCpuProfileData, PerfResponse } from '../lib/schemas.js';
interface CpuProfileOptions {
    duration_seconds?: number;
    sample_rate_hz?: number;
    pid?: number;
    include_kernel?: boolean;
    output_format?: 'summary' | 'collapsed';
}
export declare function perfCpuProfile(options?: CpuProfileOptions): Promise<PerfResponse<PerfCpuProfileData>>;
export {};
//# sourceMappingURL=cpu-profile.d.ts.map