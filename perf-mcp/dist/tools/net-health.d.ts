/**
 * perf_net_health tool - Network stack health summary
 */
import type { PerfNetHealthData, PerfResponse } from '../lib/schemas.js';
interface NetHealthOptions {
    interface?: string;
    include_tcp_details?: boolean;
}
export declare function perfNetHealth(options?: NetHealthOptions): Promise<PerfResponse<PerfNetHealthData>>;
export {};
//# sourceMappingURL=net-health.d.ts.map