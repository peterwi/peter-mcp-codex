"""Parser for vPC command output."""

import re

from cisco_mcp.models import VPCStatus


def parse_vpc_brief(output: str, switch_name: str) -> VPCStatus:
    """Parse 'show vpc brief' output.

    Example output format:
    vPC domain id                     : 5
    Peer status                       : peer adjacency formed ok
    vPC keep-alive status             : peer is alive
    Configuration consistency status  : success
    Per-vlan consistency status       : success
    Type-2 consistency status         : success
    vPC role                          : primary
    Number of vPCs configured         : 10
    Peer Gateway                      : Enabled
    Dual-active excluded VLANs        : -
    Graceful Consistency Check        : Enabled
    Auto-recovery status              : Disabled
    Delay-restore status              : Timer is off.(timeout = 150s)
    Delay-restore SVI status          : Timer is off.(timeout = 10s)
    Delay-restore Orphan-port status  : Timer is off.(timeout = 0s)
    Operational Layer3 Peer-router    : Disabled
    Virtual-peerlink mode             : Disabled

    vPC Peer-link status
    ---------------------------------------------------------------------
    id   Port   Status Active vlans
    --   ----   ------ --------------------------------------------------
    1    Po500  up     1,59,134-162,701,801,901,2000-2001,3600

    Args:
        output: Raw command output.
        switch_name: Name of the switch for result labeling.

    Returns:
        Parsed vPC status.
    """
    # Default values
    domain_id = 0
    role = "unknown"
    peer_status = "unknown"
    peer_keepalive_status = "unknown"
    peer_link_status = "unknown"
    vpc_count = 0

    # Parse domain ID
    domain_match = re.search(r"vPC domain id\s*:\s*(\d+)", output)
    if domain_match:
        domain_id = int(domain_match.group(1))

    # Parse role
    role_match = re.search(r"vPC role\s*:\s*(\S+)", output)
    if role_match:
        role = role_match.group(1)

    # Parse peer status
    peer_match = re.search(r"Peer status\s*:\s*(.+?)(?:\n|$)", output)
    if peer_match:
        peer_status = peer_match.group(1).strip()

    # Parse keepalive status
    keepalive_match = re.search(r"vPC keep-alive status\s*:\s*(.+?)(?:\n|$)", output)
    if keepalive_match:
        peer_keepalive_status = keepalive_match.group(1).strip()

    # Parse number of vPCs
    vpc_count_match = re.search(r"Number of vPCs configured\s*:\s*(\d+)", output)
    if vpc_count_match:
        vpc_count = int(vpc_count_match.group(1))

    # Parse peer-link status from the table
    # Look for "Po500  up" or similar
    peerlink_match = re.search(r"Po\d+\s+(up|down)", output, re.IGNORECASE)
    if peerlink_match:
        peer_link_status = peerlink_match.group(1).lower()
    else:
        peer_link_status = "unknown"

    # Determine overall health
    is_healthy = (
        "ok" in peer_status.lower()
        or "formed" in peer_status.lower()
    ) and (
        "alive" in peer_keepalive_status.lower()
    ) and (
        peer_link_status == "up"
    )

    return VPCStatus(
        switch=switch_name,
        domain_id=domain_id,
        role=role,
        peer_status=peer_status,
        peer_keepalive_status=peer_keepalive_status,
        peer_link_status=peer_link_status,
        vpc_count=vpc_count,
        is_healthy=is_healthy,
        raw_output=output,
    )


def get_vpc_issues(result: VPCStatus) -> list[str]:
    """Get list of vPC issues from parsed result.

    Args:
        result: Parsed vPC status.

    Returns:
        List of issue descriptions.
    """
    issues = []

    if "ok" not in result.peer_status.lower() and "formed" not in result.peer_status.lower():
        issues.append(
            f"{result.switch}: vPC peer status is '{result.peer_status}' (not OK)"
        )

    if "alive" not in result.peer_keepalive_status.lower():
        issues.append(
            f"{result.switch}: vPC keepalive status is '{result.peer_keepalive_status}'"
        )

    if result.peer_link_status != "up":
        issues.append(
            f"{result.switch}: vPC peer-link is {result.peer_link_status}"
        )

    return issues
