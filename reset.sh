#!/bin/bash
set -euo pipefail

# Reset script: Clean up Claude/Qwen configuration files
# Usage: ./reset.sh [--global] [--dry-run]

log()     { echo -e "\033[0;34m[INFO]\033[0m $1"; }
success() { echo -e "\033[0;32m[SUCCESS]\033[0m $1"; }
warn()    { echo -e "\033[1;33m[WARNING]\033[0m $1"; }
error()   { echo -e "\033[0;31m[ERROR]\033[0m $1"; exit 1; }

# Parse arguments
GLOBAL=false
DRY_RUN=false

show_help() {
    cat << 'EOF'
Reset script: Clean up Claude/Qwen configuration files

Usage: ./reset.sh [OPTIONS]

Options:
  --global      Also remove global configs (~/.claude, ~/.claude.json, ~/.config/*)
  --dry-run     Show what would be deleted without deleting
  --help        Show this help

Removes: .claude/, .serena/, .qwen/, .mcp.json
With --global: Also removes ~/.claude/, ~/.claude.json, ~/.config/claude/, ~/.qwen/, ~/.config/qwen/
EOF
    exit 0
}

for arg in "$@"; do
    case "$arg" in
        --global)  GLOBAL=true ;;
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

# Local files
log "Cleaning local files in: $(pwd)"
local_items=(".claude" ".serena" ".qwen" ".mcp.json")
local_count=$(clean_items local_items)
[[ $local_count -eq 0 ]] && log "No local files found" || success "Cleaned $local_count local items"

# Global files
if [[ "$GLOBAL" == true ]]; then
    if [[ "$DRY_RUN" == false ]]; then
        warn "This will remove global Claude/Qwen configurations!"
        read -p "Are you sure? (yes/no): " -r
        [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]] && { log "Skipping global cleanup"; exit 0; }
    fi

    log "Cleaning global files"
    global_items=("$HOME/.claude" "$HOME/.claude.json" "$HOME/.config/claude" "$HOME/.qwen" "$HOME/.config/qwen")
    global_count=$(clean_items global_items)
    [[ $global_count -eq 0 ]] && log "No global files found" || success "Cleaned $global_count global items"
else
    log "Tip: Use --global to also remove global configs"
fi

[[ "$DRY_RUN" == false ]] && success "✅ Reset complete!" || log "DRY RUN complete"
