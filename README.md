# tools-and-skills

Unified setup for UV tools, MCP services, agents, and skills with **AWS Bedrock** support.

## Quick Overview

**What is it?**

A centralized monorepo containing infrastructure tools, MCP servers, and AI agent extensions built with Python UV. Designed to work with Claude Code via AWS Bedrock.

## Prerequisites (Bedrock)

This setup requires AWS Bedrock for Claude Code. The setup script will check and help install these:

### 1. AWS CLI v2

```bash
# Check if installed
aws --version

# If not installed, setup.sh will offer to install it
# Or install manually:
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

### 2. AWS Credentials

Configure your AWS credentials:

```bash
aws configure
# Enter your AWS Access Key ID, Secret Access Key, and region
```

Or ensure `~/.aws/credentials` exists with valid credentials.

### 3. Environment Variables

Add to your `~/.bashrc` or `~/.zshrc`:

```bash
export CLAUDE_CODE_USE_BEDROCK=1
export ANTHROPIC_MODEL='us.anthropic.claude-opus-4-5-20251101-v1:0'
```

**Available Bedrock Models:**
- `us.anthropic.claude-opus-4-5-20251101-v1:0` - Opus 4.5 (most capable)
- `us.anthropic.claude-sonnet-4-20250514-v1:0` - Sonnet 4
- `anthropic.claude-3-5-sonnet-20241022-v2:0` - Sonnet 3.5 v2

Then reload your shell:

```bash
source ~/.bashrc  # or source ~/.zshrc
```

### 4. Verify Setup

```bash
./setup.sh --check-prereqs
```

### Core Philosophy

- Build modular tools that do one thing well
- Bundle with MCP servers for Claude/Qwen integration
- Centrally maintain agents, skills, and commands
- Deploy consistently via `setup.sh`/`reset.sh`

### Structure

```text
vast-mcp/                 # VAST Admin MCP server (primary)
cisco-mcp/                # Cisco NX-OS switch management MCP server
perf-mcp/                 # Linux performance troubleshooting MCP server
tool-sample/              # Template for creating new tools
mcp-base/                 # Shared MCP server base
genAI/
├─ agents/               # Claude agent definitions
├─ skills/               # Reusable task skills
└─ commands/             # Slash commands
setup.sh / reset.sh      # Deploy tools + MCP servers
```

### Workflow

1. **Build**: Create Python tool with CLI using `tool-sample/` as template
2. **Add MCP**: Create MCP server wrapper following the sample pattern
3. **Register**: Add to `mcp_config.toml`
4. **Deploy**: Run `./setup.sh --all` - tools installed globally, MCP configured

### What You Get

- All tools available in terminal
- MCP servers auto-registered for Claude/Qwen
- Central place to manage agents & skills
- Consistent patterns across all tools

## Setup

Run from any directory:

```bash
./setup.sh [OPTIONS]
```

Creates `.claude/`, `.qwen/`, `.serena/` and `.mcp.json` in current directory. Appends to `.gitignore`.

The `.mcp.json` file contains project-local MCP server configuration that Claude Code will auto-detect. Environment variables are inherited from your shell (loaded from `.env` if present).

### Setup Options

```text
--all (default)   Install tools, setup MCP services, copy config (includes prereq check)
--check-prereqs   Check Bedrock prerequisites only
--tools-only      Install UV tools only
--mcp-only        Setup MCP services only
--claude-only     Copy agents/skills/commands only
--list-services   List available MCP services
--configure       Interactive MCP service configuration (enable/disable services)
--help            Show help
```

### Customizing the Install

All MCP services are configured in `mcp_config.toml`. To customize:

**Enable/disable services:**

```toml
[services.kubernetes]
enabled = true   # change to false to disable
```

**Add a new MCP server:**

```toml
[services.my_service]
description = "My custom MCP server"
command = "npx -y my-mcp-server@latest"
env_vars = []                    # e.g., ["API_KEY", "SECRET"]
clients = ["claude", "qwen"]
enabled = true
```

**Common MCP server patterns:**

```toml
# NPX-based (npm packages)
command = "npx -y package-name@latest"

