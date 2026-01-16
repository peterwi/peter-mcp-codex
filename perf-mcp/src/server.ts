/**
 * perf-mcp MCP Server
 * Provides Linux performance troubleshooting tools via MCP protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';

import { detectCapabilities } from './lib/detect.js';
import { TOOL_VERSION } from './lib/constants.js';
import {
  toolSchemas,
  perfSnapshotInputSchema,
  perfCpuProfileInputSchema,
  perfIoLatencyInputSchema,
  perfNetHealthInputSchema,
  perfCgroupSummaryInputSchema,
} from './lib/schemas.js';

import {
  perfInfo,
  perfSnapshot,
  perfUseCheck,
  perfCpuProfile,
  perfIoLatency,
  perfNetHealth,
  perfCgroupSummary,
  perfOffcpuProfile,
  OffcpuProfileInputSchema,
  perfBioLatency,
  BioLatencyInputSchema,
  perfTcpTrace,
  TcpTraceInputSchema,
  perfRunqLatency,
  RunqLatencyInputSchema,
  perfSyscallCount,
  SyscallCountInputSchema,
  perfExecTrace,
  ExecTraceInputSchema,
  perfFileTrace,
  FileTraceInputSchema,
  perfDnsLatency,
  DnsLatencyInputSchema,
  perfThreadProfile,
  ThreadProfileInputSchema,
  perfIoLayers,
  IoLayersInputSchema,
  perfFdTrace,
  FdTraceInputSchema,
  perfVfsLatency,
  VfsLatencyInputSchema,
  perfTriage,
  TriageInputSchema,
} from './tools/index.js';

// Tool definitions for MCP
const TOOLS: Tool[] = [
  {
    name: 'perf_info',
    description: toolSchemas.perf_info.description,
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'perf_snapshot',
    description: toolSchemas.perf_snapshot.description,
    inputSchema: {
      type: 'object',
      properties: {
        include_per_cpu: {
          type: 'boolean',
          description: 'Include per-CPU breakdown',
        },
        include_per_device: {
          type: 'boolean',
          description: 'Include per-device I/O stats',
        },
        include_psi: {
          type: 'boolean',
          description: 'Include PSI metrics (if available)',
        },
        interval_sec: {
          type: 'number',
          description: 'Interval between samples in seconds (1-60). If set, enables interval mode.',
        },
        count: {
          type: 'number',
          description: 'Number of samples to collect in interval mode (2-60, default: 5)',
        },
      },
    },
  },
  {
    name: 'perf_use_check',
    description: toolSchemas.perf_use_check.description,
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'perf_cpu_profile',
    description: toolSchemas.perf_cpu_profile.description,
    inputSchema: {
      type: 'object',
      properties: {
        duration_seconds: {
          type: 'number',
          description: 'Duration in seconds (1-60)',
        },
        sample_rate_hz: {
          type: 'number',
          description: 'Sample rate in Hz (1-999)',
        },
        pid: {
          type: 'number',
          description: 'Profile specific process',
        },
        include_kernel: {
          type: 'boolean',
          description: 'Include kernel functions',
        },
        output_format: {
          type: 'string',
          enum: ['summary', 'collapsed'],
          description: 'Output format',
        },
      },
    },
  },
  {
    name: 'perf_io_latency',
    description: toolSchemas.perf_io_latency.description,
    inputSchema: {
      type: 'object',
      properties: {
        duration_seconds: {
          type: 'number',
          description: 'Duration in seconds (1-30)',
        },
        device: {
          type: 'string',
          description: 'Filter by device name (e.g., sda)',
        },
        mode: {
          type: 'string',
          enum: ['snapshot', 'trace'],
          description: 'snapshot for iostat, trace for perf tracing',
        },
      },
    },
  },
  {
    name: 'perf_net_health',
    description: toolSchemas.perf_net_health.description,
    inputSchema: {
      type: 'object',
      properties: {
        interface: {
          type: 'string',
          description: 'Filter by interface name',
        },
        include_tcp_details: {
          type: 'boolean',
          description: 'Include detailed TCP statistics',
        },
      },
    },
  },
  {
    name: 'perf_cgroup_summary',
    description: toolSchemas.perf_cgroup_summary.description,
    inputSchema: {
      type: 'object',
      properties: {
        pid: {
          type: 'number',
          description: 'Find cgroup for this PID',
        },
        cgroup_path: {
          type: 'string',
          description: 'Cgroup path (e.g., /sys/fs/cgroup/system.slice/myservice)',
        },
      },
    },
  },
  // eBPF-based tools (require root + BCC tools)
  {
    name: 'perf_offcpu_profile',
    description: toolSchemas.perf_offcpu_profile.description,
    inputSchema: {
      type: 'object',
      properties: {
        duration_seconds: {
          type: 'number',
          description: 'Duration in seconds (1-60)',
        },
        pid: {
          type: 'number',
          description: 'Profile specific process',
        },
        min_block_us: {
          type: 'number',
          description: 'Minimum block time to record (microseconds)',
        },
      },
    },
  },
  {
    name: 'perf_bio_latency',
    description: toolSchemas.perf_bio_latency.description,
    inputSchema: {
      type: 'object',
      properties: {
        duration_seconds: {
          type: 'number',
          description: 'Duration in seconds (1-30)',
        },
        device: {
          type: 'string',
          description: 'Filter by device name (e.g., sda, nvme0n1)',
        },
        per_device: {
          type: 'boolean',
          description: 'Show histogram per device',
        },
        queued: {
          type: 'boolean',
          description: 'Include OS queued time in latency',
        },
        milliseconds: {
          type: 'boolean',
          description: 'Show in milliseconds (default: microseconds)',
        },
        histogram_type: {
          type: 'string',
          enum: ['log2', 'linear'],
          description: 'Histogram type: log2 (power-of-2 buckets) or linear (fixed-size buckets)',
        },
        linear_bucket_ms: {
          type: 'number',
          description: 'Bucket size in milliseconds for linear histograms (1-100, default: 10)',
        },
      },
    },
  },
  {
    name: 'perf_tcp_trace',
    description: toolSchemas.perf_tcp_trace.description,
    inputSchema: {
      type: 'object',
      properties: {
        duration_seconds: {
          type: 'number',
          description: 'Duration in seconds (1-60)',
        },
        pid: {
          type: 'number',
          description: 'Filter by process ID',
        },
        local_port: {
          type: 'number',
          description: 'Filter by local port',
        },
        remote_port: {
          type: 'number',
          description: 'Filter by remote port',
        },
        mode: {
          type: 'string',
          enum: ['lifecycle', 'connections'],
          description: 'lifecycle for full connection tracking, connections for new only',
        },
      },
    },
  },
  {
    name: 'perf_runq_latency',
    description: toolSchemas.perf_runq_latency.description,
    inputSchema: {
      type: 'object',
      properties: {
        duration_seconds: {
          type: 'number',
          description: 'Duration in seconds (1-30)',
        },
        pid: {
          type: 'number',
          description: 'Filter by process ID',
        },
        per_process: {
          type: 'boolean',
          description: 'Show histogram per process',
        },
        per_pidns: {
          type: 'boolean',
          description: 'Show histogram per PID namespace (container)',
        },
        milliseconds: {
          type: 'boolean',
          description: 'Show in milliseconds (default: microseconds)',
        },
      },
    },
  },
  {
    name: 'perf_syscall_count',
    description: toolSchemas.perf_syscall_count.description,
    inputSchema: {
      type: 'object',
      properties: {
        duration_seconds: {
          type: 'number',
          description: 'Duration in seconds (1-60)',
        },
        pid: {
          type: 'number',
          description: 'Filter by process ID',
        },
        comm: {
          type: 'string',
          description: 'Filter by process command name',
        },
        top_n: {
          type: 'number',
          description: 'Number of top syscalls to return (1-50)',
        },
        include_latency: {
          type: 'boolean',
          description: 'Include syscall latency distribution',
        },
        per_process: {
          type: 'boolean',
          description: 'Show syscall counts per process',
        },
        include_errors: {
          type: 'boolean',
          description: 'Count only failed syscalls',
        },
      },
    },
  },
  {
    name: 'perf_exec_trace',
    description: toolSchemas.perf_exec_trace.description,
    inputSchema: {
      type: 'object',
      properties: {
        duration_seconds: {
          type: 'number',
          description: 'Duration in seconds (1-60)',
        },
        pid: {
          type: 'number',
          description: 'Filter by parent process ID',
        },
        name_pattern: {
          type: 'string',
          description: 'Filter by command name (substring match)',
        },
        uid: {
          type: 'number',
          description: 'Filter by user ID',
        },
        include_failed: {
          type: 'boolean',
          description: 'Only show failed exec calls',
        },
        max_args: {
          type: 'number',
          description: 'Maximum number of arguments to capture',
        },
        include_timestamps: {
          type: 'boolean',
          description: 'Include timestamps in output',
        },
        include_fork_clone: {
          type: 'boolean',
          description: 'Include fork/clone events (process creation) - default true',
        },
        include_exec: {
          type: 'boolean',
          description: 'Include exec events - default true',
        },
        include_exit: {
          type: 'boolean',
          description: 'Include process exit events - default false',
        },
        mode: {
          type: 'string',
          enum: ['events', 'tree', 'both'],
          description: 'Output mode: events (list), tree (hierarchy), or both',
        },
      },
    },
  },
  {
    name: 'perf_file_trace',
    description: toolSchemas.perf_file_trace.description,
    inputSchema: {
      type: 'object',
      properties: {
        duration_seconds: {
          type: 'number',
          description: 'Duration in seconds (1-30)',
        },
        pid: {
          type: 'number',
          description: 'Filter by process ID',
        },
        min_latency_ms: {
          type: 'number',
          description: 'Minimum latency threshold in ms for slow operations',
        },
        mode: {
          type: 'string',
          enum: ['slow_ops', 'file_lifecycle', 'opens', 'all'],
          description: 'Trace mode: slow_ops, file_lifecycle, opens, or all',
        },
        include_all_files: {
          type: 'boolean',
          description: 'Include all file types (not just regular files)',
        },
      },
    },
  },
  {
    name: 'perf_dns_latency',
    description: toolSchemas.perf_dns_latency.description,
    inputSchema: {
      type: 'object',
      properties: {
        duration_seconds: {
          type: 'number',
          description: 'Duration in seconds (1-30)',
        },
        pid: {
          type: 'number',
          description: 'Filter by process ID',
        },
      },
    },
  },
  {
    name: 'perf_thread_profile',
    description: toolSchemas.perf_thread_profile.description,
    inputSchema: {
      type: 'object',
      properties: {
        pid: {
          type: 'number',
          description: 'Process ID to analyze (required)',
        },
        duration_seconds: {
          type: 'number',
          description: 'Duration in seconds (1-30)',
        },
        include_offcpu: {
          type: 'boolean',
          description: 'Include off-CPU time analysis (requires BCC)',
        },
      },
      required: ['pid'],
    },
  },
  {
    name: 'perf_io_layers',
    description: toolSchemas.perf_io_layers.description,
    inputSchema: {
      type: 'object',
      properties: {
        duration_seconds: {
          type: 'number',
          description: 'Duration in seconds (1-30)',
        },
        include_details: {
          type: 'boolean',
          description: 'Include per-operation breakdown',
        },
      },
    },
  },
  {
    name: 'perf_fd_trace',
    description: toolSchemas.perf_fd_trace.description,
    inputSchema: {
      type: 'object',
      properties: {
        pid: {
          type: 'number',
          description: 'Process ID to analyze (required)',
        },
        duration_seconds: {
          type: 'number',
          description: 'Duration for leak detection (1-60 seconds)',
        },
        interval_sec: {
          type: 'number',
          description: 'Sampling interval in seconds (1-10)',
        },
        include_fd_list: {
          type: 'boolean',
          description: 'Include list of open FDs',
        },
        max_fds_listed: {
          type: 'number',
          description: 'Maximum number of FDs to list (10-1000)',
        },
      },
      required: ['pid'],
    },
  },
  {
    name: 'perf_vfs_latency',
    description: toolSchemas.perf_vfs_latency.description,
    inputSchema: {
      type: 'object',
      properties: {
        duration_seconds: {
          type: 'number',
          description: 'Duration in seconds (1-30)',
        },
        min_latency_ms: {
          type: 'number',
          description: 'Minimum latency threshold in ms to report (0-10000, default: 10)',
        },
        pid: {
          type: 'number',
          description: 'Filter to specific process ID',
        },
        include_all_files: {
          type: 'boolean',
          description: 'Include non-regular files (sockets, FIFOs)',
        },
      },
    },
  },
  {
    name: 'perf_triage',
    description: toolSchemas.perf_triage.description,
    inputSchema: {
      type: 'object',
      properties: {
        pid: {
          type: 'number',
          description: 'Target process ID',
        },
        process_name: {
          type: 'string',
          description: 'Target process name (if PID not specified)',
        },
        mode: {
          type: 'string',
          enum: ['quick', 'standard', 'deep'],
          description: 'Triage depth: quick (5s), standard (10s), deep (30s)',
        },
        include_exec_trace: {
          type: 'boolean',
          description: 'Include process execution tracing (adds overhead)',
        },
        focus: {
          type: 'string',
          enum: ['auto', 'cpu', 'memory', 'io', 'network'],
          description: 'Focus area for analysis',
        },
      },
    },
  },
];

/**
 * Create and configure the MCP server
 */
