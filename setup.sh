#!/bin/bash
set -euo pipefail

# Unified setup: tools and MCP services

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK_DIR="$(pwd)"
CONFIG_FILE="$SCRIPT_DIR/mcp_config.toml"

# Logging
log()     { echo -e "\033[0;34m[INFO]\033[0m $1"; }
success() { echo -e "\033[0;32m[SUCCESS]\033[0m $1"; }
warn()    { echo -e "\033[1;33m[WARNING]\033[0m $1"; }
error()   { echo -e "\033[0;31m[ERROR]\033[0m $1"; exit 1; }

# Load .env if exists (try repo first, then home)
if [[ -f "$SCRIPT_DIR/.env" ]]; then
    set -a; source "$SCRIPT_DIR/.env"; set +a
elif [[ -f "$HOME/.env" ]]; then
    set -a; source "$HOME/.env"; set +a
fi

command_exists() { command -v "$1" >/dev/null 2>&1; }

# ============================================================================
# TOOLS
# ============================================================================

install_tool() {
    local tool_dir="$1"
    local name=$(basename "$tool_dir")

    # Silently skip directories without pyproject.toml (not Python tools)
    [[ ! -f "$tool_dir/pyproject.toml" ]] && return

    log "Installing $name..."
    (cd "$tool_dir" && uv tool install -e . --force)
    success "$name installed"
}

