#!/bin/bash
set -euo pipefail

# Reset script: Clean up configuration files
# Usage: ./reset.sh [--dry-run]

log()     { echo -e "\033[0;34m[INFO]\033[0m $1"; }
success() { echo -e "\033[0;32m[SUCCESS]\033[0m $1"; }
warn()    { echo -e "\033[1;33m[WARNING]\033[0m $1"; }
error()   { echo -e "\033[0;31m[ERROR]\033[0m $1"; exit 1; }

# Parse arguments
DRY_RUN=false

show_help() {
    cat << 'EOF'
Reset script: Clean up generated configuration files

Usage: ./reset.sh [OPTIONS]

Options:
  --dry-run     Show what would be deleted without deleting
  --help        Show this help

Removes: .env, node_modules, dist, __pycache__, *.egg-info, .pytest_cache
EOF
    exit 0
}

for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=true ;;
        --help|-h) show_help ;;
        *) error "Unknown option: $arg. Use --help for usage." ;;
    esac
done

# Remove item with optional dry-run
remove_item() {
    local item="$1"
    [[ ! -e "$item" ]] && return 0

    if [[ "$DRY_RUN" == true ]]; then
        log "[DRY RUN] Would remove: $item" >&2
    else
        log "Removing: $item" >&2
        rm -rf "$item"
    fi
}

# Clean items from a list
clean_items() {
    local -n items=$1
    local count=0

    for item in "${items[@]}"; do
        [[ -e "$item" ]] && { remove_item "$item"; ((count++)); }
    done

    echo "$count"
}

# Main
[[ "$DRY_RUN" == true ]] && warn "DRY RUN MODE - No files will be deleted"

log "Cleaning generated files in: $(pwd)"
local_items=("perf-mcp/node_modules" "perf-mcp/dist")
local_count=$(clean_items local_items)
[[ $local_count -eq 0 ]] && log "No generated files found" || success "Cleaned $local_count items"

[[ "$DRY_RUN" == false ]] && success "Reset complete!" || log "DRY RUN complete"
