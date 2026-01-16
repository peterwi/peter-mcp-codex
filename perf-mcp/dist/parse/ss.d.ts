/**
 * Parser for ss command output
 */
export interface SocketSummary {
    tcp_total: number;
    tcp_established: number;
    tcp_time_wait: number;
    tcp_close_wait: number;
    tcp_listen: number;
    udp_total: number;
    raw_total: number;
}
/**
 * Parse ss -s output (summary)
 * Example:
 * Total: 234
 * TCP:   123 (estab 89, closed 12, orphaned 0, timewait 10)
 * UDP:   45
 */
export declare function parseSsSummary(output: string): SocketSummary;
export interface TcpConnection {
    state: string;
    recvQ: number;
    sendQ: number;
    localAddr: string;
    localPort: number;
    peerAddr: string;
    peerPort: number;
    process?: string;
}
/**
 * Parse ss -tnap output (TCP connections)
 * Example:
 * State      Recv-Q Send-Q Local Address:Port  Peer Address:Port Process
 * ESTAB      0      0      192.168.1.10:22     192.168.1.20:54321 users:(("sshd",pid=1234,fd=3))
 */
export declare function parseSsConnections(output: string): TcpConnection[];
/**
 * Count connections by state
 */
export declare function countConnectionsByState(connections: TcpConnection[]): Record<string, number>;
//# sourceMappingURL=ss.d.ts.map