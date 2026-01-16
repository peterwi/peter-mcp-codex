/**
 * perf_dns_latency tool
 * DNS query latency tracing using BCC gethostlatency
 */
import { z } from 'zod';
import type { PerfResponse } from '../lib/schemas.js';
export declare const DnsLatencyInputSchema: z.ZodObject<{
    duration_seconds: z.ZodDefault<z.ZodNumber>;
    pid: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    duration_seconds: number;
    pid?: number | undefined;
}, {
    duration_seconds?: number | undefined;
    pid?: number | undefined;
}>;
export type DnsLatencyInput = z.infer<typeof DnsLatencyInputSchema>;
export type DnsLatencyRawInput = z.input<typeof DnsLatencyInputSchema>;
export interface DnsQuery {
    timestamp: string;
    pid: number;
    comm: string;
    latency_ms: number;
    host: string;
}
export interface DnsLatencyData {
    method: 'bcc_gethostlatency';
    duration_seconds: number;
    filter_pid?: number;
    queries: DnsQuery[];
    summary: {
        total_queries: number;
        avg_latency_ms: number;
        p50_ms: number;
        p95_ms: number;
        p99_ms: number;
        max_latency_ms: number;
        by_host: Record<string, {
            count: number;
            avg_latency_ms: number;
        }>;
        by_process: Record<string, {
            count: number;
            avg_latency_ms: number;
        }>;
    };
    truncated: boolean;
    notes: string[];
}
export declare function perfDnsLatency(input?: DnsLatencyRawInput): Promise<PerfResponse<DnsLatencyData>>;
//# sourceMappingURL=dns-latency.d.ts.map