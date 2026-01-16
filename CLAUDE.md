# CLAUDE.md

Guidance for Claude Code when working with this repository.

## Repository Overview

Unified monorepo for infrastructure tools, MCP servers, and GenAI components. Tools follow Unix philosophy: do one thing well, compose with others.

## Project Structure

```
tools-and-skills/
├── vast-mcp/                  # VAST Admin MCP server (primary)
├── cisco-mcp/                 # Cisco NX-OS switch management MCP server
├── perf-mcp/                  # Linux performance troubleshooting MCP server
├── tool-sample/               # Template for creating new tools
├── mcp-base/                  # Shared MCP server base
├── genAI/                     # Agents, skills, slash commands
│   ├── agents/               # Claude Code agent definitions
│   ├── commands/             # Slash commands
│   └── skills/               # Context-aware skills
├── setup.sh                   # Unified installation script
└── mcp_config.toml           # MCP services configuration
```

## Common Development Commands

### Setup

```bash
# Install all tools
./setup.sh --all

# Install tools only (skip MCP, agents, skills)
./setup.sh --tools-only

# Install MCP services only (generates .mcp.json)
./setup.sh --mcp-only

# Install agents/skills/commands only
./setup.sh --claude-only

# List available MCP services
./setup.sh --list-services

# Interactive MCP service configuration (enable/disable)
./setup.sh --configure
```

**MCP Configuration:** `setup.sh` generates a project-local `.mcp.json` file that Claude Code auto-detects. Environment variables are inherited from your shell (`.env` loaded automatically if present).

### Reset

Clean up configuration files:

```bash
# Remove local project configs only
./reset.sh

# Remove local AND global configs
./reset.sh --global

# Preview what would be deleted
./reset.sh --dry-run
./reset.sh --global --dry-run
```

Removes `.claude/`, `.serena/`, `.qwen/`, and `.mcp.json` from current directory. Use `--global` to also clean `~/.claude/` and `~/.qwen/` (requires confirmation).

### Testing

Per-tool test commands:

```bash
# Run tests for a specific tool
cd tool-sample && python -m pytest tests/ -v

# Run tests with coverage
python -m pytest tests/ --cov=my_tool --cov-report=html

# Run specific test file
python -m pytest tests/test_cli.py -v
```

### Installation

```bash
# Install tool in development mode
cd tool-sample && uv pip install -e .

# Install tool globally with uv
cd tool-sample && uv tool install -e . --force

# Build wheel
cd tool-sample && uv build
```

## Architecture Patterns

### Package Structure

Standard Python tool structure (see `tool-sample/` for complete example):

```
tool-name/
├── tool_name/              # Core package (underscore naming)
│   ├── __init__.py
│   ├── cli.py             # Click-based CLI interface
│   ├── constants.py       # Configuration constants
│   └── exceptions.py      # Custom exception hierarchy
├── tool_name_mcp/         # MCP server package
│   ├── __init__.py
│   ├── server.py          # MCP server entry point
│   └── tools.py           # Tool definitions
├── tests/                 # pytest test suite
│   ├── conftest.py       # Shared fixtures
│   └── test_cli.py
├── pyproject.toml         # uv/hatch configuration
└── README.md              # Tool documentation
```

### Creating New Tools

Use the `tool-sample/` template:

```bash
# Copy template
cp -r tool-sample my-new-tool

# Rename packages
mv my-new-tool/my_tool my-new-tool/your_tool
mv my-new-tool/my_tool_mcp my-new-tool/your_tool_mcp

# Update pyproject.toml with your tool name
# Implement your logic in cli.py
# Install and test
cd my-new-tool && uv tool install -e . --force
```

See `tool-sample/README.md` for detailed documentation on:
- CLI patterns with Click
- MCP server integration
- Cache management
- Output formatting
- Testing strategies

### Module Responsibilities

Single-responsibility modules:

| Module | Responsibility | Key Classes/Functions |
|--------|---------------|----------------------|
| `cli.py` | Command-line interface | Click commands/groups |
| `constants.py` | Configuration | Module-level constants |
| `exceptions.py` | Error hierarchy | Custom exception classes |

## MCP Server Development

### Creating New MCP Server

1. Use the `tool-sample/` template as reference
2. Define tools as MCP Tool objects in `tools.py`
3. Implement async `execute_tool(name, arguments)` handler
4. Entry point in `server.py` runs stdio server

Example structure:

```python
# server.py
from mcp.server import Server
from mcp.server.stdio import stdio_server
from .tools import TOOLS, execute_tool

app = Server("my-tool")

@app.list_tools()
async def list_tools():
    return TOOLS

@app.call_tool()
async def call_tool(name: str, arguments: dict):
    return await execute_tool(name, arguments)

def main():
    import asyncio
    asyncio.run(stdio_server(app))
```

### Tool Definitions

Tools must be MCP `Tool` objects:

```python
from mcp.types import Tool

TOOLS = [
    Tool(
        name="search",
        description="Search for items",
        inputSchema={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search term"}
            },
            "required": ["query"]
        }
    )
]
```

