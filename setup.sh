#!/bin/bash
set -euo pipefail

# Unified setup: tools, MCP services, agents, skills - run from any directory

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

# ============================================================================
# BEDROCK PREREQUISITES
# ============================================================================

command_exists() { command -v "$1" >/dev/null 2>&1; }

install_unzip() {
    log "Installing unzip..."
    if command_exists apt-get; then
        sudo apt-get update && sudo apt-get install -y unzip
    elif command_exists yum; then
        sudo yum install -y unzip
    elif command_exists dnf; then
        sudo dnf install -y unzip
    elif command_exists pacman; then
        sudo pacman -S --noconfirm unzip
    elif command_exists brew; then
        brew install unzip
    else
        error "Cannot install unzip: unknown package manager. Please install manually."
    fi
    success "unzip installed"
}

install_aws_cli() {
    log "Installing AWS CLI v2..."

    # Ensure unzip is available
    if ! command_exists unzip; then
        install_unzip
    fi

    local tmp_dir=$(mktemp -d)
    cd "$tmp_dir"

    # Detect architecture
    local arch=$(uname -m)
    local url="https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip"
    if [[ "$arch" == "aarch64" || "$arch" == "arm64" ]]; then
        url="https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip"
    fi

    log "Downloading AWS CLI from $url..."
    curl -fsSL "$url" -o "awscliv2.zip"
    unzip -q awscliv2.zip

    log "Installing AWS CLI (requires sudo)..."
    sudo ./aws/install --update

    # Cleanup
    cd - > /dev/null
    rm -rf "$tmp_dir"

    # Verify installation
    if command_exists aws; then
        success "AWS CLI installed: $(aws --version)"
    else
        error "AWS CLI installation failed"
    fi
}

get_shell_profile() {
    # Determine the appropriate shell profile
    if [[ -n "${ZSH_VERSION:-}" ]] || [[ "$SHELL" == *"zsh"* ]]; then
        echo "$HOME/.zshrc"
    else
        echo "$HOME/.bashrc"
    fi
}

add_to_shell_profile() {
    local var_name="$1"
    local var_value="$2"
    local profile=$(get_shell_profile)
    # Quote the value for the profile file (handles spaces/special chars)
    local export_line="export ${var_name}=\"${var_value}\""

    # Check if already in profile
    if ! grep -q "^export ${var_name}=" "$profile" 2>/dev/null; then
        echo "" >> "$profile"
        echo "# Added by peter-mcp setup.sh" >> "$profile"
        echo "$export_line" >> "$profile"
        log "Added to $profile: $export_line"
    fi

    # Export for current session (direct assignment, no extra quoting)
    export "$var_name=$var_value"
}

