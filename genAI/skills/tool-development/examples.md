# Code Examples & Patterns

Common patterns used in production tools.

## Real Tool Example

See `tool-sample/` in the repository root for a complete working example with:
- CLI implementation with Click
- MCP server integration
- Test suite
- Standard project structure

## Common Patterns

### Cache-First Design

```python
def load_or_fetch(force=False):
    if not force:
        try:
            return load_cache()
        except CacheError:
            pass
    data = fetch_from_api()
    save_cache(data)
    return data
```

### Query Routing

Route queries to appropriate handlers based on input type:

```python
def search(query):
    if is_ipv4(query): return search_by_ip(query)
    elif is_cidr(query): return search_by_cidr(query)
    else: return search_by_name(query)
```

### Dual-Mode Operation

Support both live lookups and cached searches:

```python
@cli.command()
@click.argument('query')
@click.option('-x', '--use-cache', is_flag=True, help='Use cached data')
def lookup(query, use_cache):
    """Lookup records."""
    if use_cache:
        results = search_cache(query)  # Fast indexed search
    else:
        results = live_lookup(query)   # External API call
    click.echo(format_output(results))
```

### Scope Filtering

Filter results by scope/category:

```python
def search_items(query: str, scope: str = 'all') -> list[dict]:
    """Search with scope filtering."""
    collections = {
        'active': ['production', 'staging'],
        'archived': ['historical'],
        'all': ['production', 'staging', 'historical']
    }[scope]

    results = []
    for coll in collections:
        data = load_cache(coll)
        results.extend([item for item in data if query in item.get('name', '').lower()])
    return results
```

### Error Context

Provide meaningful error messages with context:

```python
try:
    data = load_cache()
except FileNotFoundError as e:
    raise CacheError(f"Cache file not found ({CACHE_FILE})") from e
```

### Metadata Tracking

Track cache metadata for staleness checks:

```python
data = {
    'metadata': {'timestamp': datetime.utcnow().isoformat() + 'Z', 'item_count': len(items)},
    'data': items
}
```

______________________________________________________________________

See [Python Tools](python-tools.md) and [Bash Tools](bash-tools.md) for implementation guides.