export function createServer(): Server {
  const server = new Server(
    {
      name: 'perf-mcp',
      version: TOOL_VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result;

      switch (name) {
        case 'perf_info':
          result = await perfInfo();
          break;

        case 'perf_snapshot': {
          const validated = perfSnapshotInputSchema.parse(args ?? {});
          result = await perfSnapshot(validated);
          break;
        }

        case 'perf_use_check':
          result = await perfUseCheck();
          break;

        case 'perf_cpu_profile': {
          const validated = perfCpuProfileInputSchema.parse(args ?? {});
          result = await perfCpuProfile(validated);
          break;
        }

        case 'perf_io_latency': {
          const validated = perfIoLatencyInputSchema.parse(args ?? {});
          result = await perfIoLatency(validated);
          break;
        }

        case 'perf_net_health': {
          const validated = perfNetHealthInputSchema.parse(args ?? {});
          result = await perfNetHealth(validated);
          break;
        }

        case 'perf_cgroup_summary': {
          const validated = perfCgroupSummaryInputSchema.parse(args ?? {});
          result = await perfCgroupSummary(validated);
          break;
        }

        // eBPF-based tools
        case 'perf_offcpu_profile': {
          const validated = OffcpuProfileInputSchema.parse(args ?? {});
          result = await perfOffcpuProfile(validated);
          break;
        }

        case 'perf_bio_latency': {
          const validated = BioLatencyInputSchema.parse(args ?? {});
          result = await perfBioLatency(validated);
          break;
        }

        case 'perf_tcp_trace': {
          const validated = TcpTraceInputSchema.parse(args ?? {});
          result = await perfTcpTrace(validated);
          break;
        }

        case 'perf_runq_latency': {
          const validated = RunqLatencyInputSchema.parse(args ?? {});
          result = await perfRunqLatency(validated);
          break;
        }

        case 'perf_syscall_count': {
          const validated = SyscallCountInputSchema.parse(args ?? {});
          result = await perfSyscallCount(validated);
          break;
        }

        case 'perf_exec_trace': {
          const validated = ExecTraceInputSchema.parse(args ?? {});
          result = await perfExecTrace(validated);
          break;
        }

        case 'perf_file_trace': {
          const validated = FileTraceInputSchema.parse(args ?? {});
          result = await perfFileTrace(validated);
          break;
        }

        case 'perf_dns_latency': {
          const validated = DnsLatencyInputSchema.parse(args ?? {});
          result = await perfDnsLatency(validated);
          break;
        }

        case 'perf_thread_profile': {
          const validated = ThreadProfileInputSchema.parse(args ?? {});
          result = await perfThreadProfile(validated);
          break;
        }

        case 'perf_io_layers': {
          const validated = IoLayersInputSchema.parse(args ?? {});
          result = await perfIoLayers(validated);
          break;
        }

        case 'perf_fd_trace': {
          const validated = FdTraceInputSchema.parse(args ?? {});
          result = await perfFdTrace(validated);
          break;
        }

        case 'perf_vfs_latency': {
          const validated = VfsLatencyInputSchema.parse(args ?? {});
          result = await perfVfsLatency(validated);
          break;
        }

        case 'perf_triage': {
          const validated = TriageInputSchema.parse(args ?? {});
          result = await perfTriage(validated);
          break;
        }

        default:
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: {
                    code: 'UNKNOWN_TOOL',
                    message: `Unknown tool: ${name}`,
                  },
                }),
              },
            ],
            isError: true,
          };
      }

      // Return result as structured content
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
        isError: !result.success,
      };
    } catch (err) {
      const error = err as Error;
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              tool: name,
              tool_version: TOOL_VERSION,
              timestamp: new Date().toISOString(),
              error: {
                code: 'VALIDATION_ERROR',
                message: error.message,
                recoverable: true,
              },
            }),
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

/**
 * Run the server with stdio transport
 */
export async function runServer(): Promise<void> {
  // Pre-detect capabilities
  await detectCapabilities();

  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await server.close();
    process.exit(0);
  });
}