# UVX-based (Python packages)
command = "uvx package-name"

# Local venv binary
command = "/path/to/venv/bin/server-command"

# With arguments
command = "npx -y server@latest --option value"
```

After editing, regenerate config:

```bash
./setup.sh --mcp-only
```

## Reset

Clean up configuration files:

```bash
./reset.sh [OPTIONS]
```

### Reset Options

```text
--global      Also remove global configs from ~/.claude and ~/.config
--dry-run     Show what would be deleted without actually deleting
--help        Show help
```

Removes `.claude/`, `.serena/`, `.qwen/`, and `.mcp.json` from current directory. Use `--global` to also clean `~/.claude/` and `~/.qwen/`.

## Creating New Tools

Use `tool-sample/` as a template for creating new CLI tools with MCP integration.

```bash
# Copy template
cp -r tool-sample my-new-tool

# Rename packages
mv my-new-tool/my_tool my-new-tool/your_tool
mv my-new-tool/my_tool_mcp my-new-tool/your_tool_mcp

# Update pyproject.toml and implement your logic
# See tool-sample/README.md for detailed guide
```

The template includes:
- Click-based CLI with example commands
- MCP server integration
- Test suite with pytest
- Standard project structure

## Available Tools

### Primary

- **vast-admin-mcp** - VAST Data storage administration MCP server
- **cisco-mcp** - Cisco NX-OS switch management via SSH
- **perf-mcp** - Linux performance troubleshooting using USE method

### Template

- **tool-sample** - Template for creating new tools (see `tool-sample/README.md`)

## MCP Servers

Your stack includes these core MCP servers:

- **[Serena](https://github.com/oraios/serena)** - IDE copilot for code navigation, refactoring context, and project understanding
- **[Sequential Thinking](https://github.com/modelcontextprotocol/servers/tree/main/src/sequential-thinking)** - Structured step-by-step reasoning for complex problem-solving
- **[Memory](https://github.com/modelcontextprotocol/servers/tree/main/src/memory)** - Persistent, queryable memory across sessions
- **[Playwright](https://github.com/microsoft/playwright-mcp)** - Browser automation for web testing and scraping
- **[PySCN](https://github.com/pyscn/pyscn-mcp)** - Python static analysis and code quality insights
- **[Kubernetes](https://github.com/strowk/mcp-k8s-go)** - Kubernetes cluster management and resource inspection
- **[VAST Admin](vast-mcp/)** - VAST Data storage administration with read-only and read-write modes
- **[Cisco](cisco-mcp/)** - Cisco NX-OS switch management via SSH (VXLAN/EVPN fabric)
- **[Perf](perf-mcp/)** - Linux performance troubleshooting using USE method and observability tools

Together: IDE assistance, reasoning, memory, web automation, Python analysis, Kubernetes management, enterprise storage administration, network switch management, and Linux performance analysis.

## VAST Admin MCP

The primary MCP server for VAST Data storage cluster administration.

### Quick Start

**1. Install**

```bash
pip install vast-admin-mcp
```

**2. Initial Setup**

Configure your VAST cluster connection:

```bash
vast-admin-mcp setup
```

This will prompt you for:
- Cluster address (IP, FQDN, or URL like `https://host:port`)
- Username and password
- Tenant (for tenant admins)
- Tenant context (for super admins - which tenant context to use)

### Examples

**List clusters:**
```bash
vast-admin-mcp clusters list
```

**Get cluster metrics:**
```bash
vast-admin-mcp metrics --cluster my-cluster
```

**Check capacity:**
```bash
vast-admin-mcp capacity --cluster my-cluster
```

**List views:**
```bash
vast-admin-mcp views list --cluster my-cluster
```

See [vast-mcp/README.md](vast-mcp/README.md) for full documentation.

## Building Custom MCP Servers

