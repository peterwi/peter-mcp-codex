# MCP Server Architecture

Guide for adding Model Context Protocol (MCP) server capabilities to existing CLI tools.

## Philosophy

MCP servers expose tool functionality to LLM agents while keeping the original CLI clean and focused. Use the naming pattern `<tool>-mcp-server` to maintain separation of concerns.

**Key principle**: The MCP server wraps existing CLI logic—it doesn't reimplement it. This ensures:
- Single source of truth for business logic
- CLI and MCP server stay in sync
- Reduced maintenance burden
- Consistent behavior across interfaces

## Project Structure

```
tool-name/
├── tool_name/
│   ├── cli.py              # Original CLI entry point
│   ├── search.py           # Core business logic
│   ├── cache.py
│   ├── formatters.py
│   └── constants.py
├── tool_name_mcp/          # MCP server module (separate)
│   ├── __init__.py
│   ├── server.py           # MCP server implementation
│   └── tools.py            # Tool definitions
├── pyproject.toml
└── README.md
```

## Setup Pattern

### 1. Add MCP Dependencies

Update `pyproject.toml`:

```toml
[project.optional-dependencies]
mcp = ["mcp>=0.1.0"]

[project.scripts]
tool-name = "tool_name.cli:cli_entry"
tool-name-mcp-server = "tool_name_mcp.server:main"
```

Install: `uv pip install -e ".[mcp]"`

### 2. Create MCP Server Module

```python
# tool_name_mcp/server.py
from mcp.server import Server
from mcp.server.stdio import stdio_server
from .tools import TOOLS, execute_tool

app = Server("tool-name")

@app.list_tools()
async def list_tools():
    """Return available tools."""
    return TOOLS

@app.call_tool()
async def call_tool(name: str, arguments: dict):
    """Execute tool and return results."""
    return await execute_tool(name, arguments)

def main():
    """Entry point for MCP server."""
    import asyncio
    asyncio.run(stdio_server(app))

if __name__ == "__main__":
    main()
```

### 3. Define Tools

```python
# tool_name_mcp/tools.py
from typing import Any
from tool_name.search import search_items
from tool_name.cache import refresh_cache, clear_cache, get_cache_status

TOOLS = [
    {
        "name": "tool_name_search",
        "description": "Search items by query with optional scope filtering",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search term or pattern"
                },
                "scope": {
                    "type": "string",
                    "description": "Optional scope filter (all, active, archived)",
                    "default": "all"
                },
                "format": {
                    "type": "string",
                    "enum": ["compact", "table", "json"],
                    "default": "json"
                }
            },
            "required": ["query"]
        }
    },
    {
        "name": "tool_name_cache_status",
        "description": "Get cache status and metadata",
        "inputSchema": {
            "type": "object",
            "properties": {}
        }
    }
]

async def execute_tool(name: str, arguments: dict) -> Any:
    """Route tool execution to appropriate handler."""
    if name == "tool_name_search":
        results = search_items(
            query=arguments["query"],
            scope=arguments.get("scope", "all")
        )
        return {"results": results, "count": len(results)}

    elif name == "tool_name_cache_status":
        return get_cache_status()

    else:
        raise ValueError(f"Unknown tool: {name}")
```

## Design Patterns

### Reuse Core Logic

**Good** - MCP server calls existing functions:

```python
# MCP server wraps existing logic
async def execute_tool(name: str, arguments: dict):
    if name == "search":
        return search_items(arguments["query"])  # Existing function
```

**Bad** - MCP server reimplements logic:

```python
# Don't duplicate business logic
async def execute_tool(name: str, arguments: dict):
    if name == "search":
        # Reimplementing search logic here is wrong!
        cache_file = Path.home() / ".cache" / "data.json"
        data = json.loads(cache_file.read_text())
        return [item for item in data if arguments["query"] in item["name"]]
```

### Error Handling

MCP servers should catch exceptions and return structured errors:

