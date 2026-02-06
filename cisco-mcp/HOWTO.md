# Cisco MCP Server - Installation and Testing Guide

This guide provides detailed step-by-step instructions for installing, configuring, and testing the Cisco MCP Server.

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Installation](#2-installation)
3. [Configuration](#3-configuration)
4. [Testing the Installation](#4-testing-the-installation)
5. [Integration with MCP Clients](#5-integration-with-mcp-clients)
6. [Verification Tests](#6-verification-tests)
7. [Troubleshooting](#7-troubleshooting)
8. [Maintenance](#8-maintenance)

---

## 1. Prerequisites

### 1.1 System Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| Python | 3.11 | 3.12+ |
| Memory | 256 MB | 512 MB |
| Disk Space | 100 MB | 200 MB |
| Network | Access to 10.253.16.0/24 | Low latency connection |

### 1.2 Network Access

Ensure your machine can reach the switch management network:

```bash
# Test connectivity to a switch
ping -c 3 10.253.16.28

# Expected output:
# PING 10.253.16.28 (10.253.16.28) 56(84) bytes of data.
# 64 bytes from 10.253.16.28: icmp_seq=1 ttl=254 time=0.5 ms
# ...
```

If ping fails:
- Check your network configuration
- Verify VPN connection (if required)
- Contact network administrator

### 1.3 SSH Key Setup

The MCP server uses SSH key authentication. Verify the key exists:

```bash
# Check if key exists
ls -la ~/.ssh/cisco-key

# Expected output:
# -rw------- 1 user user 1675 Oct 15 10:00 /home/user/.ssh/cisco-key
```

If the key doesn't exist, contact your network administrator to obtain it.

Verify key permissions:

```bash
# Key should be readable only by owner (600)
chmod 600 ~/.ssh/cisco-key

# Verify permissions
stat -c "%a %n" ~/.ssh/cisco-key
# Expected: 600 /home/user/.ssh/cisco-key
```

### 1.4 Test SSH Access Manually

Before installing the MCP server, verify SSH access works:

```bash
# Test SSH connection to a switch
ssh -i ~/.ssh/cisco-key -o ConnectTimeout=10 cisco-mcp@10.253.16.28 "show hostname"

# Expected output:
# LS3A-TIG-6A8-R200-DIVA.example.com
```

If SSH fails, see [Troubleshooting](#7-troubleshooting).

---

## 2. Installation

### 2.1 Clone/Access the Repository

The MCP server is located at `/opt/cisco-mcp`:

```bash
# Navigate to the project directory
cd /opt/cisco-mcp

# Verify files exist
ls -la

# Expected output:
# drwxr-xr-x  4 root root  4096 Dec 12 10:00 cisco_mcp
# -rw-r--r--  1 root root  1234 Dec 12 10:00 pyproject.toml
# -rw-r--r--  1 root root  5678 Dec 12 10:00 README.md
# -rw-r--r--  1 root root   890 Dec 12 10:00 switches.txt
# -rw-r--r--  1 root root 45678 Dec 12 10:00 network.MD
```

### 2.2 Activate Python Environment

A Python virtual environment is pre-configured:

```bash
# Activate the virtual environment
source /opt/venvs/python/bin/activate

# Verify Python version
python --version
# Expected: Python 3.12.x or higher

# Verify pip is available
pip --version
# Expected: pip 24.x from /opt/venvs/python/lib/...
```

### 2.3 Install the Package

Install the Cisco MCP server in development mode:

```bash
# Navigate to project directory
cd /opt/cisco-mcp

# Install in editable mode
pip install -e .

# Expected output (last few lines):
# Successfully built cisco-mcp
# Installing collected packages: ... cisco-mcp
# Successfully installed cisco-mcp-1.0.0 ...
```

### 2.4 Verify Installation

Confirm the package is installed correctly:

```bash
# Test import
python -c "from cisco_mcp.server import mcp; print(f'Server: {mcp.name}')"

# Expected output:
# Server: Cisco Network Manager
```

List installed dependencies:

```bash
pip list | grep -E "mcp|asyncssh|pydantic"

# Expected output:
# asyncssh         2.21.1
# mcp              1.23.3
# pydantic         2.12.5
```

---

## 3. Configuration

### 3.1 Switch Inventory

The switch inventory is stored in `switches.txt`. Verify it's correct:

```bash
cat /opt/cisco-mcp/switches.txt

# Expected format:
# # TIG Network Switch Inventory
# # Format: IP_ADDRESS    HOSTNAME    ROLE    RACK
#
# # --- Spine Switches ---
# 10.253.16.10    SS1-TIG-6A21    spine    6A21
# 10.253.16.11    SS2-TIG-6A21    spine    6A21
# ...
```

### 3.2 Verify Inventory Loading

Test that the inventory loads correctly:

```bash
python -c "
from cisco_mcp.inventory import get_inventory

inv = get_inventory()
inv.load()

print(f'Total switches: {len(inv.switches)}')
print(f'Spines: {len(inv.get_spines())}')
print(f'Leafs: {len(inv.get_tor_leafs())}')
print(f'Border Leafs: {len(inv.get_border_leafs())}')

print('\nSwitch list:')
for s in inv.switches:
    print(f'  {s.hostname:20} {s.ip:15} {s.role.value:8} {s.rack}')
"

# Expected output:
# Total switches: 14
# Spines: 2
# Leafs: 10
# Border Leafs: 2
#
# Switch list:
#   SS1-TIG-6A21         10.253.16.10    spine    6A21
#   SS2-TIG-6A21         10.253.16.11    spine    6A21
#   ...
```

### 3.3 SSH Configuration

Verify SSH settings in the code match your environment:

```bash
python -c "
from cisco_mcp.ssh_client import DEFAULT_SSH_KEY, DEFAULT_USERNAME, DEFAULT_TIMEOUT

print(f'SSH Key Path: {DEFAULT_SSH_KEY}')
print(f'Username: {DEFAULT_USERNAME}')
print(f'Timeout: {DEFAULT_TIMEOUT}s')
"

# Expected output:
# SSH Key Path: /root/.ssh/cisco-key (or /home/user/.ssh/cisco-key)
# Username: cisco-mcp
# Timeout: 30s
```

---

## 4. Testing the Installation

### 4.1 Test SSH Connectivity via Python

Test that the async SSH client works:

```bash
python << 'EOF'
import asyncio
from cisco_mcp.ssh_client import SSHConnectionPool
from cisco_mcp.inventory import get_inventory

async def test_ssh():
    inventory = get_inventory()
    inventory.load()

    # Test connection to first available switch
    switch = inventory.switches[0]
    print(f"Testing connection to {switch.hostname} ({switch.ip})...")

    async with SSHConnectionPool() as pool:
        try:
            output = await pool.execute_command(switch.ip, "show hostname")
            print(f"SUCCESS! Output: {output.strip()}")
        except Exception as e:
            print(f"FAILED: {e}")

asyncio.run(test_ssh())
EOF

# Expected output:
# Testing connection to SS1-TIG-6A21 (10.253.16.10)...
# SUCCESS! Output: SS1-TIG-6A21-R200-DIVA.example.com
```

### 4.2 Test Command Validation

Verify that only read-only commands are allowed:

```bash
python << 'EOF'
from cisco_mcp.ssh_client import validate_command, InvalidCommandError

# These should succeed (no exception)
allowed_commands = [
    "show version",
    "show ip ospf neighbors",
    "show running-config",
    "show interface brief",
    "display version",
]

print("Testing allowed commands:")
for cmd in allowed_commands:
    try:
        validate_command(cmd)
        print(f"  ✓ '{cmd}' - ALLOWED")
    except InvalidCommandError as e:
        print(f"  ✗ '{cmd}' - BLOCKED (unexpected!)")

# These should fail (raise exception)
blocked_commands = [
    "configure terminal",
    "copy running-config startup-config",
    "reload",
    "write memory",
    "no shutdown",
]

print("\nTesting blocked commands:")
for cmd in blocked_commands:
    try:
        validate_command(cmd)
        print(f"  ✗ '{cmd}' - ALLOWED (security issue!)")
    except InvalidCommandError:
        print(f"  ✓ '{cmd}' - BLOCKED")
EOF

# Expected output:
# Testing allowed commands:
#   ✓ 'show version' - ALLOWED
#   ✓ 'show ip ospf neighbors' - ALLOWED
#   ...
#
# Testing blocked commands:
#   ✓ 'configure terminal' - BLOCKED
#   ✓ 'copy running-config startup-config' - BLOCKED
#   ...
```

### 4.3 Test Output Parsers

Test that output parsers work correctly:

```bash
python << 'EOF'
import asyncio
from cisco_mcp.ssh_client import SSHConnectionPool
from cisco_mcp.inventory import get_inventory
from cisco_mcp.parsers import parse_ospf_neighbors

async def test_parser():
    inventory = get_inventory()
    inventory.load()

    # Get a leaf switch (should have OSPF neighbors)
    switch = inventory.get_switch_by_name("LS3a")
    if not switch:
        print("Switch LS3a not found!")
        return

    print(f"Testing OSPF parser on {switch.hostname}...")

    async with SSHConnectionPool() as pool:
        output = await pool.execute_command(switch.ip, "show ip ospf neighbors")
        result = parse_ospf_neighbors(output, switch.hostname)

        print(f"\nOSPF Neighbors Result:")
        print(f"  Total neighbors: {result.total_count}")
        print(f"  FULL neighbors: {result.full_count}")
        print(f"  Problem neighbors: {result.problem_count}")

        print(f"\nNeighbor details:")
        for n in result.neighbors:
            status = "✓" if n.is_healthy else "✗"
            print(f"  {status} {n.neighbor_id} on {n.interface} - {n.state}")

asyncio.run(test_parser())
EOF

# Expected output:
# Testing OSPF parser on LS3a-TIG-6A8...
#
# OSPF Neighbors Result:
#   Total neighbors: 2
#   FULL neighbors: 2
#   Problem neighbors: 0
#
# Neighbor details:
#   ✓ 192.168.0.1 on Eth1/29 - FULL/DR
#   ✓ 192.168.0.2 on Eth1/30 - FULL/BDR
```

### 4.4 Test MCP Server Components

Verify all MCP components are registered:

```bash
python << 'EOF'
from cisco_mcp.server import mcp

# List tools
tools = mcp._tool_manager.list_tools()
print(f"Registered Tools ({len(tools)}):")
for tool in tools:
    print(f"  - {tool.name}: {tool.description[:60]}...")

# List resources
resources = mcp._resource_manager.list_resources()
print(f"\nRegistered Resources ({len(resources)}):")
for resource in resources:
    print(f"  - {resource.uri}")

# List prompts
prompts = list(mcp._prompt_manager._prompts.keys())
print(f"\nRegistered Prompts ({len(prompts)}):")
for prompt in prompts:
    print(f"  - {prompt}")
EOF

# Expected output:
# Registered Tools (10):
#   - run_command: Execute a show command on a specific switch...
#   - run_command_all: Execute a show command on multiple switches...
#   - get_switch_status: Get quick health status of a switch...
#   ...
#
# Registered Resources (4):
#   - switch://inventory
#   - network://topology
#   - network://documentation
#   - network://ip-scheme
#
# Registered Prompts (3):
#   - fabric_health_check
#   - troubleshoot_connectivity
#   - switch_quick_check
```

---

## 5. Integration with MCP Clients

### 5.1 Add the MCP Server

Register the Cisco MCP server with your MCP client. Add to your MCP configuration:

```json
{
  "mcpServers": {
    "cisco-switches": {
      "command": "/opt/venvs/python/bin/python",
      "args": ["-m", "cisco_mcp.server"]
    }
  }
}
```

### 5.2 Run Manually

You can also run the server directly:

```bash
/opt/venvs/python/bin/python -m cisco_mcp.server
```

### 5.3 Test the Integration

Ask your AI agent:
- "List all switches in the network inventory"
- "Check the health of switch SS1"
- "Verify OSPF neighbors on LS3a"

---

## 6. Verification Tests

### 6.1 Comprehensive Test Script

Run this script to perform a full verification:

```bash
python << 'EOF'
#!/usr/bin/env python3
"""Comprehensive verification test for Cisco MCP Server."""

import asyncio
import sys

def print_header(text):
    print(f"\n{'='*60}")
    print(f" {text}")
    print('='*60)

def print_result(test_name, passed, details=""):
    status = "✓ PASS" if passed else "✗ FAIL"
    print(f"  {status}: {test_name}")
    if details and not passed:
        print(f"         {details}")

async def run_tests():
    results = []

    # Test 1: Import modules
    print_header("Test 1: Module Imports")
    try:
        from cisco_mcp.server import mcp
        from cisco_mcp.inventory import get_inventory
        from cisco_mcp.ssh_client import SSHConnectionPool, validate_command
        from cisco_mcp.models import Switch, SwitchRole
        from cisco_mcp.parsers import parse_ospf_neighbors
        print_result("All modules imported", True)
        results.append(True)
    except ImportError as e:
        print_result("Module import", False, str(e))
        results.append(False)
        return results

    # Test 2: Inventory loading
    print_header("Test 2: Inventory Loading")
    try:
        inventory = get_inventory()
        inventory.load()
        switch_count = len(inventory.switches)
        print_result(f"Loaded {switch_count} switches", switch_count > 0)
        results.append(switch_count > 0)

        # Check for specific switches
        ss1 = inventory.get_switch_by_name("SS1")
        print_result("Found SS1 by short name", ss1 is not None)
        results.append(ss1 is not None)

        ls3a = inventory.get_switch_by_name("LS3a")
        print_result("Found LS3a by short name", ls3a is not None)
        results.append(ls3a is not None)
    except Exception as e:
        print_result("Inventory loading", False, str(e))
        results.append(False)

    # Test 3: MCP components
    print_header("Test 3: MCP Components")
    try:
        tools = mcp._tool_manager.list_tools()
        print_result(f"Registered {len(tools)} tools", len(tools) == 10)
        results.append(len(tools) == 10)

        resources = mcp._resource_manager.list_resources()
        print_result(f"Registered {len(resources)} resources", len(resources) >= 4)
        results.append(len(resources) >= 4)

        prompts = list(mcp._prompt_manager._prompts.keys())
        print_result(f"Registered {len(prompts)} prompts", len(prompts) == 3)
        results.append(len(prompts) == 3)
    except Exception as e:
        print_result("MCP components", False, str(e))
        results.append(False)

    # Test 4: Command validation
    print_header("Test 4: Command Validation (Security)")
    try:
        # Should pass
        validate_command("show version")
        print_result("'show version' allowed", True)
        results.append(True)

        # Should fail
        try:
            validate_command("configure terminal")
            print_result("'configure terminal' blocked", False, "Should have been blocked!")
            results.append(False)
        except:
            print_result("'configure terminal' blocked", True)
            results.append(True)
    except Exception as e:
        print_result("Command validation", False, str(e))
        results.append(False)

    # Test 5: SSH connectivity
    print_header("Test 5: SSH Connectivity")
    try:
        switch = inventory.get_switch_by_name("LS3a")
        if switch:
            async with SSHConnectionPool() as pool:
                output = await asyncio.wait_for(
                    pool.execute_command(switch.ip, "show hostname"),
                    timeout=30
                )
                has_output = len(output.strip()) > 0
                print_result(f"SSH to {switch.hostname}", has_output)
                results.append(has_output)
        else:
            print_result("SSH connectivity", False, "No switch found")
            results.append(False)
    except asyncio.TimeoutError:
        print_result("SSH connectivity", False, "Connection timed out")
        results.append(False)
    except Exception as e:
        print_result("SSH connectivity", False, str(e))
        results.append(False)

    # Test 6: Output parsing
    print_header("Test 6: Output Parsing")
    try:
        switch = inventory.get_switch_by_name("LS3a")
        if switch:
            async with SSHConnectionPool() as pool:
                output = await pool.execute_command(switch.ip, "show ip ospf neighbors")
                result = parse_ospf_neighbors(output, switch.hostname)
                print_result(f"Parsed {result.total_count} OSPF neighbors", result.total_count > 0)
                results.append(result.total_count > 0)
        else:
            print_result("Output parsing", False, "No switch found")
            results.append(False)
    except Exception as e:
        print_result("Output parsing", False, str(e))
        results.append(False)

    return results

async def main():
    print("\n" + "="*60)
    print(" CISCO MCP SERVER - VERIFICATION TEST SUITE")
    print("="*60)

    results = await run_tests()

    # Summary
    print_header("TEST SUMMARY")
    passed = sum(results)
    total = len(results)
    print(f"\n  Tests Passed: {passed}/{total}")

    if passed == total:
        print("\n  ✓ ALL TESTS PASSED - Server is ready for use!")
        return 0
    else:
        print(f"\n  ✗ {total - passed} TEST(S) FAILED - Please review errors above")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
EOF
```

### 6.2 Quick Health Check

For a quick operational check:

```bash
python << 'EOF'
import asyncio
from cisco_mcp.ssh_client import SSHConnectionPool
from cisco_mcp.inventory import get_inventory

async def quick_check():
    inventory = get_inventory()
    inventory.load()

    print("Quick connectivity check...")

    # Test first 3 switches
    test_switches = inventory.switches[:3]

    async with SSHConnectionPool() as pool:
        for switch in test_switches:
            try:
                output = await asyncio.wait_for(
                    pool.execute_command(switch.ip, "show hostname"),
                    timeout=10
                )
                print(f"  ✓ {switch.hostname}: {output.strip()}")
            except Exception as e:
                print(f"  ✗ {switch.hostname}: {e}")

asyncio.run(quick_check())
EOF
```

---

## 7. Troubleshooting

### 7.1 SSH Connection Issues

#### Problem: "SSH key file not found"

```bash
# Solution: Verify key exists and has correct permissions
ls -la ~/.ssh/cisco-key
chmod 600 ~/.ssh/cisco-key
```

#### Problem: "Connection timed out"

```bash
# Solution 1: Check network connectivity
ping -c 3 10.253.16.28

# Solution 2: Check if SSH port is open
nc -zv 10.253.16.28 22

# Solution 3: Check for firewall issues
sudo iptables -L -n | grep 22
```

#### Problem: "Permission denied (publickey)"

```bash
# Solution 1: Verify key permissions
chmod 600 ~/.ssh/cisco-key

# Solution 2: Test with verbose SSH
ssh -v -i ~/.ssh/cisco-key cisco-mcp@10.253.16.28

# Solution 3: Verify username is correct
# Username should be: cisco-mcp
```

### 7.2 Python/Import Issues

#### Problem: "ModuleNotFoundError: No module named 'cisco_mcp'"

```bash
# Solution 1: Activate virtual environment
source /opt/venvs/python/bin/activate

# Solution 2: Reinstall package
cd /opt/cisco-mcp
pip install -e .
```

#### Problem: "ModuleNotFoundError: No module named 'mcp'"

```bash
# Solution: Install MCP SDK
pip install mcp
```

### 7.3 MCP Server Issues

#### Problem: Server not responding

```bash
# Solution 1: Run server manually to see errors
python -m cisco_mcp.server

# Solution 2: Check for Python errors
python -c "from cisco_mcp.server import mcp"
```

#### Problem: "Command not allowed"

```bash
# This is expected for non-show commands!
# Only 'show' commands are allowed for security.
# Use commands like: show version, show ip ospf neighbors
```

### 7.4 Inventory Issues

#### Problem: "Switch not found"

```bash
# Solution 1: Check switch name spelling
cat /opt/cisco-mcp/switches.txt | grep -i <switch_name>

# Solution 2: Use short name (e.g., 'SS1' instead of 'SS1-TIG-6A21')
python -c "
from cisco_mcp.inventory import get_inventory
inv = get_inventory()
inv.load()
print([s.hostname for s in inv.switches])
"
```

---

## 8. Maintenance

### 8.1 Updating Switch Inventory

To add or remove switches, edit `switches.txt`:

```bash
# Edit inventory
nano /opt/cisco-mcp/switches.txt

# Format:
# IP_ADDRESS    HOSTNAME    ROLE    RACK
# 10.253.16.30  NEW-SWITCH  leaf    6A9
```

### 8.2 Updating the Package

After code changes:

```bash
# Reinstall in development mode
cd /opt/cisco-mcp
pip install -e .
```

### 8.3 Viewing Logs

For debugging, run the server manually:

```bash
# Run with debug output
python -m cisco_mcp.server 2>&1 | tee /tmp/mcp-debug.log
```

### 8.4 Checking Version

```bash
python -c "from cisco_mcp import __version__; print(f'Version: {__version__}')"
```

---

## Quick Reference Card

### Common Commands

| Task | Command |
|------|---------|
| Activate environment | `source /opt/venvs/python/bin/activate` |
| Install package | `cd /opt/cisco-mcp && pip install -e .` |
| Test imports | `python -c "from cisco_mcp.server import mcp"` |
| Add to MCP config | See Section 5.1 for MCP client configuration |
| Run manually | `python -m cisco_mcp.server` |
| Test SSH | `ssh -i ~/.ssh/cisco-key cisco-mcp@10.253.16.28 "show hostname"` |

### Switch Short Names

| Short Name | Full Hostname | IP |
|------------|---------------|-----|
| SS1 | SS1-TIG-6A21 | 10.253.16.10 |
| SS2 | SS2-TIG-6A21 | 10.253.16.11 |
| LS3a | LS3a-TIG-6A8 | 10.253.16.28 |
| LS4a | LS4a-TIG-6A8 | 10.253.16.29 |
| BL1a | BL1a-TIG-6A8 | 10.253.16.12 |
| BL1b | BL1b-TIG-6A8 | 10.253.16.13 |

### Example Prompts

- "List all switches in the inventory"
- "Check OSPF neighbors on SS1"
- "Verify BGP EVPN on all spine switches"
- "Show vPC status on LS1a-6A7"
- "Run 'show interface brief' on BL1a"
- "Are there any interface errors on switches in rack 6A8?"

---

*Document Version: 1.0*
*Last Updated: December 2025*
