---
name: Tool Development
description: Best practices for CLI tools
category: development
---

# Tool Development

Guidelines for building maintainable command-line tools.

## Guiding Principles

- **Do one thing well** - Single responsibility
- **KISS & DRY** - Simple, no repetition
- **Composition** - Tools work together
- **Unix philosophy** - Visible mechanisms

## Python vs Bash

**Use Bash for:**
- Simple shell operations
- Text/file manipulation
- Tool chaining
- Less than 50 lines

**Use Python for:**
- Complex logic
- Data processing
- Caching systems
- Stateful operations
- More than 50 lines

## Project Structure

### Python
```
tool-name/
├── src/tool_name/
│   ├── __init__.py
│   ├── cli.py
│   ├── search.py
│   ├── cache.py
│   ├── formatters.py
│   ├── constants.py
│   └── exceptions.py
├── tests/
└── pyproject.toml
```

### Bash
```
tool-name/
├── bin/
│   └── tool-name
├── lib/
│   ├── common.sh
│   ├── config.sh
│   ├── search.sh
│   ├── cache.sh
│   └── format.sh
├── tests/
└── README.md
```

## Core Features

All tools should implement:

1. **Search** - Fast pattern matching with multiple formats
2. **Cache** - Transparent JSON persistence with metadata
3. **Output** - Support compact, table, and JSON formats
4. **Configuration** - Environment variables for settings

## MCP Server Support (Optional)

Expose tool functionality to LLM agents via Model Context Protocol (MCP):

- **Naming**: Use `<tool>-mcp-server` to keep CLI clean
- **Architecture**: Separate module that wraps existing logic
- **Pattern**: `tool_name_mcp/` module with `server.py` and `tools.py`
- **Principle**: MCP server reuses core business logic, never duplicates it
- **Registration**: Add to `genAI/mcp_config.toml` using full git uvx path

### MCP Configuration

Add your MCP server to `genAI/mcp_config.toml`:

```toml
[services.tool_name]
description = "Tool description MCP server"
command = "uvx --from git+https://git.c3.zone/jimbro785/tools-and-skills#subdirectory=tool-name tool-name-mcp-server"
env_vars = ["TOOL_NAME_API_KEY"]  # List required env vars, or [] if none
clients = ["claude", "qwen"]
enabled = false  # Set to true when ready
```

**Path format**:
- Repository: `git+https://your-repo`
- Subfolder: `#subdirectory=tool-name` (e.g., `my-tool`)
- Format: `uvx --from git+<repo>#subdirectory=<folder> <tool>-mcp-server`

See [MCP Servers](mcp-servers.md) for detailed implementation guide.

## Command Structure

```bash
tool-name search <query> [-f format] [-v]       # Search operation
tool-name cache {status|refresh|clear}          # Cache management
```

### Flags

- **`-v, --verbose`** - Enable verbose output with debug logging. Shows detailed processing steps.
- **`-f, --format`** - Output format: `compact` (default), `table`, or `json`.

## Making Search the Default Command

Enable dig-like syntax where queries work without specifying the `search` subcommand.

### Implementation Pattern

**1. Update CLI entry point** (`cli.py`):

```python
import sys

# Add cli_entry() wrapper before the if __name__ == "__main__" block
def cli_entry() -> None:
    """Route query to default search if no subcommand specified."""
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        # List all subcommands that should NOT trigger default search
        if not arg.startswith("-") and arg not in {"search", "cache", "config"}:
            sys.argv.insert(1, "search")
    main()

if __name__ == "__main__":
    cli_entry()
```

**2. Update entry point** (`pyproject.toml`):

```toml
[project.scripts]
tool-name = "tool_name.cli:cli_entry"  # Changed from :main
```

### How It Works

The `cli_entry()` wrapper inspects `sys.argv`:
- If first argument is a subcommand (`search`, `cache`, etc.), pass through
- If first argument is an option (starts with `-`), pass through
- Otherwise, insert `search` as the first argument

This transforms:
- `tool-name query` → `tool-name search query`
- `tool-name query --opt` → `tool-name search query --opt`
- `tool-name search query` → `tool-name search query` (unchanged)
- `tool-name cache status` → `tool-name cache status` (unchanged)

### Examples

