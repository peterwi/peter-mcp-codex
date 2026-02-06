# Cisco MCP Server

A Model Context Protocol (MCP) server for managing Cisco NX-OS switches in a VXLAN/EVPN data center fabric. This server enables AI agents to interact with network infrastructure through natural language, providing network monitoring, troubleshooting, and verification capabilities.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Network Environment](#network-environment)
- [Tools Reference](#tools-reference)
- [Resources Reference](#resources-reference)
- [Prompts Reference](#prompts-reference)
- [Security](#security)
- [Quick Start](#quick-start)
- [Example Conversations](#example-conversations)
- [Troubleshooting](#troubleshooting)

## Overview

The Cisco MCP Server bridges the gap between natural language AI interactions and network infrastructure management. Built on the Model Context Protocol specification, it allows AI agents to:

- Execute read-only commands on Cisco NX-OS switches
- Verify protocol states (OSPF, BGP EVPN, vPC, VXLAN)
- Monitor interface health and error counters
- Retrieve and compare configurations
- Provide structured, parseable output for complex analysis

### Key Principles

1. **Read-Only Operations**: Only `show` commands are permitted. No configuration changes can be made through this server.
2. **Structured Output**: All tools return Pydantic-validated structured data alongside raw command output.
3. **Connection Pooling**: SSH connections are pooled for efficient multi-switch operations.
4. **Security First**: Command validation, sensitive data masking, and SSH key authentication.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         MCP Client                              │
│                    (MCP Client / AI Assistant)                   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ MCP Protocol (stdio)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Cisco MCP Server                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Tools     │  │  Resources  │  │   Prompts   │              │
│  │  (10 ops)   │  │  (5 URIs)   │  │ (3 templates)│             │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              SSH Connection Pool                         │    │
│  │         (Async, Concurrent, Auto-reconnect)             │    │
│  └─────────────────────────────────────────────────────────┘    │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Output Parsers                              │    │
│  │    OSPF │ BGP │ vPC │ NVE │ Interface                   │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ SSH (Key-based Auth)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TIG Network Fabric                            │
│                                                                  │
│   ┌─────────┐                              ┌─────────┐          │
│   │  SS1    │◄────── Spine Layer ────────►│  SS2    │          │
│   │ (Spine) │      Route Reflectors        │ (Spine) │          │
│   └────┬────┘                              └────┬────┘          │
│        │           400G ECMP Links              │               │
│   ┌────┴────────────────┬───────────────────────┴────┐          │
│   │                     │                            │          │
│   ▼                     ▼                            ▼          │
│ ┌─────┐ ┌─────┐   ┌─────┐ ┌─────┐   ┌─────┐ ┌─────┐           │
│ │LS1a │═│LS1b │   │LS1a │═│LS1b │   │BL1a │═│BL1b │           │
│ │6A4  │ │6A4  │   │6A7  │ │6A7  │   │6A8  │ │6A8  │           │
│ └─────┘ └─────┘   └─────┘ └─────┘   └─────┘ └─────┘           │
│    vPC Pairs         vPC Pairs        Border Leafs             │
│                                                                  │
│              + LS3a-6A8, LS4a-6A8 (Additional Leafs)           │
└─────────────────────────────────────────────────────────────────┘
```

## Features

### Tools (10 Total)

| Category | Tool | Description |
|----------|------|-------------|
| **Command Execution** | `run_command` | Execute a show command on a specific switch |
| | `run_command_all` | Execute a command across multiple switches concurrently |
| **Health Monitoring** | `get_switch_status` | Get quick health status (uptime, version, model) |
| | `list_switches` | List all switches in inventory |
| **Protocol Verification** | `verify_ospf_neighbors` | Check OSPF adjacencies are in FULL state |
| | `verify_bgp_evpn` | Verify BGP EVPN sessions are Established |
| | `verify_vpc_status` | Check vPC domain health |
| | `verify_nve_peers` | Verify VXLAN tunnel endpoints are Up |
| **Diagnostics** | `check_interface_errors` | Check interface error counters |
| | `get_running_config` | Retrieve running configuration |

### Resources (5 Total)

| URI | Description |
|-----|-------------|
| `switch://inventory` | Complete switch inventory with role counts |
| `switch://{name}/info` | Detailed info about a specific switch |
| `network://topology` | Network topology diagram |
| `network://documentation` | Full network documentation (network.MD) |
| `network://ip-scheme` | IP addressing scheme reference |

### Prompts (3 Total)

| Prompt | Description |
|--------|-------------|
| `fabric_health_check` | Comprehensive health check of entire fabric |
| `troubleshoot_connectivity` | Guided troubleshooting between two switches |
| `switch_quick_check` | Quick health check on a single switch |

## Network Environment

### Fabric Overview

| Attribute | Value |
|-----------|-------|
| **Architecture** | Two-tier VXLAN/EVPN Spine-Leaf |
| **Underlay Protocol** | OSPF (Area 0) |
| **Overlay Protocol** | BGP EVPN (AS 64996) |
| **Encapsulation** | VXLAN with ingress replication |
| **High Availability** | vPC dual-homing |
| **QoS** | PFC/ECN for RoCE v2 |
| **MTU** | 9216 bytes (jumbo frames) |

### Switch Inventory

#### Spine Switches (Route Reflectors)

| Hostname | Management IP | Router ID | Location |
|----------|---------------|-----------|----------|
| SS1-TIG-6A21 | 10.253.16.10 | 192.168.0.1 | Rack 6A21 |
| SS2-TIG-6A21 | 10.253.16.11 | 192.168.0.2 | Rack 6A21 |

#### Leaf Switches (VTEPs)

| Hostname | Management IP | vPC Domain | Location |
|----------|---------------|------------|----------|
| LS1a-TIG-6A4 | 10.253.16.20 | 1 | Rack 6A4 |
| LS1b-TIG-6A4 | 10.253.16.21 | 1 | Rack 6A4 |
| LS1a-TIG-6A5 | 10.253.16.18 | 2 | Rack 6A5 |
| LS1b-TIG-6A5 | 10.253.16.19 | 2 | Rack 6A5 |
| LS1a-TIG-6A6 | 10.253.16.16 | 3 | Rack 6A6 |
| LS1b-TIG-6A6 | 10.253.16.17 | 3 | Rack 6A6 |
| LS1a-TIG-6A7 | 10.253.16.14 | 5 | Rack 6A7 |
| LS1b-TIG-6A7 | 10.253.16.15 | 5 | Rack 6A7 |

#### Border Leaf Switches

| Hostname | Management IP | vPC Domain | Location |
|----------|---------------|------------|----------|
| BL1a-TIG-6A8 | 10.253.16.12 | 6 | Rack 6A8 |
| BL1b-TIG-6A8 | 10.253.16.13 | 6 | Rack 6A8 |

#### Additional Leaf Switches (Rack 6A8)

| Hostname | Management IP | Location |
|----------|---------------|----------|
| LS3a-TIG-6A8 | 10.253.16.28 | Rack 6A8 |
| LS4a-TIG-6A8 | 10.253.16.29 | Rack 6A8 |

## Tools Reference

### run_command

Execute a show command on a specific switch.

**Parameters:**
- `switch_name` (str): Switch hostname or short name (e.g., 'SS1' or 'SS1-TIG-6A21')
- `command` (str): The show command to execute

**Returns:** `CommandResult` with:
- `switch`: Switch hostname
- `command`: Command executed
- `output`: Raw command output
- `success`: Boolean success status
- `error`: Error message if failed

**Example:**
```
"Run 'show ip ospf neighbors' on SS1"
```

### run_command_all

Execute a command across multiple switches concurrently.

**Parameters:**
- `command` (str): The show command to execute
- `category` (str): Switch category - 'all', 'spines', 'leafs', 'border', or rack like '6A8'

**Returns:** `MultiSwitchCommandResult` with aggregated results from all switches.

**Example:**
```
"Run 'show version' on all spine switches"
"Check 'show nve peers' on all switches in rack 6A8"
```

### verify_ospf_neighbors

Check OSPF neighbor adjacencies on a switch.

**Parameters:**
- `switch_name` (str): Switch hostname or short name

**Returns:** `OSPFNeighborsResult` with:
- Parsed list of OSPF neighbors
- State information (FULL/EXSTART/etc.)
- Count of healthy vs problematic neighbors
- Raw command output

**Health Criteria:** All neighbors should be in FULL state.

### verify_bgp_evpn

Verify BGP EVPN sessions on a switch.

**Parameters:**
- `switch_name` (str): Switch hostname or short name

**Returns:** `BGPEVPNResult` with:
- Local ASN
- List of BGP neighbors with state and prefix counts
- Established vs non-established counts
- Raw command output

**Health Criteria:** All neighbors should be in Established state with prefixes received.

### verify_vpc_status

Check vPC domain status on a switch.

**Parameters:**
- `switch_name` (str): Switch hostname or short name

**Returns:** `VPCStatus` with:
- vPC domain ID and role
- Peer status, keepalive status, peer-link status
- Number of configured vPCs
- Overall health assessment

**Health Criteria:** Peer status OK, keepalive alive, peer-link up.

### verify_nve_peers

Verify NVE (VXLAN) peers on a switch.

**Parameters:**
- `switch_name` (str): Switch hostname or short name

**Returns:** `NVEPeersResult` with:
- List of VTEP peers with state and uptime
- Up vs down peer counts
- Raw command output

**Health Criteria:** All peers should be in Up state.

### check_interface_errors

Check interface error counters on a switch.

**Parameters:**
- `switch_name` (str): Switch hostname or short name

**Returns:** `InterfaceErrorsResult` with:
- List of interfaces with error counts
- Count of interfaces with errors
- Raw command output

### get_running_config

Get running configuration from a switch.

**Parameters:**
- `switch_name` (str): Switch hostname or short name
- `section` (str, optional): Section filter (e.g., 'interface', 'router ospf')

**Returns:** `CommandResult` with configuration output.

### get_switch_status

Get quick health status of a switch.

**Parameters:**
- `switch_name` (str): Switch hostname or short name

**Returns:** `SwitchStatus` with:
- Reachability status
- Uptime, version, model
- Serial number (reference)

### list_switches

List all switches in the inventory.

**Returns:** `SwitchInventory` with:
- Complete list of switches
- Counts by role (spine, leaf, border)

## Resources Reference

### switch://inventory

Returns a markdown-formatted table of all switches in the inventory with IP addresses, roles, and rack locations.

### switch://{name}/info

Returns detailed information about a specific switch including:
- IP address
- Role and rack location
- SSH connection command

**Example:** `switch://SS1/info`

### network://topology

Returns an ASCII diagram of the network topology showing:
- Spine layer with route reflectors
- Leaf layer with vPC pairs
- Physical connectivity

### network://documentation

Returns the complete network documentation from network.MD, including:
- OSPF configuration details
- BGP EVPN configuration
- VXLAN/vPC configuration
- QoS settings

### network://ip-scheme

Returns the IP addressing scheme including:
- Loopback addressing (Router ID, VTEP)
- Management network
- Fabric link addressing
- VRF configuration

## Prompts Reference

### fabric_health_check

Generates a comprehensive fabric health check prompt that guides through:
1. OSPF verification on all switches
2. BGP EVPN session verification
3. vPC status checks
4. NVE peer verification
5. Interface error checks

### troubleshoot_connectivity

Generates a connectivity troubleshooting prompt for two switches:
- Parameters: `source_switch`, `dest_switch`
- Guides through systematic verification of path between switches

### switch_quick_check

Generates a quick health check prompt for a single switch:
- Parameter: `switch_name`
- Covers version, OSPF, BGP, vPC, and interface errors

## Security

### Read-Only Enforcement

The server strictly enforces read-only operations:

**Allowed Commands:**
- `show *`
- `display *`
- `dir`
- `terminal length/width`

**Blocked Commands:**
- `configure *`
- `copy *`
- `delete *`
- `write *`
- `reload`
- `shutdown`
- `no *`
- `clear *` (except `clear counters`)
- `debug *`

### Sensitive Data Masking

The following patterns are automatically masked in output:
- Passwords (`password = ********`)
- Keys (`key = ********`)
- Secrets (`secret = ********`)
- MD5 hashes
- SNMP communities

### Authentication

- SSH key-based authentication only
- No password authentication supported
- Key file: `~/.ssh/cisco-key`
- Username: `cisco-mcp`

## Quick Start

### Prerequisites

- Python 3.11 or higher
- SSH key at `~/.ssh/cisco-key`
- Network access to 10.253.16.0/24 management subnet

### Installation

```bash
# Activate Python environment
source /opt/venvs/python/bin/activate

# Install the package
cd /opt/cisco-mcp
pip install -e .
```

### Add to MCP Client

Add `cisco-mcp` to your MCP client configuration pointing to `python -m cisco_mcp.server`.

### Start Using

Ask your AI agent about your network:
- "What's the health of the spine switches?"
- "Show me OSPF neighbors on all leafs"
- "Are there any interface errors in rack 6A8?"

## Example Conversations

### Health Check

```
User: Check the health of switch SS1

Agent: I'll perform a health check on SS1...
[Uses get_switch_status, verify_ospf_neighbors, verify_bgp_evpn]

SS1-TIG-6A21 Health Summary:
- Status: Reachable
- Uptime: 45 days
- Version: NX-OS 10.4(2)
- OSPF: 10 neighbors, all FULL ✓
- BGP EVPN: 10 neighbors, all Established ✓
```

### Troubleshooting

```
User: Troubleshoot connectivity between LS1a-6A4 and BL1a-6A8

Agent: I'll check the path between these switches...
[Uses verify_ospf_neighbors, verify_bgp_evpn, verify_nve_peers]

Path Analysis:
1. LS1a-6A4 OSPF: 2 neighbors FULL (SS1, SS2) ✓
2. BL1a-6A8 OSPF: 2 neighbors FULL (SS1, SS2) ✓
3. BGP EVPN: Both have sessions to route reflectors ✓
4. NVE Peers: LS1a sees BL1a VTEP as Up ✓

Connectivity path is healthy.
```

### Bulk Operations

```
User: Check BGP EVPN on all leaf switches

Agent: Running BGP EVPN verification on 10 leaf switches...
[Uses run_command_all with category='leafs']

Results:
- LS1a-6A4: 2 neighbors Established ✓
- LS1b-6A4: 2 neighbors Established ✓
- ... (8 more)

All leaf switches have healthy BGP EVPN sessions.
```

## Troubleshooting

### SSH Connection Failures

```bash
# Verify SSH key exists
ls -la ~/.ssh/cisco-key

# Test manual connection
ssh -i ~/.ssh/cisco-key cisco-mcp@10.253.16.28

# Check key permissions (should be 600)
chmod 600 ~/.ssh/cisco-key
```

### MCP Server Issues

```bash
# Test imports
python -c "from cisco_mcp.server import mcp; print(mcp.name)"

# Check inventory
cat /opt/cisco-mcp/switches.txt

# Run server manually for debugging
python -m cisco_mcp.server
```

### Command Blocked Errors

If you see "Command not allowed" errors:
- Ensure you're using `show` commands only
- Check for typos in command syntax
- Configuration commands are intentionally blocked

## License

Internal use only - TIG Network Operations

## Version

- **Server Version**: 1.0.0
- **MCP SDK Version**: 1.23.3
- **Network Documentation Version**: 1.0 (October 31, 2025)
