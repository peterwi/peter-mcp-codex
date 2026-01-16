/**
 * perf_io_latency tool - Block I/O latency analysis
 */
import type { PerfIoLatencyData, PerfResponse } from '../lib/schemas.js';
interface IoLatencyOptions {
    duration_seconds?: number;
    device?: string;
    mode?: 'snapshot' | 'trace';
}
export declare function perfIoLatency(options?: IoLatencyOptions): Promise<PerfResponse<PerfIoLatencyData>>;
export {};
//# sourceMappingURL=io-latency.d.ts.map