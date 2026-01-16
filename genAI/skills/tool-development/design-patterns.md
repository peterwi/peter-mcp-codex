# Design Patterns & Principles

Core philosophy for building lightweight CLI tools.

## Unix Philosophy

- **Do one thing well** - Single, focused responsibility
- **Composition** - Tools work together via text interfaces
- **Text as interface** - Data flows as structured text (JSON/CSV)
- **Transparency** - Visible operations, no hidden complexity

## KISS & DRY

**Keep It Simple**: Simple code is easier to understand, test, maintain **Don't Repeat**: Reuse
patterns across tools, extract common logic

## Four Core Affordances

### 1. Search

- Pattern matching (substring, regex, exact)
- Multiple output formats for different use cases
- Scope/collection filtering to reduce noise
- Clear relevance/sorting

**Python**:

```python
def search_items(query: str, scope: str = 'all') -> list[dict]:
    """Search cached items, filtering by scope."""
    items = load_cache()
    results = [item for item in items if matches(query, item)]
    return sort_by_relevance(results)
```

**Bash**:

```bash
do_search() {
    local query="$1" scope="${2:-all}"
    cat "$CACHE_FILE" | jq --arg q "$query" \
        '.items[] | select(.name | contains($q))'
}
```

### 2. Cache

- Transparent (automatic, user doesn't manage)
- Status reporting (age, size, freshness)
- Easy refresh when stale
- Clear for troubleshooting

**Format** (consistent across tools):

```json
{
  "metadata": {"version": "1.0", "timestamp": "2024-01-15T10:30:00Z", "item_count": 1234},
  "data": [{"id": 1, "name": "item1"}, ...]
}
```

### 3. Output Formats

- **compact**: One item per line (default for CLI)
- **table**: Aligned columns with headers
- **json**: Full structured data for piping

### 4. Configuration

**Priority** (highest to lowest):

1. Command-line arguments
1. Environment variables (`TOOL_NAME_OPTION_NAME`)
1. Config file (`~/.config/tool-name/config.yaml`)
1. Built-in defaults

Never hardcode secrets—use environment variables.

## Error Handling

**Exit codes**:

```
0 = Success
1 = General error
2 = No results found
3 = Configuration error
4 = Resource not found
5 = Permission denied
```

**Error format**:

```
ERROR: [description] ([context])
ERROR: Search term required (got empty string)
ERROR: Cache file not found (~/.cache/tool-name/data.json)
```

## Module Responsibility Pattern

| Module   | Responsibility             | Python          | Bash            |
| -------- | -------------------------- | --------------- | --------------- |
| CLI/Main | Route commands, parse args | `cli.py`        | `main()`        |
| Search   | Execute searches           | `search.py`     | `lib/search.sh` |
| Cache    | Store/retrieve data        | `cache.py`      | `lib/cache.sh`  |
| Format   | Transform output           | `formatters.py` | `lib/format.sh` |
| Config   | Manage settings            | `constants.py`  | `lib/config.sh` |
| Errors   | Exception handling         | `exceptions.py` | `lib/common.sh` |

**Single Responsibility**: If a module does multiple things, split it.

## Code Style

**Comments explain why, not what**:

```python
# Bad
for item in items:
    if 'prod' in item['name']:  # Check if production
        results.append(item)     # Add to results

# Good
for item in items:
    if 'prod' in item['name']:  # Filter production only (staging excluded)
        results.append(item)
```

**Naming conventions**:

- Python: `snake_case` functions, `UPPER_SNAKE_CASE` constants
- Bash: `snake_case` functions, `UPPER_SNAKE_CASE` readonly constants
- Descriptive names: `search_items()` not `srch()`

**Interfaces are simple yet deep**:

```python
def search(query: str, format: str = 'compact') -> str:
    """Search and return formatted results (handles all complexity internally)."""
    items = _load_cache()
    filtered = _filter_items(query, items)
    sorted_items = _sort_by_relevance(filtered)
    return _format_output(sorted_items, format)
```

## Testing Pattern

**Pyramid**:

- 90% unit tests (fast, isolated)
- 10% integration tests (complete workflows)

**Test naming**: Explains what is tested

```python
def test_search_returns_items_matching_query(mock_cache):
    """What does it do when...?"""
```

## Decision Tree: Python vs Bash

```
Is the tool logic primarily:
├─ Complex/stateful logic → Python
├─ Data transformation → Bash OK
├─ API interactions → Python
├─ Text processing → Bash OK
├─ >50 lines → Python
└─ <50 lines → Bash OK
```

## Consistency Across Tools

All tools use identical:

- Commands: `tool search <query>`, `tool cache {status|refresh|clear}`
- Output structure: JSON with metadata
- Error messages: `ERROR: description (context)`
- Exit codes: 0, 1, 2, 3, 4, 5

## MCP Server Pattern (Optional)

When adding MCP server support:

- **Separation**: MCP server in separate module (`tool_name_mcp/`)
- **Naming**: Use `<tool>-mcp-server` entry point
- **Reuse**: Wrap existing business logic—never duplicate
- **Format**: MCP tools return structured data (dicts/lists)
- **Errors**: Return error dicts, not exceptions
- **Testing**: Test MCP server independently

**Architecture**:
```
CLI → core logic (search.py, cache.py)
                  ↑
MCP server ───────┘  (wraps same logic)
```

Both CLI and MCP server call the same functions. Single source of truth.

______________________________________________________________________

**See also**: [SKILL Reference](SKILL.md), [Python Implementation](python-tools.md),
[Bash Implementation](bash-tools.md), [MCP Servers](mcp-servers.md)
