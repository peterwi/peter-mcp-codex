# Testing

Testing strategies for Python (pytest) and Bash (BATS).

## Python Testing (pytest)

### Basic Structure

```
tests/
├── conftest.py          # Shared fixtures
├── test_search.py       # Search tests
├── test_cache.py        # Cache tests
└── test_cli.py          # CLI tests
```

### Test Example (test_search.py)

```python
import pytest
from tool_name.search import search_items

def test_search_returns_items(mock_cache):
    results = search_items('production')
    assert len(results) > 0

def test_search_empty_query_raises_error():
    with pytest.raises(SearchError, match='Search term required'):
        search_items('')
```

### Fixtures (conftest.py)

```python
import pytest, json
from pathlib import Path

@pytest.fixture
def mock_cache(tmp_path, monkeypatch):
    """Mock cache for testing."""
    cache_file = tmp_path / 'cache.json'
    cache_file.write_text(json.dumps({'data': [{'id': 1, 'name': 'test', 'type': 'db'}]}))
    from tool_name import cache
    monkeypatch.setattr(cache, 'CACHE_FILE', cache_file)
    return cache_file
```

### Run Tests

```bash
# All tests with coverage
python -m pytest tests/ -v --cov=tool_name --cov-fail-under=80

# Specific test file
python -m pytest tests/test_search.py -v

# Specific test
python -m pytest tests/test_search.py::test_search_returns_items -v
```

## Bash Testing (BATS)

### Test File Example (test_search.bats)

```bash
#!/usr/bin/env bats

setup() {
    export TOOL_CACHE_DIR=$(mktemp -d)
    mkdir -p "$TOOL_CACHE_DIR"
    cat > "$TOOL_CACHE_DIR/data.json" <<'EOF'
{
  "data": [
    {"id": 1, "name": "production-db", "type": "database"},
    {"id": 2, "name": "staging-web", "type": "service"}
  ]
}
EOF
}

teardown() {
    rm -rf "$TOOL_CACHE_DIR"
}

@test "search requires query" {
    run ./my-tool search
    [[ "$status" -eq 1 ]]
    [[ "$output" == *"Search term required"* ]]
}

@test "search returns matching items" {
    run ./my-tool search production --format json
    [[ "$status" -eq 0 ]]
    [[ "$output" == *"production-db"* ]]
}

@test "search format json produces valid JSON" {
    run ./my-tool search prod --format json
    [[ "$status" -eq 0 ]]
    echo "$output" | jq empty  # Valid JSON?
    [[ $? -eq 0 ]]
}
```

### Run Tests

```bash
# All tests
bats tests/*.bats

# Specific file
bats tests/test_search.bats

# Verbose
bats -v tests/test_search.bats

# TAP format (CI/CD)
bats --tap tests/test_search.bats
```

## Test Pyramid

- **90% unit tests**: Fast, isolated, test individual functions
- **10% integration tests**: Complete workflows, slower but comprehensive

## Best Practices

### Both Languages

1. **Test naming** - Explains what is tested: `test_search_returns_empty_when_no_matches`
1. **One assertion per test** - Generally keep tests focused
1. **Test both success and failure** - Happy path + edge cases + errors
1. **Use fixtures** - Reusable setup/teardown
1. **Mock dependencies** - Don't call real APIs in tests

### Python-Specific

- Use `pytest.fixture` for setup/teardown
- Use `monkeypatch` to replace dependencies
- Use parametrized tests for multiple similar cases:

```python
@pytest.mark.parametrize('query,expected_count', [
    ('prod', 2),
    ('staging', 1),
    ('nonexistent', 0),
])
def test_search_counts(mock_cache, query, expected_count):
    results = search_items(query)
    assert len(results) == expected_count
```

### Bash-Specific

- Always check exit codes: `[[ "$status" -eq 0 ]]`
- Validate output with patterns: `[[ "$output" == *"pattern"* ]]`
- Clean up in teardown: `rm -rf "$temp_dir"`

## Test Coverage Goals

- **Minimum**: 70% code coverage
- **Target**: 80%+ code coverage
- **Excellent**: 90%+ code coverage

Focus on:

- Happy path (main functionality)
- Error cases (what can go wrong)
- Edge cases (empty input, large input, special characters)

______________________________________________________________________

**See also**: [Python Tools](python-tools.md), [Bash Tools](bash-tools.md),
[SKILL Reference](SKILL.md)