check_bedrock_prerequisites() {
    log "========================================"
    log "Checking Bedrock prerequisites"

    local missing_prereqs=()
    local profile=$(get_shell_profile)

    # Check AWS CLI
    if ! command_exists aws; then
        warn "AWS CLI not found"
        read -p "Install AWS CLI? [y/N] " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            install_aws_cli
        else
            missing_prereqs+=("aws-cli")
        fi
    else
        success "AWS CLI found: $(aws --version 2>&1 | head -1)"
    fi

    # Check AWS credentials
    if [[ ! -f "$HOME/.aws/credentials" ]]; then
        warn "AWS credentials not found at ~/.aws/credentials"
        warn "Run 'aws configure' to set up credentials"
        missing_prereqs+=("aws-credentials")
    else
        success "AWS credentials file found"
        # Check if credentials are valid (basic check)
        if aws sts get-caller-identity &>/dev/null; then
            success "AWS credentials are valid"
        else
            warn "AWS credentials may be invalid or expired"
            warn "Run 'aws configure' or check your credentials"
        fi
    fi

    # Set Bedrock environment variables automatically
    if [[ -z "${CLAUDE_CODE_USE_BEDROCK:-}" ]]; then
        log "Setting CLAUDE_CODE_USE_BEDROCK=1"
        add_to_shell_profile "CLAUDE_CODE_USE_BEDROCK" "1"
        success "CLAUDE_CODE_USE_BEDROCK=1 (auto-configured)"
    else
        success "CLAUDE_CODE_USE_BEDROCK=$CLAUDE_CODE_USE_BEDROCK"
    fi

    if [[ -z "${ANTHROPIC_MODEL:-}" ]]; then
        local default_model="us.anthropic.claude-opus-4-5-20251101-v1:0"
        log "Setting ANTHROPIC_MODEL to default (Opus 4.5)"
        add_to_shell_profile "ANTHROPIC_MODEL" "$default_model"
        success "ANTHROPIC_MODEL=$default_model (auto-configured)"
    else
        success "ANTHROPIC_MODEL=$ANTHROPIC_MODEL"
    fi

    # Summary
    echo
    if [[ ${#missing_prereqs[@]} -gt 0 ]]; then
        warn "Missing prerequisites: ${missing_prereqs[*]}"
        echo
        if [[ " ${missing_prereqs[*]} " =~ " aws-credentials " ]]; then
            log "Run 'aws configure' to set up AWS credentials"
        fi
        echo
        read -p "Continue anyway? [y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            error "Setup aborted. Please configure prerequisites first."
        fi
    else
        success "All Bedrock prerequisites met!"
    fi
}

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
    local skip_dirs=(".git" ".claude" ".qwen" ".serena" "genAI" "mcp-base" "tool-sample")
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
            # End of section reached while in multiline, finalize value
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
            # Check if this is a multiline string
            if (v ~ /^"""/) {
                in_multiline = 1
                value = substr(v, 4)  # Remove opening """
                # Remove trailing backslash if present
                if (value ~ /\\$/) {
                    value = substr(value, 1, length(value) - 1)
                }
            } else {
                # Single line value
                gsub(/^"|"$/, "", v)
                print v
                printed = 1
                exit
            }
        }
        next
    }
    in_section && in_multiline && found_key {
        # Inside multiline string for the correct key
        line = $0
        gsub(/^[ \t]+/, "", line)  # Remove leading indentation

        # Check for closing """
        if (line ~ /"""$/) {
            value = value substr(line, 1, length(line) - 3)  # Remove closing """
            gsub(/^[ \t]+|[ \t]+$/, "", value)
            gsub(/^"|"$/, "", value)
            print value
            printed = 1
            exit
        } else {
            # Remove trailing backslash if present and continue
            if (line ~ /\\$/) {
                line = substr(line, 1, length(line) - 1)
            }
            value = value " " line
        }
    }
    END {
        # If we reach end of file in multiline, print what we have
        # Only print if we haven not already printed the value
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

# Generate .mcp.json in working directory
generate_mcp_json() {
    log "========================================"
    log "Generating .mcp.json in $WORK_DIR"

    [[ ! -f "$CONFIG_FILE" ]] && { warn "Config not found: $CONFIG_FILE"; return 0; }

    local services=($(get_enabled_services))
    [[ ${#services[@]} -eq 0 ]] && { warn "No enabled services"; return 0; }

    log "Found ${#services[@]} enabled services: ${services[*]}"

    # Validate environment variables for all enabled services
    local invalid_services=()
    for svc in "${services[@]}"; do
        if ! validate_env_vars "$svc"; then
            invalid_services+=("$svc")
        fi
    done

    if [[ ${#invalid_services[@]} -gt 0 ]]; then
        warn "Services with missing env vars: ${invalid_services[*]}"
        warn "These services may not work correctly. Set missing env vars or disable them in mcp_config.toml"
    fi

    # Use Python to generate MCP JSON with proper command parsing
    SERVICES="${services[*]}" CONFIG_FILE="$CONFIG_FILE" WORK_DIR="$WORK_DIR" SCRIPT_DIR="$SCRIPT_DIR" python3 - << 'PYTHON'
import json, shlex, os, re

services = os.environ["SERVICES"].split()
config_file = os.environ["CONFIG_FILE"]

# Simple TOML parser for command values
def get_toml_command(file_path, service):
    with open(file_path) as f:
        in_section = in_ml = False
        parts = []

        for line in f:
            s = line.strip()
            if s == f"[services.{service}]": in_section = True; continue
            elif s.startswith("[") and in_section: break
            if not in_section: continue

            if s.startswith("command") and not in_ml:
                if '"""' in line:
                    in_ml = True
                    content = line.split('"""', 1)[1].strip()
                    if content.endswith('"""'): return content[:-3].strip()
                    if content.endswith('\\'): content = content[:-1].strip()
                    if content: parts.append(content)
                else:
                    match = re.search(r'command\s*=\s*"(.+)"', line)
                    if match: return match.group(1)
            elif in_ml:
                if s.endswith('"""'):
                    content = s[:-3].strip()
                    if content.endswith('\\'): content = content[:-1].strip()
                    if content: parts.append(content)
                    return ' '.join(parts)
                else:
                    if s.endswith('\\'): s = s[:-1].strip()
                    if s: parts.append(s)
    return None

mcp_servers = {}
unreplaced_vars = {}
for svc in services:
    cmd = get_toml_command(config_file, svc)
    if not cmd:
        continue

    # Replace placeholders and env vars
    work_dir = os.environ["WORK_DIR"]
    script_dir = os.environ.get("SCRIPT_DIR", "")
    cmd = cmd.replace("{CURRENT_DIR}", work_dir)
    cmd = cmd.replace("{SCRIPT_DIR}", script_dir)

    # Find all unreplaced variables (exclude special runtime variables like workspaceFolder)
    runtime_vars = {'workspaceFolder', 'workspace', 'workspaceRoot'}
    svc_unreplaced = []
    for match in re.finditer(r'\{(\w+)\}', cmd):
        var_name = match.group(1)
        val = os.environ.get(var_name, '')
        if val:
            cmd = cmd.replace(match.group(0), val)
        elif var_name not in runtime_vars:
            svc_unreplaced.append(var_name)

    if svc_unreplaced:
        unreplaced_vars[svc] = svc_unreplaced

    # Parse command with proper shell quoting
    parts = shlex.split(cmd)
    mcp_servers[svc] = {"command": parts[0], "args": parts[1:]}

output_file = os.path.join(os.environ["WORK_DIR"], ".mcp.json")
with open(output_file, "w") as f:
    json.dump({"mcpServers": mcp_servers}, f, indent=2)

# Write unreplaced vars to stderr for the shell script to pick up
if unreplaced_vars:
    import sys
    for svc, vars in unreplaced_vars.items():
        print(f"WARNING: Service '{svc}' has unreplaced variables: {', '.join(vars)}", file=sys.stderr)

print(len(mcp_servers))
PYTHON

    local count=$?
    [[ ! -f "$WORK_DIR/.mcp.json" ]] && { warn "Failed to generate .mcp.json"; return 1; }

    chmod 644 "$WORK_DIR/.mcp.json"
    success "Generated .mcp.json with $(jq '.mcpServers | length' "$WORK_DIR/.mcp.json") services"
}

setup_mcp_services() {
    generate_mcp_json

    # Apply MCP configuration with qwen-mcp-manager
    if [[ -f "$WORK_DIR/.mcp.json" ]] && command_exists npx; then
        log "Applying MCP configuration with qwen-mcp-manager..."
        if npx -y qwen-mcp-manager apply --file "$WORK_DIR/.mcp.json" 2>/dev/null; then
            success "MCP configuration applied"
        else
            warn "qwen-mcp-manager apply failed (may not be critical)"
        fi
    fi
}

# ============================================================================
# CLAUDE CONFIG
# ============================================================================

ensure_gitignore() {
    local gitignore
    gitignore="$(cd "$WORK_DIR" && git rev-parse --show-toplevel 2>/dev/null)/.gitignore" || gitignore=""
    [[ -z "$gitignore" || "$gitignore" == "/.gitignore" ]] && gitignore="$WORK_DIR/.gitignore"

    [[ ! -f "$gitignore" ]] && touch "$gitignore"

    local missing=()
    for entry in ".claude/" ".serena/" ".qwen/" ".mcp.json"; do
        grep -q "^${entry}$" "$gitignore" || missing+=("$entry")
    done

    [[ ${#missing[@]} -eq 0 ]] && { log ".claude, .qwen, .serena, .mcp.json already in .gitignore"; return; }

    log "Appending missing entries: ${missing[*]}"
    for entry in "${missing[@]}"; do
        echo "$entry" >> "$gitignore"
    done

    success "Updated .gitignore"
}

copy_dir() {
    local src="$1" dst="$2" desc="$3"

    [[ ! -d "$src" ]] && { warn "$desc not found: $src"; return 1; }

    mkdir -p "$dst"
    log "Copying $desc..."
    cp -r "$src"/* "$dst/" && success "Copied $desc" || { warn "Failed to copy $desc"; return 1; }
}

setup_claude_config() {
    log "========================================"
    log "Setting up Claude config in $WORK_DIR"

    # Create required directories
    mkdir -p "$WORK_DIR/.claude" "$WORK_DIR/.qwen" "$WORK_DIR/.serena"

    ensure_gitignore

    copy_dir "$SCRIPT_DIR/genAI/agents" "$WORK_DIR/.claude/agents" "agents" || true
    copy_dir "$SCRIPT_DIR/genAI/skills" "$WORK_DIR/.claude/skills" "skills" || true
    copy_dir "$SCRIPT_DIR/genAI/commands" "$WORK_DIR/.claude/commands" "commands" || true
}

# ============================================================================
# CONFIGURE MCP SERVICES
# ============================================================================

get_all_services() {
    grep -E '^\[services\.' "$CONFIG_FILE" | sed 's/^\[services\.\(.*\)\]$/\1/'
}

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
        echo "  'r' - Regenerate .mcp.json without quitting"
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
            r|R)
                generate_mcp_json
                ;;
            q|Q)
                generate_mcp_json
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
Unified setup for tools, MCP services, agents, skills (with Bedrock support)

Usage: ./setup.sh [OPTIONS]

Options:
  --help              Show this help
  --check-prereqs     Check Bedrock prerequisites only
  --tools-only        Install tools only
  --mcp-only          Setup MCP services only
  --claude-only       Setup Claude config only
  --list-services     List available services
  --configure         Interactive MCP service configuration
  --all (default)     Run all tasks (includes prereq check)

Bedrock Environment Variables:
  CLAUDE_CODE_USE_BEDROCK=1
  ANTHROPIC_MODEL='us.anthropic.claude-opus-4-5-20251101-v1:0'

Prerequisites:
  - AWS CLI v2 (will be installed if missing)
  - AWS credentials (~/.aws/credentials)
  - unzip (will be installed if missing for AWS CLI)
EOF
}

main() {
    local task="${1:---all}"

    case "$task" in
        --help|-h)
            show_help
            ;;
        --check-prereqs)
            check_bedrock_prerequisites
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
        --mcp-only)
            setup_mcp_services
            ;;
        --claude-only)
            setup_claude_config
            ;;
        --configure)
            configure_services
            ;;
        --all|"")
            log "Starting unified setup..."
            echo
            check_bedrock_prerequisites
            echo
            install_all_tools
            echo
            setup_mcp_services
            echo
            setup_claude_config
            echo
            success "Setup complete!"
            log "Generated .mcp.json - Claude Code will auto-detect it"
            echo
            log "========================================"
            log "Connected MCP Servers:"
            log "========================================"
            if [[ -f "$WORK_DIR/.mcp.json" ]]; then
                jq -r '.mcpServers | keys[]' "$WORK_DIR/.mcp.json" | while read svc; do
                    desc=$(get_toml_value "services.$svc.description")
                    echo "  ✓ $svc - ${desc:-No description}"
                done
            fi
            echo
            log "Run './setup.sh --configure' to enable/disable services"
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