The **mcp-builder** skill provides a comprehensive guide for creating high-quality MCP servers that enable LLMs to interact with external services. Use this skill when building new MCP servers to integrate APIs or services.

### When to Use This Skill

- Building a new MCP server from scratch
- Integrating an external API (REST, GraphQL, etc.) with Claude
- Creating tools for Claude to interact with your infrastructure
- Improving an existing MCP server's tool design

### Quick Start

**1. Activate the skill in Claude Code:**

```
Load the mcp-builder skill from .claude/skills/mcp-builder/SKILL.md
```

Or reference it directly when asking Claude to build an MCP server:

```
Using the mcp-builder skill, create an MCP server for [your API/service]
```

**2. Choose your language:**

- **TypeScript (recommended)** - Best SDK support, good for remote servers
- **Python (FastMCP)** - Great for local servers, familiar syntax

### Development Phases

The skill guides you through four phases:

#### Phase 1: Research and Planning

- Study the MCP protocol specification
- Review framework documentation (TypeScript SDK or Python SDK)
- Understand your target API's endpoints and authentication
- Plan tool coverage - prioritize comprehensive API coverage

#### Phase 2: Implementation

- Set up project structure following language-specific patterns
- Create shared utilities (API client, error handling, pagination)
- Implement tools with proper schemas (Zod/Pydantic)
- Add tool annotations (`readOnlyHint`, `destructiveHint`, etc.)

#### Phase 3: Review and Test

- Code quality review (DRY, error handling, type coverage)
- Build verification (`npm run build` or `python -m py_compile`)
- Test with MCP Inspector: `npx @modelcontextprotocol/inspector`

#### Phase 4: Create Evaluations

- Generate 10 complex, realistic test questions
- Verify answers are stable and verifiable
- Output as XML for automated testing

### Reference Documentation

The skill includes detailed guides in `genAI/skills/mcp-builder/reference/`:

| File | Description |
|------|-------------|
| `mcp_best_practices.md` | Universal MCP guidelines, naming, response formats |
| `python_mcp_server.md` | Python/FastMCP patterns, Pydantic examples |
| `node_mcp_server.md` | TypeScript patterns, Zod schemas |
| `evaluation.md` | Evaluation creation and testing guide |

### Example: Creating a GitHub MCP Server

```
Using the mcp-builder skill, create an MCP server that integrates with
the GitHub API. I need tools to:
- List repositories for a user/org
- Create and manage issues
- Search code across repositories
- Manage pull requests

Use TypeScript with streamable HTTP transport.
```

Claude will follow the mcp-builder workflow to:
1. Research GitHub API endpoints
2. Design tool schemas with proper types
3. Implement with error handling and pagination
4. Create evaluation questions

### Tool Design Best Practices

From the skill's guidelines:

- **Naming**: Use consistent prefixes (`github_create_issue`, `github_list_repos`)
- **Descriptions**: Concise but complete, include parameter descriptions
- **Error messages**: Actionable with specific suggestions
- **Pagination**: Support for large result sets
- **Output**: Return both text content and structured data

### Integration with This Repo

After building your MCP server:

1. Place it in a new directory at the repo root (e.g., `my-api-mcp/`)
2. Add to `mcp_config.toml`:

```toml
[services.my_api]
description = "My API MCP server"
command = "uvx --from {SCRIPT_DIR}/my-api-mcp my-api-mcp"
env_vars = ["MY_API_KEY"]
clients = ["claude", "qwen"]
enabled = true
```

3. Run `./setup.sh --mcp-only` to regenerate `.mcp.json`

### Evaluation Scripts

The skill includes evaluation tools in `genAI/skills/mcp-builder/scripts/`:

- `evaluation.py` - Run evaluations against your MCP server
- `connections.py` - Connection utilities
- `example_evaluation.xml` - Sample evaluation format

See [genAI/skills/mcp-builder/SKILL.md](genAI/skills/mcp-builder/SKILL.md) for the complete guide.
