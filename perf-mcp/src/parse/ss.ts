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
export function parseSsSummary(output: string): SocketSummary {
  const result: SocketSummary = {
    tcp_total: 0,
    tcp_established: 0,
    tcp_time_wait: 0,
    tcp_close_wait: 0,
    tcp_listen: 0,
    udp_total: 0,
    raw_total: 0,
  };

  for (const line of output.split('\n')) {
    const trimmed = line.trim();

    // TCP line: "TCP:   123 (estab 89, closed 12, orphaned 0, timewait 10)"
    if (trimmed.startsWith('TCP:')) {
      const tcpMatch = trimmed.match(/TCP:\s+(\d+)/);
      if (tcpMatch) {
        result.tcp_total = parseInt(tcpMatch[1], 10);
      }

      const estabMatch = trimmed.match(/estab\s+(\d+)/);
      if (estabMatch) {
        result.tcp_established = parseInt(estabMatch[1], 10);
      }

      const twMatch = trimmed.match(/timewait\s+(\d+)/i);
      if (twMatch) {
        result.tcp_time_wait = parseInt(twMatch[1], 10);
      }
    }

    // UDP line
    if (trimmed.startsWith('UDP:')) {
      const udpMatch = trimmed.match(/UDP:\s+(\d+)/);
      if (udpMatch) {
        result.udp_total = parseInt(udpMatch[1], 10);
      }
    }

    // RAW line
    if (trimmed.startsWith('RAW:')) {
      const rawMatch = trimmed.match(/RAW:\s+(\d+)/);
      if (rawMatch) {
        result.raw_total = parseInt(rawMatch[1], 10);
      }
    }
  }

  return result;
}

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
export function parseSsConnections(output: string): TcpConnection[] {
  const connections: TcpConnection[] = [];
  const lines = output.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip header line
    if (trimmed.startsWith('State') || trimmed.startsWith('Netid') || !trimmed) {
      continue;
    }

    // Parse connection line
    // Format varies: "ESTAB 0 0 addr:port addr:port"
    const parts = trimmed.split(/\s+/);
    if (parts.length < 5) continue;

    const state = parts[0];
    const recvQ = parseInt(parts[1], 10) || 0;
    const sendQ = parseInt(parts[2], 10) || 0;

    // Parse local address:port
    const localFull = parts[3];
    const localMatch = localFull.match(/(.+):(\d+)$/);
    const localAddr = localMatch?.[1] ?? localFull;
    const localPort = parseInt(localMatch?.[2] ?? '0', 10);

    // Parse peer address:port
    const peerFull = parts[4];
    const peerMatch = peerFull.match(/(.+):(\d+)$/);
    const peerAddr = peerMatch?.[1] ?? peerFull;
    const peerPort = parseInt(peerMatch?.[2] ?? '0', 10);

    // Extract process info if available
    let process: string | undefined;
    const processMatch = trimmed.match(/users:\(\("([^"]+)"/);
    if (processMatch) {
      process = processMatch[1];
    }

    connections.push({
      state,
      recvQ,
      sendQ,
      localAddr,
      localPort,
      peerAddr,
      peerPort,
      process,
    });
  }

  return connections;
}

/**
 * Count connections by state
 */
export function countConnectionsByState(connections: TcpConnection[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const conn of connections) {
    counts[conn.state] = (counts[conn.state] ?? 0) + 1;
  }

  return counts;
}
