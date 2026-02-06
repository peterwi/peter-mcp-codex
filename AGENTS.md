# AGENTS.md

Instructions for OpenAI Codex when working with this repository.

## Repository Overview

Unified monorepo for infrastructure tools, MCP servers, benchmarking suites, and reference skills. Tools follow Unix philosophy: do one thing well, compose with others.

## Project Structure

```
peter-mcp-codex/
├── perf-mcp/                  # Linux performance troubleshooting MCP server (TypeScript)
├── cisco-mcp/                 # Cisco NX-OS switch management (Python)
├── tool-sample/               # Template for creating new Python tools
├── mcp-base/                  # Shared Python MCP server base
├── fio-plot/                  # Fio benchmark plotting and analysis suite
├── fio-server-scale/          # Multi-client fio scale testing framework
├── elbencho-tig/              # Elbencho + Telegraf/InfluxDB/Grafana benchmarking
├── genAI/                     # Reference skills documentation
│   └── skills/                # Reusable task skill definitions
├── images/                    # Project images
├── setup.sh                   # Tool installation script
├── reset.sh                   # Cleanup script
└── mcp_config.toml            # MCP services configuration
```

## Common Development Commands

### Setup

```bash
./setup.sh --all               # Install all Python tools
./setup.sh --tools-only        # Install UV tools only
./setup.sh --list-services     # List MCP services from config
./setup.sh --help              # Show help
```

### Testing

```bash
# Python tools (pytest)
cd tool-sample && python -m pytest tests/ -v
cd cisco-mcp && python -m pytest tests/ -v

# TypeScript (vitest)
cd perf-mcp && npm run test

# With coverage
python -m pytest tests/ --cov=my_tool --cov-report=term-missing
cd perf-mcp && npm run test:coverage
```

### Building

```bash
# Python tools
cd tool-sample && uv pip install -e .
cd tool-sample && uv build

# TypeScript
cd perf-mcp && npm install && npm run build
```

## Architecture Patterns

### Python Tool Structure (tool-sample template)

```
tool-name/
├── tool_name/              # Core package (underscore naming)
│   ├── __init__.py
│   ├── cli.py             # Click-based CLI interface
│   ├── constants.py       # Configuration constants
│   └── exceptions.py      # Custom exception hierarchy
├── tool_name_mcp/         # MCP server package (optional)
│   ├── __init__.py
│   ├── server.py          # MCP server entry point
│   └── tools.py           # Tool definitions
├── tests/                 # pytest test suite
├── pyproject.toml         # uv/hatch configuration
└── README.md
```

### TypeScript MCP Server (perf-mcp)

```
perf-mcp/
├── src/
│   ├── index.ts           # Entry point
│   ├── server.ts          # MCP server (createServer + runServer)
│   ├── tools/             # 21 tool implementations (one per file)
│   ├── parse/             # Parsers (procfs, bcc, iostat, perf, cgroup, ss)
│   └── lib/               # Shared utilities (exec, schemas, detect, constants)
├── tests/                 # vitest (unit + integration)
├── evals/                 # Evaluation questions (XML)
├── docs/                  # Design docs, tool reference, workflows
├── dist/                  # Compiled output
└── package.json           # Node.js >=20, @modelcontextprotocol/sdk + zod
```

### Benchmarking Suites

- **fio-plot/**: Fio benchmark execution, result parsing, and plotting. Contains `fio-run/` (test execution), `fio-plot/` (graphing library), `fio-report/` (report generation), comparison scripts for bandwidth/IOPS/latency.
- **fio-server-scale/**: Multi-client fio scale testing with `run-scale-tests.sh`, graph generation via `generate-graphs.sh`, monitoring integration.
- **elbencho-tig/**: Elbencho distributed benchmarks with Telegraf+InfluxDB+Grafana monitoring stack. Includes `run-tests.sh`, config templates, and graph generation.

### Shared Library (mcp-base)

Python MCP server factory: `create_server(name, tools, execute_func)` returns `(app, main)`.

## Package Naming Conventions

- Package directory: `tool_name` (underscore)
- Import: `from tool_name import ...`
- CLI command: `tool-name` (hyphen)
- MCP command: `tool-name-mcp-server`

## Code Quality

### Python

- Python 3.10+ features
- Type hints on public APIs
- **black** (100 char line length), **ruff** (linting), **mypy** (type checking)
- **pytest** for testing

### TypeScript

- Node.js 20+
- **biome** for linting and formatting
- **vitest** for testing
- Strict TypeScript (`tsc --noEmit` for type checking)

### General Principles

- KISS/DRY - keep functions and modules concise
- Comments explain *why*, not *what*
- Interfaces should be simple yet deep
- Single-responsibility modules

## Key Tools Detail

### perf-mcp (21 tools)

Linux performance MCP server using USE method (Utilisation, Saturation, Errors):

| Category | Tools |
|----------|-------|
| System | `perf_info`, `perf_snapshot`, `perf_use_check`, `perf_triage` |
| CPU | `perf_cpu_profile`, `perf_thread_profile` |
| I/O | `perf_io_latency`, `perf_io_layers`, `perf_vfs_latency`, `perf_fd_trace`, `perf_file_trace`, `perf_bio_latency` |
| Network | `perf_net_health`, `perf_tcp_trace`, `perf_dns_latency` |
| Scheduler | `perf_offcpu_profile`, `perf_runq_latency` |
| Process | `perf_exec_trace`, `perf_cgroup_summary`, `perf_syscall_count` |

### cisco-mcp

Cisco NX-OS switch management via SSH. Python/Click CLI with MCP server wrapper.

### Reference Skills (genAI/skills/)

Documentation-only reference materials:

- `mcp-builder/` - Guide for creating MCP servers (Python/TypeScript)
- `tool-development/` - Tool building patterns
- `coupling-evaluation/` - Code coupling analysis (Balanced Coupling model)
- `technical-system-research/` - Technical system investigation methodology
- `technical-report-writing/` - Structured technical reports
- `uv-docker-packaging/` - UV-based Docker containerisation
- `skill-creator/` - Skill authoring guide
- `skill-evolver/` - Skill evolution through genetic algorithms
- `superpowers/` - Full development workflow skill

## Error Handling

Use custom exceptions from `exceptions.py`:

```python
from tool_name.exceptions import MyToolError

try:
    results = do_something()
except MyToolError as e:
    click.echo(f"Error: {e}", err=True)
```

## Cache Location

Caches use `/tmp/tool-name-cache/` for consistency. Avoid user home, CWD, or repo directory.

## MCP Tool Definitions

Python tools use MCP `Tool` objects (not dicts):

```python
from mcp.types import Tool
tools = [Tool(name="search", description="...", inputSchema={...})]
```

TypeScript tools use the SDK `Tool` type with Zod schemas for validation.