```bash
# Default (new) - no subcommand needed
my-tool "search query"
my-tool "query" --format json

# Explicit (still works)
my-tool search "search query"
my-tool process "data" --format table

# Subcommands unchanged
my-tool cache status
my-tool cache clear
```

### Benefits

✓ **User-friendly**: Natural syntax like `dig` command
✓ **Backward compatible**: Explicit subcommand still works
✓ **Minimal code**: 5 lines per tool
✓ **KISS principle**: Simple, readable implementation

## Output Formats

- `compact` - Single-line format (default)
- `table` - Aligned columns with headers (plain ASCII)
- `json` - Machine-readable format

### Output Style

**Plain text only** - No colors, no unicode, no rich/emoji. Use `print()` to stdout, errors to stderr.

```python
# Good - plain text
print(f"{'Name':<30} {'Type':<15}")
print(f"Error: Not found", file=sys.stderr)

# Bad - avoid rich/colors/unicode
from rich.console import Console  # Don't use
print("\033[91mError\033[0m")      # Don't use
print("┌─────────┐")                # Don't use
```

## Error Handling

```
ERROR: [description] ([context])
ERROR: Search term required (got empty string)
ERROR: Cache file not found (~/.cache/tool-name/data.json)
```

All errors should be printed to stderr, not stdout.

### Exit Codes
- `0` - Success
- `1` - Error
- `2` - No results
- `3` - Configuration error
- `4` - Not found
- `5` - Permission denied

## Configuration

Use `constants.py` with environment variable overrides:

```python
# constants.py
from pathlib import Path
import os

CACHE_DIR = Path.home() / '.cache' / 'tool-name'
API_KEY = os.getenv('TOOL_NAME_API_KEY')
API_ENDPOINT = os.getenv('TOOL_NAME_API_ENDPOINT', 'https://api.example.com')
DEFAULT_FORMAT = 'compact'
```

Priority (highest to lowest):
1. Command-line arguments
2. Environment variables
3. Built-in defaults

Never use config files (YAML/JSON) or `.env` files.

## Python Example

```python
import sys
import typer

app = typer.Typer(add_completion=False)

@app.command()
def search(query: str, format: str = typer.Option("compact", "-f"), verbose: bool = False):
    if verbose:
        print(f"Searching: {query}", file=sys.stderr)
    print(format_output(search_items(query), format))

@app.command()
def cache_status():
    print(f"Cache: {cache_dir}\nSize: {size}\nUpdated: {timestamp}")

if __name__ == '__main__':
    app()
```

## Bash Example

```bash
#!/usr/bin/env bash
set -euo pipefail

case "${1:-search}" in
    search) jq --arg q "$2" '.[] | select(.name | contains($q))' "$CACHE_FILE" ;;
    cache)  handle_cache "${2:-status}" ;;
    *)      echo "Usage: $0 {search|cache}" >&2; exit 1 ;;
esac
```

## Code Quality Checklist

- [ ] Single responsibility principle
- [ ] Functions under 50 lines (Python) or 40 lines (Bash)
- [ ] Modules under 500 lines (Python) or 300 lines (Bash)
- [ ] Comments explain why, not what
- [ ] Clear error messages with context
- [ ] 80%+ test coverage
- [ ] Passes linting (ruff, shellcheck)

## Before Committing

```bash
# Python
python -m pytest tests/ --cov-fail-under=80
uv ruff check --fix .
mypy src/

# Bash
shellcheck bin/tool-name lib/*.sh
bats tests/*.bats
```

## Testing

### Python
```bash
python -m pytest tests/ -v --cov=tool_name
```

### Bash
```bash
bats tests/*.bats
```

Goal: 80%+ code coverage (90% unit, 10% integration)

## Documentation

Include in README:
- Installation instructions
- Quick start examples
- Usage with all options
- Common workflows
- Troubleshooting section

## Documentation Structure

- **[SKILL.md](SKILL.md)** - This overview and quick reference
- **[python-tools.md](python-tools.md)** - Python implementation details
- **[bash-tools.md](bash-tools.md)** - Bash implementation details
- **[mcp-servers.md](mcp-servers.md)** - MCP server architecture guide
- **[design-patterns.md](design-patterns.md)** - Core design principles
- **[testing.md](testing.md)** - Testing strategies and examples

See `tool-sample/` in the repository root for a complete working example.
