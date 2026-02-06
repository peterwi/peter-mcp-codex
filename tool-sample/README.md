# Tool Sample

A template for creating CLI tools with optional MCP server integration.

This directory serves as a comprehensive example for building tools in this monorepo. Use it as a starting point for your own tools.

## Quick Start

```bash
# 1. Copy this directory
cp -r tool-sample my-new-tool

# 2. Rename packages (replace my_tool with your_tool)
mv my-new-tool/my_tool my-new-tool/your_tool
mv my-new-tool/my_tool_mcp my-new-tool/your_tool_mcp

# 3. Update pyproject.toml with your tool name
# 4. Implement your logic
# 5. Install and test
cd my-new-tool && uv tool install -e . --force
```

## Directory Structure

```
tool-sample/
├── my_tool/                  # Core package (underscore naming)
│   ├── __init__.py          # Package init with version
│   ├── cli.py               # Click-based CLI interface
│   ├── constants.py         # Configuration constants
│   └── exceptions.py        # Custom exception hierarchy
├── my_tool_mcp/             # MCP server package (optional)
│   ├── __init__.py
│   ├── server.py            # MCP server entry point
│   └── tools.py             # MCP tool definitions
├── tests/                   # pytest test suite
│   ├── conftest.py          # Shared fixtures
│   └── test_cli.py          # CLI tests
├── pyproject.toml           # uv/hatch configuration
└── README.md                # This file
```

## Creating a New Tool

### Step 1: Define Your Tool

Decide on:
- **Tool name**: Use hyphens for CLI (`my-tool`), underscores for packages (`my_tool`)
- **Core functionality**: What problem does it solve?
- **Commands**: What CLI commands will it have?
- **MCP integration**: Will it be used by AI assistants?

### Step 2: Set Up pyproject.toml

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "my-tool"                          # CLI name (hyphens)
version = "0.1.0"
description = "Brief description of your tool"
readme = "README.md"
license = {text = "MIT"}
authors = [{name = "Your Name"}]
requires-python = ">=3.10"
dependencies = [
    "click>=8.0.0",                       # CLI framework
    # Add your dependencies here
]

[project.optional-dependencies]
dev = [
    "pytest>=6.0",
    "pytest-cov>=2.10",
]

[project.scripts]
my-tool = "my_tool.cli:main"              # CLI entry point
my-tool-mcp-server = "my_tool_mcp.server:main"  # MCP entry point

[tool.hatch.build.targets.wheel]
packages = ["my_tool", "my_tool_mcp"]     # Include both packages
```

### Step 3: Implement the CLI

The CLI uses [Click](https://click.palletsprojects.com/) for command-line interfaces.

**Basic structure** (`my_tool/cli.py`):

```python
"""CLI for my-tool."""

import click
from . import constants
from .exceptions import MyToolError

@click.group()
def main() -> None:
    """My tool does something useful.

    Examples:
      my-tool command arg
      my-tool other-command --option value
    """
    pass

@main.command()
@click.argument("input")
@click.option("--format", "-f", type=click.Choice(["json", "table"]), default="json")
def process(input: str, format: str) -> None:
    """Process the input and display results.

    Examples:
      my-tool process "some input"
      my-tool process "data" --format table
    """
    try:
        # Your logic here
        result = do_something(input)
        click.echo(format_output(result, format))
    except MyToolError as e:
        click.echo(f"Error: {e}", err=True)
        raise SystemExit(1)

if __name__ == "__main__":
    main()
```

**Common patterns**:

```python
# Subcommand groups
@main.group()
def cache() -> None:
    """Cache management commands."""
    pass

@cache.command(name="status")
def cache_status() -> None:
    """Show cache status."""
    pass

@cache.command(name="clear")
def cache_clear() -> None:
    """Clear the cache."""
    pass

# Options with environment variable fallback
@click.option("--api-key", envvar="MY_TOOL_API_KEY", help="API key")

# Multiple values
@click.option("--tag", "-t", multiple=True, help="Tags (can be repeated)")

# Verbose/debug flags
@click.option("--verbose", "-v", is_flag=True, help="Enable verbose output")
```

### Step 4: Add Constants and Exceptions

**constants.py**:

```python
"""Configuration constants for my-tool."""

from pathlib import Path

# Cache configuration
CACHE_DIR = Path("/tmp/my-tool-cache")
CACHE_FILE = CACHE_DIR / "data.json"

# Output formats
OUTPUT_FORMATS = ("json", "table", "compact")
DEFAULT_FORMAT = "json"

# API configuration
DEFAULT_TIMEOUT = 30
MAX_RETRIES = 3
```

**exceptions.py**:

```python
"""Custom exceptions for my-tool."""

class MyToolError(Exception):
    """Base exception for my-tool."""
    pass

class ConfigurationError(MyToolError):
    """Configuration-related errors."""
    pass

class APIError(MyToolError):
    """API communication errors."""
    pass

class CacheError(MyToolError):
    """Cache-related errors."""
    pass
```

### Step 5: Add MCP Server (Optional)

MCP servers allow AI assistants to use your tool.

**server.py**:

```python
"""MCP server for my-tool."""

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

