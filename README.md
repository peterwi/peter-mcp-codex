# peter-mcp-codex

Unified monorepo for infrastructure tools, MCP servers, and reference skills.

## Quick Overview

A collection of modular tools following Unix philosophy: each does one thing well and composes with others. Includes CLI tools, MCP servers for LLM integration, and reference skills.

## Structure

```text
perf-mcp/                 # Linux performance troubleshooting MCP server (TypeScript)
cisco-mcp/                # Cisco NX-OS switch management (Python)
tool-sample/              # Template for creating new Python tools
mcp-base/                 # Shared Python MCP server base
genAI/skills/             # Reference skill documentation
setup.sh / reset.sh       # Tool installation and cleanup
mcp_config.toml           # MCP services configuration
```

## Prerequisites

### Core

- bash + common Unix tools (`awk`, `sed`, `grep`)
- Python 3.10+ with [uv](https://docs.astral.sh/uv/) (provides `uvx`)
- Node.js 20+ (provides `node`, `npm`, `npx`)

### Service-specific notes

- `perf` (perf-mcp): requires a Linux host (kernel 4.18+ recommended) and extra tooling for profiling/eBPF
  (e.g. `perf`, `sysstat`, `bcc-tools`, `bpftrace`). Also requires `perf-mcp` to be built (`cd perf-mcp && npm install && npm run build`).
- `cisco` (cisco-mcp): requires Python 3.11+, SSH client, a key at `~/.ssh/cisco-key`, and network access to your switch mgmt subnet.
- `playwright`: requires Playwright browser installs (commonly `npx playwright install` plus OS deps on Linux).
- `kubernetes`: requires access to a cluster via `KUBECONFIG` / kube-context (and whatever auth your cluster uses).

## Setup

```bash
# Install all Python tools
./setup.sh --all

# Install tools only
./setup.sh --tools-only

# List available MCP services
./setup.sh --list-services

# Show help
./setup.sh --help
```

## Available Tools

### MCP Servers

- **perf-mcp** - Linux performance troubleshooting using USE method (Utilisation, Saturation, Errors). 21 tools covering CPU profiling, I/O latency, network health, eBPF tracing, and incident triage.
- **cisco-mcp** - Cisco NX-OS switch management via SSH (VXLAN/EVPN fabric).

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
- `skill-creator/` - Skill authoring guide
- `skill-evolver/` - Skill evolution through genetic algorithms
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

### Configured MCP services

- `sequential_thinking` - Sequential thinking MCP server
- `memory` - Memory MCP server
- `playwright` - Playwright MCP server
- `pyscn` - Python Code Quality Analyser
- `kubernetes` - Kubernetes cluster management MCP server
- `cisco` - Cisco NX-OS switch management MCP server
- `perf` - Linux performance troubleshooting MCP server (USE method)

### Skills available (genAI/skills/)

Each skill is a set of local instructions stored in `genAI/skills/*/SKILL.md`:

- `coupling-evaluation`
- `mcp-builder`
- `skill-creator`
- `skill-evolver`
- `superpowers`
- `technical-report-writing`
- `technical-system-research`
- `tool-development`
- `uv-docker-packaging`

## Development

- Apply KISS/DRY principles
- Comments explain *why*, not *what*
- Python: black (100 chars), ruff, mypy, pytest
- TypeScript: biome, vitest, strict tsc
- Always use `uv` for Python package management

## Licence

MIT
