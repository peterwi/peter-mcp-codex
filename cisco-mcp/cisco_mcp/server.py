"""Cisco MCP Server - MCP server for Cisco switch management.

This server provides tools, resources, and prompts for managing
Cisco switches in the TIG VXLAN/EVPN fabric via MCP.
"""

import asyncio
import logging
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from mcp.server.fastmcp import Context, FastMCP
from mcp.server.fastmcp.prompts import base
from mcp.server.session import ServerSession

from cisco_mcp.inventory import SwitchInventoryManager, get_inventory
from cisco_mcp.models import (
    BGPEVPNResult,
    CommandResult,
    FabricHealthSummary,
    InterfaceErrorsResult,
    MultiSwitchCommandResult,
    NVEPeersResult,
    OSPFNeighborsResult,
    Switch,
    SwitchInventory,
    SwitchRole,
    SwitchStatus,
    VPCStatus,
)
from cisco_mcp.parsers import (
    parse_bgp_evpn_summary,
    parse_interface_counters,
    parse_nve_peers,
    parse_ospf_neighbors,
    parse_vpc_brief,
)
from cisco_mcp.ssh_client import (
    CommandExecutionError,
    InvalidCommandError,
    SSHConnectionError,
    SSHConnectionPool,
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class AppContext:
    """Application context with shared resources."""

    inventory: SwitchInventoryManager
    ssh_pool: SSHConnectionPool


@asynccontextmanager
async def app_lifespan(server: FastMCP) -> AsyncIterator[AppContext]:
    """Manage application lifecycle.

    Initializes SSH connection pool and switch inventory on startup,
    cleans up connections on shutdown.
    """
    logger.info("Starting Cisco MCP Server...")

    # Initialize inventory
    inventory = get_inventory()
    inventory.load()
    logger.info(f"Loaded {len(inventory.switches)} switches from inventory")

    # Initialize SSH connection pool
    ssh_pool = SSHConnectionPool()

    try:
        yield AppContext(inventory=inventory, ssh_pool=ssh_pool)
    finally:
        # Cleanup SSH connections
        logger.info("Shutting down Cisco MCP Server...")
        await ssh_pool.close_all()


# Create the MCP server
mcp = FastMCP(
    "Cisco Network Manager",
    instructions="""This MCP server provides tools to manage and monitor Cisco switches
in the TIG VXLAN/EVPN fabric. You can execute show commands, verify protocol states
(OSPF, BGP EVPN, vPC, NVE), and check interface health.

IMPORTANT: This server only allows READ-ONLY operations (show commands).
Configuration changes are not permitted.

Key capabilities:
- Run show commands on individual or multiple switches
- Verify OSPF neighbor adjacencies
- Check BGP EVPN session states
- Monitor vPC status
- Inspect NVE/VXLAN peers
- Check interface errors

Switch categories:
- Spines: SS1, SS2 (route reflectors)
- Leafs: LS1a/b in racks 6A4-6A7, LS3a/LS4a in 6A8
- Border Leafs: BL1a/b in 6A8""",
    lifespan=app_lifespan,
)


# ============================================================================
# TOOLS
# ============================================================================


@mcp.tool()
async def run_command(
    switch_name: str,
    command: str,
    ctx: Context[ServerSession, AppContext],
) -> CommandResult:
    """Execute a show command on a specific switch.

    Only read-only commands (show, display) are allowed.

    Args:
        switch_name: Switch hostname or short name (e.g., 'SS1' or 'SS1-TIG-6A21')
        command: The show command to execute (e.g., 'show version')

    Returns:
        Command result with output and status.
    """
    app = ctx.request_context.lifespan_context
    inventory = app.inventory
    ssh_pool = app.ssh_pool

    # Find the switch
    switch = inventory.get_switch_by_name(switch_name)
    if switch is None:
        return CommandResult(
            switch=switch_name,
            command=command,
            output="",
            success=False,
            error=f"Switch '{switch_name}' not found in inventory",
        )

    try:
        await ctx.info(f"Executing '{command}' on {switch.hostname}")
        output = await ssh_pool.execute_command(switch.ip, command)
        return CommandResult(
            switch=switch.hostname,
            command=command,
            output=output,
            success=True,
        )
    except InvalidCommandError as e:
        return CommandResult(
            switch=switch.hostname,
            command=command,
            output="",
            success=False,
            error=str(e),
        )
    except (SSHConnectionError, CommandExecutionError) as e:
        return CommandResult(
            switch=switch.hostname,
            command=command,
            output="",
            success=False,
            error=str(e),
        )


@mcp.tool()
async def run_command_all(
    command: str,
    category: str = "all",
    ctx: Context[ServerSession, AppContext] = None,
) -> MultiSwitchCommandResult:
    """Execute a show command on multiple switches.

    Args:
        command: The show command to execute
        category: Switch category - 'all', 'spines', 'leafs', 'border', or a rack like '6A8'

    Returns:
        Aggregated results from all switches.
    """
    app = ctx.request_context.lifespan_context
    inventory = app.inventory
    ssh_pool = app.ssh_pool

    # Get switches based on category
    category_lower = category.lower()
    if category_lower == "all":
        switches = inventory.switches
    elif category_lower == "spines":
        switches = inventory.get_spines()
    elif category_lower == "leafs":
        switches = inventory.get_leafs()
    elif category_lower == "border":
        switches = inventory.get_border_leafs()
    elif category_lower.startswith("6a"):
        switches = inventory.get_switches_by_rack(category)
    else:
        switches = inventory.switches

    if not switches:
        return MultiSwitchCommandResult(
            command=command,
            results=[],
            success_count=0,
            failure_count=0,
        )

    await ctx.info(f"Executing '{command}' on {len(switches)} switches...")

    # Execute on all switches concurrently
    results = await ssh_pool.execute_on_multiple(
        hosts=[s.ip for s in switches],
        command=command,
        hostnames=[s.hostname for s in switches],
    )

    success_count = len([r for r in results if r.success])
    failure_count = len(results) - success_count

    return MultiSwitchCommandResult(
        command=command,
        results=results,
        success_count=success_count,
        failure_count=failure_count,
    )


@mcp.tool()
async def get_switch_status(
    switch_name: str,
    ctx: Context[ServerSession, AppContext],
) -> SwitchStatus:
    """Get quick health status of a switch.

    Args:
        switch_name: Switch hostname or short name

    Returns:
        Switch status including uptime, version, and resource usage.
    """
    app = ctx.request_context.lifespan_context
    inventory = app.inventory
    ssh_pool = app.ssh_pool

    switch = inventory.get_switch_by_name(switch_name)
    if switch is None:
        return SwitchStatus(
            switch=switch_name,
            reachable=False,
            uptime="N/A",
            version="N/A",
            model="N/A",
            serial="N/A",
            cpu_usage="N/A",
            memory_usage="N/A",
        )

    try:
        await ctx.info(f"Getting status for {switch.hostname}")

        # Get version info
        version_output = await ssh_pool.execute_command(
            switch.ip, "show version"
        )

        # Parse version output
        import re

        uptime_match = re.search(r"uptime is (.+?)(?:\n|$)", version_output)
        version_match = re.search(r"NXOS:\s*version\s+(\S+)", version_output)
        if not version_match:
            version_match = re.search(r"system:\s*version\s+(\S+)", version_output)
        model_match = re.search(r"cisco Nexus\d+\s+(\S+)", version_output, re.IGNORECASE)
        if not model_match:
            model_match = re.search(r"Hardware\s+cisco\s+(\S+)", version_output)

        return SwitchStatus(
            switch=switch.hostname,
            reachable=True,
            uptime=uptime_match.group(1) if uptime_match else "unknown",
            version=version_match.group(1) if version_match else "unknown",
            model=model_match.group(1) if model_match else "unknown",
            serial="see show version",
            cpu_usage="see show system resources",
            memory_usage="see show system resources",
        )

    except (SSHConnectionError, CommandExecutionError) as e:
        return SwitchStatus(
            switch=switch.hostname,
            reachable=False,
            uptime="N/A",
            version="N/A",
            model="N/A",
            serial="N/A",
            cpu_usage="N/A",
            memory_usage="N/A",
        )


@mcp.tool()
async def verify_ospf_neighbors(
    switch_name: str,
    ctx: Context[ServerSession, AppContext],
) -> OSPFNeighborsResult:
    """Verify OSPF neighbor adjacencies on a switch.

    Checks that all OSPF neighbors are in FULL state.

    Args:
        switch_name: Switch hostname or short name

    Returns:
        OSPF neighbors with health status.
    """
    app = ctx.request_context.lifespan_context
    inventory = app.inventory
    ssh_pool = app.ssh_pool

    switch = inventory.get_switch_by_name(switch_name)
    if switch is None:
        return OSPFNeighborsResult(
            switch=switch_name,
            neighbors=[],
            total_count=0,
            full_count=0,
            problem_count=0,
            raw_output=f"Switch '{switch_name}' not found",
        )

    try:
        await ctx.info(f"Verifying OSPF neighbors on {switch.hostname}")
        output = await ssh_pool.execute_command(switch.ip, "show ip ospf neighbors")
        return parse_ospf_neighbors(output, switch.hostname)
    except (SSHConnectionError, CommandExecutionError) as e:
        return OSPFNeighborsResult(
            switch=switch.hostname,
            neighbors=[],
            total_count=0,
            full_count=0,
            problem_count=0,
            raw_output=f"Error: {e}",
        )


@mcp.tool()
async def verify_bgp_evpn(
    switch_name: str,
    ctx: Context[ServerSession, AppContext],
) -> BGPEVPNResult:
    """Verify BGP EVPN sessions on a switch.

    Checks that all BGP EVPN neighbors are established.

    Args:
        switch_name: Switch hostname or short name

    Returns:
        BGP EVPN session status.
    """
    app = ctx.request_context.lifespan_context
    inventory = app.inventory
    ssh_pool = app.ssh_pool

    switch = inventory.get_switch_by_name(switch_name)
    if switch is None:
        return BGPEVPNResult(
            switch=switch_name,
            local_asn=0,
            neighbors=[],
            total_count=0,
            established_count=0,
            problem_count=0,
            raw_output=f"Switch '{switch_name}' not found",
        )

    try:
        await ctx.info(f"Verifying BGP EVPN on {switch.hostname}")
        output = await ssh_pool.execute_command(switch.ip, "show bgp l2vpn evpn summary")
        return parse_bgp_evpn_summary(output, switch.hostname)
    except (SSHConnectionError, CommandExecutionError) as e:
        return BGPEVPNResult(
            switch=switch.hostname,
            local_asn=0,
            neighbors=[],
            total_count=0,
            established_count=0,
            problem_count=0,
            raw_output=f"Error: {e}",
        )


@mcp.tool()
async def verify_vpc_status(
    switch_name: str,
    ctx: Context[ServerSession, AppContext],
) -> VPCStatus:
    """Verify vPC domain status on a switch.

    Checks peer status, keepalive, and peer-link health.

    Args:
        switch_name: Switch hostname or short name

    Returns:
        vPC domain status.
    """
    app = ctx.request_context.lifespan_context
    inventory = app.inventory
    ssh_pool = app.ssh_pool

    switch = inventory.get_switch_by_name(switch_name)
    if switch is None:
        return VPCStatus(
            switch=switch_name,
            domain_id=0,
            role="unknown",
            peer_status="unknown",
            peer_keepalive_status="unknown",
            peer_link_status="unknown",
            vpc_count=0,
            is_healthy=False,
            raw_output=f"Switch '{switch_name}' not found",
        )

    try:
        await ctx.info(f"Verifying vPC status on {switch.hostname}")
        output = await ssh_pool.execute_command(switch.ip, "show vpc brief")
        return parse_vpc_brief(output, switch.hostname)
    except (SSHConnectionError, CommandExecutionError) as e:
        return VPCStatus(
            switch=switch.hostname,
            domain_id=0,
            role="unknown",
            peer_status="unknown",
            peer_keepalive_status="unknown",
            peer_link_status="unknown",
            vpc_count=0,
            is_healthy=False,
            raw_output=f"Error: {e}",
        )


@mcp.tool()
async def verify_nve_peers(
    switch_name: str,
    ctx: Context[ServerSession, AppContext],
) -> NVEPeersResult:
    """Verify NVE (VXLAN) peers on a switch.

    Checks that all VTEP peers are up.

    Args:
        switch_name: Switch hostname or short name

    Returns:
        NVE peer status.
    """
    app = ctx.request_context.lifespan_context
    inventory = app.inventory
    ssh_pool = app.ssh_pool

    switch = inventory.get_switch_by_name(switch_name)
    if switch is None:
        return NVEPeersResult(
            switch=switch_name,
            peers=[],
            total_count=0,
            up_count=0,
            down_count=0,
            raw_output=f"Switch '{switch_name}' not found",
        )

    try:
        await ctx.info(f"Verifying NVE peers on {switch.hostname}")
        output = await ssh_pool.execute_command(switch.ip, "show nve peers")
        return parse_nve_peers(output, switch.hostname)
    except (SSHConnectionError, CommandExecutionError) as e:
        return NVEPeersResult(
            switch=switch.hostname,
            peers=[],
            total_count=0,
            up_count=0,
            down_count=0,
            raw_output=f"Error: {e}",
        )


@mcp.tool()
async def check_interface_errors(
    switch_name: str,
    ctx: Context[ServerSession, AppContext],
) -> InterfaceErrorsResult:
    """Check interface error counters on a switch.

    Args:
        switch_name: Switch hostname or short name

    Returns:
        Interface error counters.
    """
    app = ctx.request_context.lifespan_context
    inventory = app.inventory
    ssh_pool = app.ssh_pool

    switch = inventory.get_switch_by_name(switch_name)
    if switch is None:
        return InterfaceErrorsResult(
            switch=switch_name,
            interfaces=[],
            interfaces_with_errors=0,
            raw_output=f"Switch '{switch_name}' not found",
        )

    try:
        await ctx.info(f"Checking interface errors on {switch.hostname}")
        output = await ssh_pool.execute_command(switch.ip, "show interface counters errors")
        return parse_interface_counters(output, switch.hostname)
    except (SSHConnectionError, CommandExecutionError) as e:
        return InterfaceErrorsResult(
            switch=switch.hostname,
            interfaces=[],
            interfaces_with_errors=0,
            raw_output=f"Error: {e}",
        )


@mcp.tool()
async def get_running_config(
    switch_name: str,
    section: Optional[str] = None,
    ctx: Context[ServerSession, AppContext] = None,
) -> CommandResult:
    """Get running configuration from a switch.

    Args:
        switch_name: Switch hostname or short name
        section: Optional section to filter (e.g., 'interface', 'router ospf', 'router bgp')

    Returns:
        Running configuration or section.
    """
    app = ctx.request_context.lifespan_context
    inventory = app.inventory
    ssh_pool = app.ssh_pool

    switch = inventory.get_switch_by_name(switch_name)
    if switch is None:
        return CommandResult(
            switch=switch_name,
            command="show running-config",
            output="",
            success=False,
            error=f"Switch '{switch_name}' not found",
        )

    command = "show running-config"
    if section:
        command = f"show running-config {section}"

    try:
        await ctx.info(f"Getting config from {switch.hostname}")
        output = await ssh_pool.execute_command(switch.ip, command)
        return CommandResult(
            switch=switch.hostname,
            command=command,
            output=output,
            success=True,
        )
    except (SSHConnectionError, CommandExecutionError) as e:
        return CommandResult(
            switch=switch.hostname,
            command=command,
            output="",
            success=False,
            error=str(e),
        )


@mcp.tool()
async def list_switches(
    ctx: Context[ServerSession, AppContext],
) -> SwitchInventory:
    """List all switches in the inventory.

    Returns:
        Complete switch inventory with counts by role.
    """
    app = ctx.request_context.lifespan_context
    inventory = app.inventory
    return inventory.get_inventory()


# ============================================================================
# RESOURCES
# ============================================================================


@mcp.resource("switch://inventory")
def get_switch_inventory() -> str:
    """Get the complete switch inventory."""
    inventory = get_inventory()
    inv = inventory.get_inventory()

    lines = ["# TIG Network Switch Inventory\n"]
    lines.append(f"Total Switches: {inv.total_count}")
    lines.append(f"- Spines: {inv.spine_count}")
    lines.append(f"- Leafs: {inv.leaf_count}")
    lines.append(f"- Border Leafs: {inv.border_count}\n")

    lines.append("## Switches\n")
    lines.append("| Hostname | IP | Role | Rack |")
    lines.append("|----------|-------|------|------|")

    for switch in inv.switches:
        lines.append(f"| {switch.hostname} | {switch.ip} | {switch.role.value} | {switch.rack} |")

    return "\n".join(lines)


@mcp.resource("switch://{name}/info")
def get_switch_info(name: str) -> str:
    """Get detailed information about a specific switch."""
    inventory = get_inventory()
    switch = inventory.get_switch_by_name(name)

    if switch is None:
        return f"Switch '{name}' not found in inventory"

    return f"""# Switch: {switch.hostname}

- **IP Address**: {switch.ip}
- **Role**: {switch.role.value}
- **Rack**: {switch.rack}
- **Short Name**: {switch.short_name}

## SSH Connection
```
ssh -i ~/.ssh/cisco-key cisco-mcp@{switch.ip}
```
"""


@mcp.resource("network://topology")
def get_network_topology() -> str:
    """Get the network topology diagram."""
    return """# TIG Network Topology

## Architecture
Two-tier VXLAN/EVPN fabric with BGP EVPN control plane and OSPF underlay.

## Spine Layer (Route Reflectors)
```
        SS1-TIG-6A21 (192.168.0.1)     SS2-TIG-6A21 (192.168.0.2)
             |   |   |   |   |             |   |   |   |   |
             +---+---+---+---+-------------+---+---+---+---+
                         400G Links (2x per leaf)
```

## Leaf Layer (VTEPs)
```
Rack 6A4: LS1a-6A4 <--vPC--> LS1b-6A4  (vPC Domain 1)
Rack 6A5: LS1a-6A5 <--vPC--> LS1b-6A5  (vPC Domain 2)
Rack 6A6: LS1a-6A6 <--vPC--> LS1b-6A6  (vPC Domain 3)
Rack 6A7: LS1a-6A7 <--vPC--> LS1b-6A7  (vPC Domain 5)
Rack 6A8: BL1a-6A8 <--vPC--> BL1b-6A8  (vPC Domain 6, Border)
          LS3a-6A8, LS4a-6A8           (Additional leafs)
```

## Key Features
- VXLAN encapsulation with ingress replication
- BGP EVPN control plane (AS 64996)
- OSPF underlay (Area 0)
- vPC dual-homing for all servers
- PFC/ECN for RoCE traffic
- MTU 9216 throughout
"""


@mcp.resource("network://documentation")
def get_network_documentation() -> str:
    """Get the network documentation from network.MD."""
    doc_path = Path(__file__).parent.parent / "network.MD"
    if doc_path.exists():
        return doc_path.read_text()
    return "Network documentation not found at network.MD"


@mcp.resource("network://ip-scheme")
def get_ip_scheme() -> str:
    """Get the IP addressing scheme."""
    return """# TIG Network IP Addressing Scheme

## Loopback Addressing

### Loopback0 (Router ID)
- Range: 192.168.0.0/24
- Spines: 192.168.0.1-2
- Leafs: 192.168.0.3-12

### Loopback1 (VTEP Source)
- Range: 192.168.1.0/24
- Primary VTEP IPs and vPC anycast VTEPs

## Management Network
- Range: 10.253.16.0/24
- Spines: 10.253.16.10-11
- Leafs: 10.253.16.12-21, 28-29

## Fabric Links
- Range: 192.168.3.0/24, 192.168.4.0/24
- Point-to-point /31 subnets

## VRFs
- tig-base: L3 VNI 50000
- tig-restricted: L3 VNI 50001
"""


# ============================================================================
# PROMPTS
# ============================================================================


@mcp.prompt(title="Fabric Health Check")
def fabric_health_check() -> str:
    """Generate a comprehensive fabric health check prompt."""
    return """Please perform a comprehensive health check of the TIG network fabric:

1. **OSPF Verification**: Check all spine and leaf switches for OSPF neighbor adjacencies.
   All neighbors should be in FULL state.

2. **BGP EVPN Verification**: Verify BGP EVPN sessions on all switches.
   All neighbors should be Established with prefixes received.

3. **vPC Status**: Check vPC status on all leaf switch pairs.
   Peer status should be OK, keepalive alive, peer-link up.

4. **NVE Peers**: Verify VXLAN tunnel endpoints on all leaf switches.
   All peers should be Up.

5. **Interface Errors**: Check for interface errors on fabric uplinks.

Please use the verification tools to check each component and summarize any issues found."""


@mcp.prompt(title="Troubleshoot Connectivity")
def troubleshoot_connectivity(source_switch: str, dest_switch: str) -> str:
    """Generate a connectivity troubleshooting prompt."""
    return f"""Please troubleshoot connectivity between {source_switch} and {dest_switch}:

1. Verify both switches are reachable (get_switch_status)
2. Check OSPF neighbors on both switches (verify_ospf_neighbors)
3. Verify BGP EVPN sessions (verify_bgp_evpn)
4. Check NVE peer status (verify_nve_peers)
5. Look for interface errors on the path (check_interface_errors)

For each step, identify any issues and suggest remediation."""


@mcp.prompt(title="Switch Quick Check")
def switch_quick_check(switch_name: str) -> str:
    """Generate a quick switch health check prompt."""
    return f"""Please perform a quick health check on switch {switch_name}:

1. Get switch status (version, uptime)
2. Verify OSPF neighbors
3. Verify BGP EVPN sessions
4. Check vPC status (if applicable)
5. Check for interface errors

Summarize the health status and flag any issues."""


# ============================================================================
# MAIN
# ============================================================================


def main():
    """Run the MCP server."""
    import sys

    # Default to stdio transport
    transport = "stdio"

    # Check for command line arguments
    if len(sys.argv) > 1:
        if "--transport" in sys.argv:
            idx = sys.argv.index("--transport")
            if idx + 1 < len(sys.argv):
                transport = sys.argv[idx + 1]

    mcp.run(transport=transport)


if __name__ == "__main__":
    main()