```python
async def execute_tool(name: str, arguments: dict):
    try:
        if name == "search":
            results = search_items(arguments["query"])
            return {"results": results, "count": len(results)}
    except ValueError as e:
        return {"error": str(e), "type": "validation_error"}
    except FileNotFoundError as e:
        return {"error": f"Cache not found: {e}", "type": "cache_error"}
    except Exception as e:
        return {"error": f"Unexpected error: {e}", "type": "internal_error"}
```

### Format Conversion

MCP tools should default to JSON format for structured output:

```python
async def execute_tool(name: str, arguments: dict):
    # Force JSON format for MCP consumers
    results = search_items(
        query=arguments["query"],
        format="json"  # Always JSON for MCP
    )
    return json.loads(results)  # Return dict, not string
```

## Configuration and Cache Sharing

MCP servers inherit configuration from the main tool and **share the same cache**:

```python
# tool_name_mcp/server.py
from tool_name.constants import CACHE_DIR, CACHE_FILE, API_ENDPOINT, API_KEY
from tool_name.cache import load_cache, refresh_cache

# Same config and cache used by both CLI and MCP server
# No need to duplicate environment variable handling
```

### Auto-Build Cache Pattern

MCP servers should **automatically build the cache** if it doesn't exist:

```python
# tool_name_mcp/tools.py
from pathlib import Path
from tool_name.cache import load_cache, refresh_cache
from tool_name.constants import CACHE_FILE

async def execute_tool(name: str, arguments: dict):
    """Execute tool, building cache if needed."""

    # Auto-build cache on first use
    if not Path(CACHE_FILE).exists():
        try:
            refresh_cache()  # Reuse existing cache refresh logic
        except Exception as e:
            return {
                "error": f"Failed to initialize cache: {e}",
                "type": "cache_initialization_error",
                "hint": "Check API credentials and network connectivity"
            }

    if name == "tool_name_search":
        try:
            results = search_items(arguments["query"])  # Uses shared cache
            return {"results": results, "count": len(results)}
        except Exception as e:
            return {"error": str(e), "type": "search_error"}
```

**Key principle**: MCP server and CLI use the **same cache location** (`~/.cache/tool-name/data.json`). This ensures:
- Consistent results between CLI and MCP server
- No duplicate cache storage
- CLI cache refreshes benefit MCP server (and vice versa)
- Single source of truth for cached data

## Testing

Test MCP server independently, including cache auto-build:

```python
# tests/test_mcp_server.py
import pytest
from pathlib import Path
from tool_name_mcp.tools import execute_tool
from tool_name.constants import CACHE_FILE

@pytest.mark.asyncio
async def test_search_tool_returns_results(mock_cache):
    """Test search with existing cache."""
    result = await execute_tool("tool_name_search", {"query": "test"})
    assert "results" in result
    assert result["count"] > 0

@pytest.mark.asyncio
async def test_search_tool_handles_empty_query():
    """Test validation error handling."""
    result = await execute_tool("tool_name_search", {"query": ""})
    assert "error" in result
    assert result["type"] == "validation_error"

@pytest.mark.asyncio
async def test_auto_build_cache_on_missing(tmp_path, monkeypatch):
    """Test that MCP server auto-builds cache if missing."""
    # Point to temp cache location
    cache_file = tmp_path / "cache.json"
    monkeypatch.setattr("tool_name.constants.CACHE_FILE", cache_file)

    # Ensure cache doesn't exist
    assert not cache_file.exists()

    # Execute tool - should auto-build cache
    result = await execute_tool("tool_name_search", {"query": "test"})

    # Cache should now exist
    assert cache_file.exists()
    assert "results" in result or "error" not in result

@pytest.mark.asyncio
async def test_cache_build_failure_returns_error(tmp_path, monkeypatch):
    """Test graceful handling of cache build failures."""
    # Mock refresh_cache to fail
    def mock_refresh_fail():
        raise Exception("API unreachable")

    monkeypatch.setattr("tool_name_mcp.tools.refresh_cache", mock_refresh_fail)

    cache_file = tmp_path / "cache.json"
    monkeypatch.setattr("tool_name.constants.CACHE_FILE", cache_file)

    result = await execute_tool("tool_name_search", {"query": "test"})

    assert "error" in result
    assert result["type"] == "cache_initialization_error"
    assert "API unreachable" in result["error"]
```

