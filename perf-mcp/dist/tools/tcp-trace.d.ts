/**
 * perf_tcp_trace tool
 * TCP connection tracing using BCC tcplife/tcpconnect
 * Shows TCP connection lifecycle and latency
 */
import { z } from 'zod';
import type { PerfResponse } from '../lib/schemas.js';
export declare const TcpTraceInputSchema: z.ZodObject<{
    duration_seconds: z.ZodDefault<z.ZodNumber>;
    mode: z.ZodDefault<z.ZodEnum<["connections", "lifecycle"]>>;
    pid: z.ZodOptional<z.ZodNumber>;
    port: z.ZodOptional<z.ZodNumber>;
    local_port: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    duration_seconds: number;
    mode: "connections" | "lifecycle";
    pid?: number | undefined;
    port?: number | undefined;
    local_port?: number | undefined;
}, {
    duration_seconds?: number | undefined;
    pid?: number | undefined;
    mode?: "connections" | "lifecycle" | undefined;
    port?: number | undefined;
    local_port?: number | undefined;
}>;
export type TcpTraceInput = z.infer<typeof TcpTraceInputSchema>;
export type TcpTraceRawInput = z.input<typeof TcpTraceInputSchema>;
export interface TcpTraceData {
    method: 'bcc_tcplife' | 'bcc_tcpconnect';
    duration_seconds: number;
    mode: 'connections' | 'lifecycle';
    connections: Array<{
        pid: number;
        comm: string;
        local_addr: string;
        local_port: number;
        remote_addr: string;
        remote_port: number;
        tx_kb?: number;
        rx_kb?: number;
        duration_ms?: number;
        latency_us?: number;
    }>;
    summary: {
        total_connections: number;
        total_tx_kb?: number;
        total_rx_kb?: number;
        avg_duration_ms?: number;
        avg_latency_us?: number;
        by_port: Array<{
            port: number;
            count: number;
        }>;
        by_comm: Array<{
            comm: string;
            count: number;
        }>;
    };
    top_connections: Array<{
        pid: number;
        comm: string;
        remote_addr: string;
        remote_port: number;
        metric: number;
        metric_type: 'duration_ms' | 'traffic_kb' | 'latency_us';
    }>;
    notes: string[];
}
export declare function perfTcpTrace(input?: TcpTraceRawInput): Promise<PerfResponse<TcpTraceData>>;
//# sourceMappingURL=tcp-trace.d.ts.map