if __name__ == "__main__":
    main()
```

**tools.py**:

```python
"""MCP tool definitions for my-tool."""

from mcp.types import Tool, TextContent
from typing import Any

TOOLS = [
    Tool(
        name="my_tool_process",
        description="Process input and return results.",
        inputSchema={
            "type": "object",
            "properties": {
                "input": {
                    "type": "string",
                    "description": "Input to process"
                },
                "format": {
                    "type": "string",
                    "enum": ["json", "table"],
                    "default": "json"
                }
            },
            "required": ["input"]
        }
    ),
]

async def execute_tool(name: str, arguments: dict) -> Any:
    """Execute MCP tool and return results."""
    if name == "my_tool_process":
        return await process_handler(arguments)
    return {"error": f"Unknown tool: {name}"}

async def process_handler(arguments: dict) -> list[TextContent]:
    """Handle process tool calls."""
    from my_tool.core import do_something

    input_data = arguments["input"]
    format_type = arguments.get("format", "json")

    result = do_something(input_data)
    formatted = format_output(result, format_type)

    return [TextContent(type="text", text=formatted)]
```

### Step 6: Register MCP Server

Add to `mcp_config.toml`:

```toml
[services.my_tool]
description = "My tool MCP server"
command = "uvx --from git+https://your-repo#subdirectory=my-tool my-tool-mcp-server"
env_vars = []
enabled = true
```

### Step 7: Write Tests

**conftest.py**:

```python
"""Shared test fixtures."""

import pytest
from pathlib import Path

@pytest.fixture
def temp_cache_dir(tmp_path):
    """Provide a temporary cache directory."""
    cache_dir = tmp_path / "cache"
    cache_dir.mkdir()
    return cache_dir

@pytest.fixture
def sample_data():
    """Provide sample test data."""
    return {"key": "value", "items": [1, 2, 3]}
```

**test_cli.py**:

```python
"""CLI tests."""

import pytest
from click.testing import CliRunner
from my_tool.cli import main

@pytest.fixture
def runner():
    return CliRunner()

def test_help(runner):
    """Test help output."""
    result = runner.invoke(main, ["--help"])
    assert result.exit_code == 0
    assert "My tool" in result.output

def test_process_basic(runner):
    """Test basic processing."""
    result = runner.invoke(main, ["process", "test input"])
    assert result.exit_code == 0
```

Run tests:

```bash
cd my-tool
python -m pytest tests/ -v
python -m pytest tests/ --cov=my_tool --cov-report=html
```

## Common Patterns

### Cache Management

```python
from pathlib import Path
import json

class CacheManager:
    def __init__(self, cache_dir: Path):
        self.cache_dir = cache_dir
        self.cache_file = cache_dir / "data.json"

    def save(self, data: dict) -> None:
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.cache_file.write_text(json.dumps(data))

    def load(self) -> dict:
        if not self.cache_file.exists():
            return {}
        return json.loads(self.cache_file.read_text())

    def clear(self) -> None:
        if self.cache_file.exists():
            self.cache_file.unlink()
```

### Output Formatting

```python
import json

def format_output(data: dict, fmt: str) -> str:
    if fmt == "json":
        return json.dumps(data, indent=2)
    elif fmt == "table":
        # Simple table format
        lines = []
        for key, value in data.items():
            lines.append(f"{key:<20} {value}")
        return "\n".join(lines)
    else:
        # Compact format
        return str(data)
```

### API Client Pattern

```python
import httpx
from .exceptions import APIError
from . import constants

class APIClient:
    def __init__(self, base_url: str, api_key: str = None):
        self.base_url = base_url
        self.api_key = api_key

    def get(self, endpoint: str, params: dict = None) -> dict:
        headers = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        try:
            with httpx.Client(timeout=constants.DEFAULT_TIMEOUT) as client:
                response = client.get(
                    f"{self.base_url}/{endpoint}",
                    params=params,
                    headers=headers
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError as e:
            raise APIError(f"API request failed: {e}")
```

## Installation

### Development Install

```bash
cd tool-sample
uv pip install -e .
```

### Global Install with uv

```bash
cd tool-sample
uv tool install -e . --force
```

### Via setup.sh

The `setup.sh` script automatically installs all tools:

```bash
./setup.sh --tools-only
```

## Best Practices

1. **Naming conventions**:
   - Package directory: `my_tool` (underscore)
   - CLI command: `my-tool` (hyphen)
   - MCP server: `my-tool-mcp-server`

2. **Cache location**: Use `/tmp/tool-name-cache/` for consistency

3. **Error handling**: Use custom exceptions from `exceptions.py`

4. **Output formats**: Support at least `json` and `table`

5. **Type hints**: Add type hints to public APIs

6. **Documentation**: Include examples in CLI help text

7. **Testing**: Write tests for CLI commands and core logic

## Related Documentation

- [Click documentation](https://click.palletsprojects.com/)
- [MCP specification](https://modelcontextprotocol.io/)
- [uv documentation](https://docs.astral.sh/uv/)
- Main repo AGENTS.md for development guidelines
