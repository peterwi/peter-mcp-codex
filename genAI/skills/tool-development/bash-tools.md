# Bash Tool Architecture

Minimal guide for Bash CLI tools using standard Unix utilities.

## Quick Start

```bash
#!/usr/bin/env bash
set -euo pipefail

readonly CACHE_DIR="${HOME}/.cache/my-tool"
readonly API_ENDPOINT="https://api.example.com"

main() {
    case "${1:-search}" in
        search)   do_search "$2" ;;
        cache)    handle_cache "${2:-status}" ;;
        *)        die "Unknown command: $1" ;;
    esac
}

do_search() {
    local query="$1"
    [[ -n "$query" ]] || die "Search term required"

    curl -s "$API_ENDPOINT/search?q=$(urlencode "$query")" | jq '.'
}

handle_cache() {
    case "$1" in
        status)  [[ -f "$CACHE_DIR/data.json" ]] && stat -c%s "$CACHE_DIR/data.json" || echo "empty" ;;
        refresh) mkdir -p "$CACHE_DIR"; curl -s "$API_ENDPOINT/data" > "$CACHE_DIR/data.json"; echo "Refreshed" ;;
        clear)   rm -rf "$CACHE_DIR"; echo "Cleared" ;;
    esac
}

die() { echo "ERROR: $*" >&2; exit 1; }
urlencode() { echo "$1" | sed 's/ /%20/g'; }

main "$@"
```

## Project Structure

### Simple (single file)

```
my-tool/
├── my-tool.sh       # Executable script
├── README.md
└── tests/
    └── test_search.bats
```

### Modularized (larger tools)

```
my-tool/
├── my-tool          # Entry point
├── lib/
│   ├── common.sh    # Error handling, validation
│   ├── config.sh    # Environment variables
│   ├── search.sh    # Search logic
│   ├── cache.sh     # Cache operations
│   └── format.sh    # Output formatting
├── tests/
│   ├── test_search.bats
│   └── test_cache.bats
└── README.md
```

## Configuration Pattern: lib/config.sh

**Put all configuration in `lib/config.sh`** (no YAML/JSON config files):

```bash
# lib/config.sh
#!/usr/bin/env bash

readonly CACHE_DIR="${TOOL_NAME_CACHE_DIR:-${HOME}/.cache/tool-name}"
readonly CACHE_FILE="$CACHE_DIR/data.json"

# API configuration (secrets from env)
readonly API_ENDPOINT="${TOOL_NAME_API_ENDPOINT:-https://api.example.com}"
readonly API_KEY="${TOOL_NAME_API_KEY:?ERROR: TOOL_NAME_API_KEY not set}"
readonly API_TIMEOUT="${TOOL_NAME_TIMEOUT:-30}"

# Output
readonly DEFAULT_FORMAT="${TOOL_NAME_FORMAT:-compact}"

# Ensure cache dir exists
mkdir -p "$CACHE_DIR"
```

**Key principles**:

- Strict mode: `set -euo pipefail`
- Readonly constants: `readonly VAR="value"`
- Error handling: `die()`, `warn()`, `info()`
- Quote variables: `"$var"` not `$var`
- JSON with `jq`

## Common Patterns

### Cache-First Search

```bash
do_search() {
    local query="$1"

    # Try cache first
    if [[ -f "$CACHE_FILE" ]]; then
        cat "$CACHE_FILE" | jq --arg q "$query" '.data[] | select(.name | contains($q))'
        return
    fi

    # Fallback to API
    curl -s "$API_ENDPOINT/search?q=$query" | jq '.data[]'
}
```

### Format Routing

```bash
format_output() {
    local data="$1" fmt="${2:-compact}"

    case "$fmt" in
        compact) echo "$data" | jq -r '[.name, .type] | @tsv' ;;
        table)   {echo -e "NAME\tTYPE"; echo "$data" | jq -r '[.name, .type] | @tsv';} | column -t ;;
        json)    echo "$data" | jq -s '.' ;;
    esac
}
```

### Error Context

```bash
if ! curl -sf "$url" >/dev/null; then
    die "API unreachable ($url). Check network."
fi

[[ -f "$CACHE_FILE" ]] || die "Cache file not found ($CACHE_FILE). Run 'cache refresh'."
```

## Testing with BATS

```bash
#!/usr/bin/env bats

setup() {
    export MY_TOOL_CACHE_DIR=$(mktemp -d)
    mkdir -p "$MY_TOOL_CACHE_DIR"
}

teardown() {
    rm -rf "$MY_TOOL_CACHE_DIR"
}

@test "search requires query" {
    run ./my-tool search
    [[ "$status" -eq 1 ]]
    [[ "$output" == *"Search term required"* ]]
}

@test "search returns items" {
    cat > "$MY_TOOL_CACHE_DIR/data.json" <<EOF
{"data": [{"name": "test", "type": "app"}]}
EOF
    run ./my-tool search test --format json
    [[ "$status" -eq 0 ]]
    [[ "$output" == *"test"* ]]
}
```

Run tests: `bats tests/*.bats`

## Development Workflow

```bash
# Verify syntax
shellcheck my-tool lib/*.sh

# Run tests
bats tests/*.bats

# Install
chmod +x my-tool
cp my-tool ~/.local/bin/
```

## Best Practices

**Error handling**:

```bash
# Good
data=$(curl -sf "$url") || die "Failed to fetch"

# Good
set -euo pipefail

# Bad - no error checking
data=$(curl "$url")
```

**Quoting**:

```bash
# Good - preserves spaces
echo "$var"

# Bad - breaks on spaces
echo $var
```

**Constants**:

```bash
readonly API_ENDPOINT="${API_ENDPOINT:-https://api.example.com}"
readonly TIMEOUT="${TIMEOUT:-30}"
```

**JSON with jq**:

```bash
# Extract field
jq -r '.name' file.json

# Filter items
jq '.data[] | select(.status == "active")' file.json

# Count items
jq '[.data[]] | length' file.json

# Format as TSV
jq -r '[.name, .type] | @tsv' file.json
```

______________________________________________________________________

**See also**: [SKILL Reference](SKILL.md), [Design Patterns](design-patterns.md),
[Testing](testing.md)
