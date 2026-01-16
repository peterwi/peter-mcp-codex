#!/usr/bin/env node
/**
 * perf-mcp - MCP server for Linux performance troubleshooting
 *
 * Usage:
 *   npx perf-mcp          # Run as MCP server (stdio)
 *   perf-mcp --help       # Show help
 *   perf-mcp --version    # Show version
 */
import { runServer } from './server.js';
import { TOOL_VERSION } from './lib/constants.js';
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
    console.log(`
perf-mcp v${TOOL_VERSION} - Linux Performance MCP Server

Usage:
  perf-mcp              Start MCP server (stdio transport)
  perf-mcp --help       Show this help message
  perf-mcp --version    Show version

Description:
  A Model Context Protocol (MCP) server for Linux performance troubleshooting.
  Provides tools for system analysis using the USE method (Utilization,
  Saturation, Errors) and standard Linux observability tooling.

Available Tools:
  perf_info           - System information and capability detection
  perf_snapshot       - Point-in-time system metrics (CPU, memory, I/O, network)
  perf_use_check      - USE method analysis with bottleneck detection
  perf_cpu_profile    - On-CPU profiling using perf
  perf_io_latency     - Block I/O latency analysis
  perf_net_health     - Network stack health summary
  perf_cgroup_summary - Cgroup v2 resource usage for containers

Requirements:
  - Linux kernel 4.18+ (5.x/6.x recommended)
  - Node.js 20+
  - Optional: perf tools, sysstat, CAP_PERFMON for profiling

Integration:
  Add to your MCP client configuration:

  {
    "mcpServers": {
      "perf-mcp": {
        "command": "npx",
        "args": ["perf-mcp"]
      }
    }
  }

For more information:
  https://github.com/your-org/perf-mcp
`);
    process.exit(0);
}
if (args.includes('--version') || args.includes('-v')) {
    console.log(TOOL_VERSION);
    process.exit(0);
}
// Start the server
runServer().catch((err) => {
    console.error('Failed to start perf-mcp server:', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map