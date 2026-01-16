# Python Tool Architecture

Minimal, focused guide for Python CLI tools using Click.

## Quick Start

```python
# tool_name/cli.py
import click
from .search import search_items
from .cache import refresh_cache, clear_cache

@click.group()
@click.version_option(version='0.1.0')
def cli():
    """Tool description."""
    pass

@cli.command()
@click.argument('query')
@click.option('-f', '--format', default='compact', type=click.Choice(['compact', 'table', 'json']))
@click.option('-v', '--verbose', is_flag=True, help='Enable verbose output')
def search(query, format, verbose):
    """Search items."""
    from .logging_config import setup_logging
    setup_logging(verbose)
    try:
        results = search_items(query)
        from .formatters import format_output
        click.echo(format_output(results, format))
    except Exception as e:
        click.echo(f'ERROR: {e}', err=True)
        raise SystemExit(1)

@cli.group('cache')
def cache_group():
    pass

@cache_group.command('status')
def cache_status():
    from .cache import get_cache_status
    click.echo(get_cache_status())

@cache_group.command('refresh')
def cache_refresh_cmd():
    refresh_cache()
    click.echo('Cache refreshed')

@cache_group.command('clear')
def cache_clear_cmd():
    clear_cache()
    click.echo('Cache cleared')

def main():
    cli()
```

## Project Structure

```
tool-name/
├── pyproject.toml
├── README.md
├── tool_name/
│   ├── __init__.py
│   ├── cli.py              # Entry point (Click)
│   ├── search.py           # Core logic
│   ├── cache.py            # Persistence
│   ├── formatters.py       # Output
│   ├── constants.py        # Config
│   ├── exceptions.py       # Errors
│   └── logging_config.py   # Logging setup
├── tool_name_mcp/          # Optional: MCP server
│   ├── __init__.py
│   ├── server.py           # MCP server entry
│   └── tools.py            # MCP tool definitions
└── tests/
    ├── conftest.py
    ├── test_search.py
    ├── test_cache.py
    ├── test_cli.py
    └── test_mcp_server.py  # Optional: MCP tests
```

## Setup

Create `pyproject.toml`:

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "tool-name"
version = "0.1.0"
description = "Brief description"
requires-python = ">=3.10"
dependencies = ["click>=8.0.0", "requests>=2.25.0"]

[project.optional-dependencies]
dev = ["pytest>=6.0", "pytest-cov>=2.10"]
mcp = ["mcp>=0.1.0"]  # Optional: for MCP server support

[project.scripts]
tool-name = "tool_name.cli:main"
tool-name-mcp-server = "tool_name_mcp.server:main"  # Optional: MCP server entry

[tool.hatch.build.targets.wheel]
packages = ["tool_name"]
```

Install: `uv pip install -e ".[dev]"`

## Configuration Pattern: constants.py

**Never use config files** (YAML/JSON). Put all configuration in `constants.py`:

```python
# tool_name/constants.py
from pathlib import Path
import os

# Paths
CACHE_DIR = Path.home() / '.cache' / 'tool-name'
CACHE_FILE = CACHE_DIR / 'data.json'

# API configuration (secrets from env)
API_ENDPOINT = os.getenv('TOOL_NAME_API_ENDPOINT', 'https://api.example.com')
API_KEY = os.getenv('TOOL_NAME_API_KEY')  # Required - fail if missing
API_TIMEOUT = int(os.getenv('TOOL_NAME_TIMEOUT', '30'))

# Output
OUTPUT_FORMATS = ['compact', 'table', 'json']
DEFAULT_FORMAT = 'compact'

# Cache TTL
CACHE_MAX_AGE_HOURS = int(os.getenv('TOOL_NAME_CACHE_TTL', '168'))  # 7 days
```

**Priority** (CLI args > env vars > defaults):

```python
@click.option('--format', envvar='TOOL_NAME_FORMAT', default=DEFAULT_FORMAT)
def search(format):
    # Click handles priority automatically
    pass
```

## Development Workflow

```bash
# Test
python -m pytest tests/ -v --cov=tool_name

# Format
uv ruff format .
uv ruff check --fix .

# Verify
uv ruff check .
python -m pytest tests/ --cov-fail-under=80
```

## Common Patterns

### Cache-First Design

```python
def load_or_fetch(force=False):
    """Load from cache, fetch from API if needed."""
    if not force:
        try:
            return load_cache()
        except CacheError:
            pass
    data = fetch_from_api()
    save_cache(data)
    return data
```

### Error Context

```python
try:
    data = load_cache()
except FileNotFoundError as e:
    raise CacheError(f"Cache file not found ({CACHE_FILE})") from e
```

### Query Routing

```python
def search_items(query: str) -> list:
    if is_ip_address(query):
        return search_by_ip(query)
    elif is_cidr_block(query):
        return search_by_cidr(query)
    else:
        return search_by_name(query)
```

## Testing

Use pytest with fixtures:

```python
# tests/conftest.py
@pytest.fixture
def mock_cache(tmp_path, monkeypatch):
    """Mock cache for testing."""
    cache_file = tmp_path / 'cache.json'
    data = {'data': [{'id': 1, 'name': 'test'}]}
    cache_file.write_text(json.dumps(data))
    monkeypatch.setattr(cache, 'CACHE_FILE', cache_file)
    return cache_file

# tests/test_search.py
def test_search_returns_items(mock_cache):
    results = search_items('test')
    assert len(results) > 0

def test_search_empty_query_raises_error():
    with pytest.raises(SearchError, match='Search term required'):
        search_items('')
```

Run: `pytest tests/ -v --cov=tool_name --cov-fail-under=80`

## Type Hints

Use throughout:

```python
from typing import Optional, Sequence

def search_items(
    query: str,
    limit: int = 1000,
    scope: Optional[str] = None
) -> list[dict[str, Any]]:
    """Search implementation."""
    pass
```

## MCP Server Support (Optional)

To add MCP server capabilities, see [MCP Servers](mcp-servers.md) for:
- Creating the `tool_name_mcp/` module
- Wrapping existing business logic (don't duplicate!)
- Defining MCP tools with rich schemas
- Testing MCP tool execution

**Key principle**: MCP server wraps `search.py`, `cache.py`, etc.—never reimplements them.

______________________________________________________________________

**See also**: [SKILL Reference](SKILL.md), [MCP Servers](mcp-servers.md),
[Design Patterns](design-patterns.md), [Testing](testing.md)
