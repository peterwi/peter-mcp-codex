# peter-mcp-codex

Unified monorepo for infrastructure tools, MCP servers, benchmarking suites, and reference skills.

## Quick Overview

A collection of modular tools following Unix philosophy: each does one thing well and composes with others. Includes CLI tools, MCP servers for LLM integration, and performance benchmarking frameworks.

## Structure

```text
perf-mcp/                 # Linux performance troubleshooting MCP server (TypeScript)
cisco-mcp/                # Cisco NX-OS switch management (Python)
tool-sample/              # Template for creating new Python tools
mcp-base/                 # Shared Python MCP server base
fio-plot/                 # Fio benchmark plotting and analysis suite
fio-server-scale/         # Multi-client fio scale testing framework
elbencho-tig/             # Elbencho + Telegraf/InfluxDB/Grafana benchmarking
genAI/skills/             # Reference skill documentation
setup.sh / reset.sh       # Tool installation and cleanup
mcp_config.toml           # MCP services configuration
```

## Prerequisites

- Python 3.10+ with [uv](https://docs.astral.sh/uv/)
- Node.js 20+ (for perf-mcp)

## Setup

```bash
# Install all Python tools
./setup.sh --all

# Install tools only
./setup.sh --tools-only

# Show help
./setup.sh --help
```

## Available Tools

### MCP Servers

- **perf-mcp** - Linux performance troubleshooting using USE method (Utilisation, Saturation, Errors). 21 tools covering CPU profiling, I/O latency, network health, eBPF tracing, and incident triage.
- **cisco-mcp** - Cisco NX-OS switch management via SSH (VXLAN/EVPN fabric).

### Benchmarking

- **fio-plot** - Fio benchmark execution, result parsing, and plotting. Includes comparison scripts for bandwidth, IOPS, and latency analysis.
- **fio-server-scale** - Multi-client fio scale testing with monitoring integration and graph generation.
- **elbencho-tig** - Elbencho distributed storage benchmarks with Telegraf+InfluxDB+Grafana monitoring stack.

### Templates & Libraries

- **tool-sample** - Template for creating new Python CLI tools with optional MCP server integration. Uses Click for CLI, hatchling for builds, pytest for testing.
- **mcp-base** - Shared Python MCP server factory. Call `create_server(name, tools, execute_func)` to get a ready-to-run server.

### Reference Skills (genAI/skills/)

- `mcp-builder/` - Guide for creating MCP servers (Python/TypeScript)
- `tool-development/` - Tool building patterns
- `coupling-evaluation/` - Code coupling analysis
- `technical-system-research/` - Technical system investigation
- `technical-report-writing/` - Structured technical reports
- `uv-docker-packaging/` - UV-based Docker containerisation
- `superpowers/` - Full development workflow

## Creating New Tools

Use `tool-sample/` as a template:

```bash
cp -r tool-sample my-new-tool
mv my-new-tool/my_tool my-new-tool/your_tool
mv my-new-tool/my_tool_mcp my-new-tool/your_tool_mcp
# Update pyproject.toml and implement your logic
cd my-new-tool && uv tool install -e . --force
```

See `tool-sample/README.md` for the full guide.

## Building perf-mcp

```bash
cd perf-mcp
npm install
npm run build
npm run test
```

## MCP Configuration

All MCP services are defined in `mcp_config.toml`. Use `./setup.sh --list-services` to see what's available, or `./setup.sh --configure` to interactively enable/disable services.

Available services: sequential-thinking, memory, playwright, pyscn, kubernetes, cisco, perf.

## Development

- Apply KISS/DRY principles
- Comments explain *why*, not *what*
- Python: black (100 chars), ruff, mypy, pytest
- TypeScript: biome, vitest, strict tsc
- Always use `uv` for Python package management

## Licence

MIT