install_all_tools() {
    log "Installing UV tools in: $SCRIPT_DIR"
    log "========================================"

    # Skip: hidden dirs, config dirs, templates (tool-sample), and shared libraries (mcp-base)
    local skip_dirs=(".git" "genAI" "mcp-base" "tool-sample" "images")
    for dir in "$SCRIPT_DIR"/*; do
        [[ ! -d "$dir" ]] && continue
        local name=$(basename "$dir")
        [[ " ${skip_dirs[@]} " =~ " $name " ]] && continue
        install_tool "$dir"
    done

    success "All tools installed!"
}

# ============================================================================
# MCP CONFIG
# ============================================================================

get_toml_value() {
    local key="$1" default="${2:-}"
    [[ ! -f "$CONFIG_FILE" ]] && { echo "$default"; return; }

    local section="${key%.*}" key_name="${key##*.}"

    awk -v section="[$section]" -v key_name="$key_name" '
    BEGIN {
        in_section = 0
        in_multiline = 0
        found_key = 0
        value = ""
        printed = 0
    }
    /^\[/ {
        if (in_multiline && in_section && found_key) {
            gsub(/^[ \t]+|[ \t]+$/, "", value)
            gsub(/^"|"$/, "", value)
            print value
            printed = 1
            exit
        }
        in_section = ($0 == section)
        next
    }
    /^[ \t]*#/ || /^[ \t]*$/ { next }
    in_section && /=/ && !in_multiline && !found_key {
        idx = index($0, "=")
        k = substr($0, 1, idx - 1)
        v = substr($0, idx + 1)
        gsub(/^[ \t]+|[ \t]+$/, "", k)
        gsub(/^[ \t]+|[ \t]+$/, "", v)

        if (k == key_name) {
            found_key = 1
            if (v ~ /^"""/) {
                in_multiline = 1
                value = substr(v, 4)
                if (value ~ /\\$/) {
                    value = substr(value, 1, length(value) - 1)
                }
            } else {
                gsub(/^"|"$/, "", v)
                print v
                printed = 1
                exit
            }
        }
        next
    }
    in_section && in_multiline && found_key {
        line = $0
        gsub(/^[ \t]+/, "", line)
        if (line ~ /"""$/) {
            value = value substr(line, 1, length(line) - 3)
            gsub(/^[ \t]+|[ \t]+$/, "", value)
            gsub(/^"|"$/, "", value)
            print value
            printed = 1
            exit
        } else {
            if (line ~ /\\$/) {
                line = substr(line, 1, length(line) - 1)
            }
            value = value " " line
        }
    }
    END {
        if (in_multiline && found_key && value != "" && printed == 0) {
            gsub(/^[ \t]+|[ \t]+$/, "", value)
            gsub(/^"|"$/, "", value)
            print value
        }
    }
    ' "$CONFIG_FILE"
}

validate_env_vars() {
    local service="$1"
    local vars=$(get_toml_value "services.$service.env_vars")
    [[ -z "$vars" || "$vars" == "[]" ]] && return 0

    vars=$(echo "$vars" | tr -d '[]"' | tr ',' ' ')
    for var in $vars; do
        [[ -z "${!var:-}" ]] && { warn "Missing env var: $var for service $service"; return 1; }
    done
    return 0
}

get_enabled_services() {
    grep -E '^\[services\.' "$CONFIG_FILE" | sed 's/^\[services\.\(.*\)\]$/\1/' | while read svc; do
        [[ "$(get_toml_value "services.$svc.enabled")" == "true" ]] && echo "$svc"
    done
}

get_all_services() {
    grep -E '^\[services\.' "$CONFIG_FILE" | sed 's/^\[services\.\(.*\)\]$/\1/'
}

# ============================================================================
# CONFIGURE MCP SERVICES
# ============================================================================

toggle_service() {
    local service="$1"
    local current=$(get_toml_value "services.$service.enabled")

    if [[ "$current" == "true" ]]; then
        sed -i "/^\[services\.$service\]/,/^\[/{s/enabled = true/enabled = false/}" "$CONFIG_FILE"
        log "Disabled: $service"
    else
        sed -i "/^\[services\.$service\]/,/^\[/{s/enabled = false/enabled = true/}" "$CONFIG_FILE"
        log "Enabled: $service"
    fi
}

configure_services() {
    log "========================================"
    log "MCP Services Configuration"
    log "========================================"
    echo

    [[ ! -f "$CONFIG_FILE" ]] && { error "Config not found: $CONFIG_FILE"; }

    while true; do
        local services=($(get_all_services))
        local i=1

        echo "Current MCP services:"
        echo "---------------------"
        for svc in "${services[@]}"; do
            local enabled=$(get_toml_value "services.$svc.enabled")
            local desc=$(get_toml_value "services.$svc.description")
            local status="[OFF]"
            [[ "$enabled" == "true" ]] && status="[ON] "
            printf "  %2d. %s %-25s - %s\n" "$i" "$status" "$svc" "${desc:-No description}"
            ((i++))
        done

        echo
        echo "Commands:"
        echo "  Enter number (1-${#services[@]}) to toggle service"
        echo "  'a' - Enable all services"
        echo "  'd' - Disable all services"
        echo "  'q' - Save and quit"
        echo

        read -p "Choice: " choice

        case "$choice" in
            [0-9]*)
                if [[ "$choice" -ge 1 && "$choice" -le ${#services[@]} ]]; then
                    toggle_service "${services[$((choice-1))]}"
                else
                    warn "Invalid number. Enter 1-${#services[@]}"
                fi
                ;;
            a|A)
                for svc in "${services[@]}"; do
                    sed -i "/^\[services\.$svc\]/,/^\[/{s/enabled = false/enabled = true/}" "$CONFIG_FILE"
                done
                success "All services enabled"
                ;;
            d|D)
                for svc in "${services[@]}"; do
                    sed -i "/^\[services\.$svc\]/,/^\[/{s/enabled = true/enabled = false/}" "$CONFIG_FILE"
                done
                success "All services disabled"
                ;;
            q|Q)
                success "Configuration saved"
                return 0
                ;;
            *)
                warn "Invalid choice"
                ;;
        esac
        echo
    done
}

# ============================================================================
# MAIN
# ============================================================================

show_help() {
    cat << 'EOF'
Unified setup for infrastructure tools

Usage: ./setup.sh [OPTIONS]

Options:
  --help              Show this help
  --tools-only        Install Python tools only
  --list-services     List available MCP services
  --configure         Interactive MCP service configuration
  --all (default)     Install tools and show status

Prerequisites:
  - Python 3.10+
  - uv (https://docs.astral.sh/uv/)
  - Node.js 20+ (for perf-mcp)
EOF
}

main() {
    local task="${1:---all}"

    case "$task" in
        --help|-h)
            show_help
            ;;
        --list-services)
            log "Available services:"
            get_enabled_services | while read svc; do
                desc=$(get_toml_value "services.$svc.description")
                echo "  - $svc: ${desc:-No description}"
            done
            ;;
        --tools-only)
            install_all_tools
            ;;
        --configure)
            configure_services
            ;;
        --all|"")
            log "Starting setup..."
            echo
            install_all_tools
            echo
            success "Setup complete!"
            echo
            log "========================================"
            log "Installed tools:"
            log "========================================"
            if command_exists uv; then
                uv tool list 2>/dev/null | head -20
            fi
            echo
            log "========================================"
            log "perf-mcp (Node.js MCP Server):"
            log "========================================"
            if command_exists node; then
                log "Node.js detected: $(node --version)"
                log "To build perf-mcp: cd perf-mcp && npm install && npm run build"
            else
                warn "Node.js not installed - required for perf-mcp"
                log "Install Node.js 22.x by running: ./perf-mcp/setup-node.sh"
            fi
            ;;
        *)
            error "Unknown option: $task"
            ;;
    esac
}

main "$@"