## MCP Configuration Registration

Add your MCP server to `mcp_config.toml` for centralized management:

```toml
[services.tool_name]
description = "Tool description MCP server"
command = "uvx --from git+https://your-repo#subdirectory=tool-name tool-name-mcp-server"
env_vars = ["TOOL_NAME_API_KEY"]  # Required environment variables
clients = ["claude", "qwen"]
enabled = false  # Set to true when ready for production
```

**Path format**:
- Base repository: `git+https://your-repo`
- Subfolder syntax: `#subdirectory=tool-name`
- Full format: `uvx --from git+<repo>#subdirectory=<folder> <tool>-mcp-server`

**Example**:
```toml
[services.my_tool]
description = "My tool MCP server"
command = "uvx --from git+https://github.com/user/repo#subdirectory=my-tool my-tool-mcp-server"
env_vars = []
clients = ["claude", "qwen"]
enabled = true
```

## Claude Desktop Integration (Alternative)

For standalone Claude Desktop configuration, add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "tool-name": {
      "command": "tool-name-mcp-server",
      "env": {
        "TOOL_NAME_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

Test integration:

```bash
# Verify MCP server runs
tool-name-mcp-server

# Check it's accessible (should wait for stdin)
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | tool-name-mcp-server
```

## MCP Tool Schema Guidelines

### Descriptive Tool Names

Use clear, namespaced names:

```python
# Good - clear and namespaced
"name": "tool_name_search_items"
"name": "tool_name_cache_refresh"

# Bad - too generic
"name": "search"
"name": "refresh"
```

### Rich Descriptions

Provide context for LLM understanding:

```python
{
    "name": "tool_name_search",
    "description": """Search infrastructure assets by name, ID, or pattern.

    Supports multiple scopes:
    - all: Search across all items (default)
    - active: Only active/production items
    - archived: Historical/decommissioned items

    Returns matching items with metadata including type, status, and timestamps.
    Use JSON format for programmatic processing or table for human review.""",
    "inputSchema": {
        # ...
    }
}
```

### Detailed Property Descriptions

```python
"properties": {
    "query": {
        "type": "string",
        "description": "Search term (supports substring matching) or regex pattern (prefix with 're:')"
    },
    "scope": {
        "type": "string",
        "description": "Filter scope: 'all' (default), 'active', or 'archived'",
        "enum": ["all", "active", "archived"],
        "default": "all"
    }
}
```

## Best Practices

1. **Separation of concerns**: Keep MCP server in separate module (`tool_name_mcp/`)
2. **Reuse logic**: MCP server wraps existing functions, never duplicates
3. **Consistent naming**: Use `<tool>-mcp-server` for clarity
4. **Structured errors**: Return error dicts with type and message
5. **JSON default**: MCP tools should return structured data (dicts/lists)
6. **Shared config**: MCP server uses same `constants.py` as CLI
7. **Shared cache**: MCP server and CLI use same cache location
8. **Auto-build cache**: MCP server builds cache automatically if missing
9. **Independent testing**: Test MCP server functionality separately
10. **Rich schemas**: Provide detailed descriptions for LLM understanding

## Checklist

- [ ] MCP server in separate module (`tool_name_mcp/`)
- [ ] Named `<tool>-mcp-server` in pyproject.toml
- [ ] Reuses core business logic from main tool (no duplication)
- [ ] Shares same cache location as CLI tool
- [ ] Auto-builds cache if it doesn't exist
- [ ] Returns structured errors (not exceptions)
- [ ] Defaults to JSON format
- [ ] Tool schemas have rich descriptions
- [ ] Tests cover MCP tool execution (including cache auto-build)
- [ ] Added to `genAI/mcp_config.toml` with full git uvx path
- [ ] Documented in README
- [ ] Claude Desktop config example provided (if needed)

______________________________________________________________________

**See also**: [SKILL Reference](SKILL.md), [Python Tools](python-tools.md),
[Design Patterns](design-patterns.md)