### Adding MCP Server to Configuration

Edit `mcp_config.toml`:

```toml
[services.tool_name]
description = "Tool description"
command = "uvx --from git+https://your-repo#subdirectory=tool-name tool-name-mcp-server"
env_vars = []
clients = ["claude", "qwen"]
enabled = true
```

## Testing Strategy

### Test Organisation

- `conftest.py` - Shared fixtures
- `test_cli.py` - CLI command tests

### Common Fixtures

```python
@pytest.fixture
def runner():
    return CliRunner()

@pytest.fixture
def temp_cache_dir(tmp_path):
    return tmp_path / "cache"
```

### Running Tests

```bash
# All tests with verbose output
pytest tests/ -v

# Specific test
pytest tests/test_cli.py::test_hello_basic -v

# With coverage
pytest tests/ --cov=my_tool --cov-report=term-missing
```

## Code Quality

### Guidelines

- Python 3.10+ features
- Type hints on public APIs
- KISS/DRY principles
- Comments explain *why*, not *what*

### Tooling

- **black** - Formatting (100 char limit)
- **ruff** - Linting/import sorting
- **mypy** - Type checking
- **pytest** - Testing

### Configuration

Standard `pyproject.toml`:

```toml
[tool.black]
line-length = 100

[tool.mypy]
check_untyped_defs = true

[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py"]
```

## GenAI Integration

### Agents (genAI/agents/)

Specialised AI assistants:

- `python-pro.md` - Python development
- `cloud-architect.md` - Cloud infrastructure
- `security-auditor.md` - Security review
- `senior-code-reviewer.md` - Code review
- `architect-review.md` - Architectural review
- `docs-architect.md` - Documentation architecture
- `task-tester.md` - Testing and validation
- `technical-writer.md` - Technical documentation writing

### Skills (genAI/skills/)

Context-aware task skills:

- `mcp-builder/` - Guide for creating high-quality MCP servers (Python/TypeScript)
- `tool-development/` - Tool building patterns
- `skill-creator/` - Create new skills
- `skill-evolver/` - Evolve skills through genetic algorithms
- `coupling-evaluation/` - Code coupling analysis
- `technical-system-research/` - Technical system investigation
- `uv-docker-packaging/` - UV-based Docker containerization

### Slash Commands (genAI/commands/)

Workflow automation:

- `/pr` - Create pull request
- `/commit-and-push` - Commit and push changes
- `/refactor` - Refactoring workflow
- `/checkout` - Branch management
- `/catch-up` - Review recent changes
- `/pull_and_prune` - Pull and prune branches

## Common Pitfalls

### Package Naming

- Package directory: `tool_name` (underscore)
- Import: `from tool_name import ...`
- CLI command: `tool-name` (hyphen)
- MCP command: `tool-name-mcp-server`

### Cache Location

Caches use `/tmp/tool-name-cache/` for consistency. Avoid:

- User home directory
- Current working directory
- Repository directory

### Error Handling

Use custom exceptions from `exceptions.py`:

```python
from tool_name.exceptions import MyToolError

try:
    results = do_something()
except MyToolError as e:
    click.echo(f"Error: {e}", err=True)
```

### MCP Tool Definitions

Use MCP `Tool` objects, not dictionaries:

```python
# Correct
from mcp.types import Tool
tools = [Tool(name="search", ...)]

# Wrong
tools = [{"name": "search", ...}]
```

## Environment Variables

### MCP Setup

Script loads `.env` from:

1. `$SCRIPT_DIR/.env` (repo root)
2. `$HOME/.env` (user home)

## Troubleshooting

### Tool Installation Issues

```bash
# Force reinstall
cd tool-name && uv tool install -e . --force

# Check installed tools
uv tool list

# Uninstall
uv tool uninstall tool-name
```

### MCP Server Issues

```bash
# List configured services
./setup.sh --list-services

# Test MCP server manually
uvx --from git+https://repo#subdirectory=tool-name tool-name-mcp-server

# Check Claude/Qwen MCP config
cat ~/.config/claude/mcp.json
cat ~/.config/qwen/qwen_config.json
```

## Related Documentation

- Tool template: `tool-sample/README.md`
- Skill definitions: `genAI/skills/*/SKILL.md`
- MCP configuration: `mcp_config.toml`

## Development Workflow

1. Apply KISS/DRY principles - keep functions and modules concise
2. Comments explain *why*, not *what*
3. Interfaces should be simple yet deep
4. Use Vulture to check unused code when refactoring
5. Run `ruff lint` before committing
6. Always use `uv` for package installation
7. Format markdown with linters after creation
8. Do not modify working CLI code when attempting to fix MCP server issues - troubleshoot MCP servers independently
9. SKILL.md files should aim to be 500 words or less, with detailed information in supplementary documents
10. When changing a CLI tool, check if it has an associated MCP server and update it accordingly
11. **Update README.md and CLAUDE.md before pushing changes** - Keep documentation in sync with code changes
