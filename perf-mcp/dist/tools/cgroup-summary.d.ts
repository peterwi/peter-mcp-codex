/**
 * perf_cgroup_summary tool - Cgroup v2 resource usage analysis
 */
import type { PerfCgroupSummaryData, PerfResponse } from '../lib/schemas.js';
interface CgroupSummaryOptions {
    pid?: number;
    cgroup_path?: string;
}
export declare function perfCgroupSummary(options?: CgroupSummaryOptions): Promise<PerfResponse<PerfCgroupSummaryData>>;
export {};
//# sourceMappingURL=cgroup-summary.d.ts.map