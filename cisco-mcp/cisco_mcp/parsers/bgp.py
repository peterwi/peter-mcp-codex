"""Parser for BGP EVPN command output."""

import re

from cisco_mcp.models import BGPNeighbor, BGPEVPNResult


def parse_bgp_evpn_summary(output: str, switch_name: str) -> BGPEVPNResult:
    """Parse 'show bgp l2vpn evpn summary' output.

    Example output format:
    BGP summary information for VRF default, address family L2VPN EVPN
    BGP router identifier 192.168.0.7, local AS number 64996
    BGP table version is 12345, L2VPN EVPN config peers 2, capable peers 2
    ...
    Neighbor        V    AS    MsgRcvd    MsgSent   TblVer  InQ OutQ Up/Down  State/PfxRcd
    192.168.0.1     4 64996      12345      12346   12345    0    0    2d03h 150
    192.168.0.2     4 64996      12347      12348   12345    0    0    2d03h 150

    Args:
        output: Raw command output.
        switch_name: Name of the switch for result labeling.

    Returns:
        Parsed BGP EVPN summary result.
    """
    neighbors: list[BGPNeighbor] = []
    local_asn = 0

    # Extract local AS number
    asn_match = re.search(r"local AS number (\d+)", output)
    if asn_match:
        local_asn = int(asn_match.group(1))

    # Pattern to match neighbor lines
    # Neighbor        V    AS    MsgRcvd    MsgSent   TblVer  InQ OutQ Up/Down  State/PfxRcd
    neighbor_pattern = re.compile(
        r"(\d+\.\d+\.\d+\.\d+)\s+"  # Neighbor IP
        r"(\d+)\s+"  # Version
        r"(\d+)\s+"  # AS number
        r"(\d+)\s+"  # MsgRcvd
        r"(\d+)\s+"  # MsgSent
        r"(\d+)\s+"  # TblVer
        r"(\d+)\s+"  # InQ
        r"(\d+)\s+"  # OutQ
        r"(\S+)\s+"  # Up/Down time
        r"(\S+)"  # State/PfxRcd
    )

    for line in output.splitlines():
        line = line.strip()
        match = neighbor_pattern.match(line)
        if match:
            neighbor_id = match.group(1)
            asn = int(match.group(3))
            up_time = match.group(9)
            state_or_pfx = match.group(10)

            # If state_or_pfx is a number, session is established
            try:
                prefixes_received = int(state_or_pfx)
                state = "Established"
                is_established = True
            except ValueError:
                prefixes_received = 0
                state = state_or_pfx
                is_established = False

            neighbors.append(
                BGPNeighbor(
                    neighbor_id=neighbor_id,
                    asn=asn,
                    state=state,
                    prefixes_received=prefixes_received,
                    up_time=up_time,
                    is_established=is_established,
                )
            )

    established_count = len([n for n in neighbors if n.is_established])
    problem_count = len(neighbors) - established_count

    return BGPEVPNResult(
        switch=switch_name,
        local_asn=local_asn,
        neighbors=neighbors,
        total_count=len(neighbors),
        established_count=established_count,
        problem_count=problem_count,
        raw_output=output,
    )


def get_bgp_issues(result: BGPEVPNResult) -> list[str]:
    """Get list of BGP issues from parsed result.

    Args:
        result: Parsed BGP EVPN result.

    Returns:
        List of issue descriptions.
    """
    issues = []

    for neighbor in result.neighbors:
        if not neighbor.is_established:
            issues.append(
                f"{result.switch}: BGP EVPN neighbor {neighbor.neighbor_id} "
                f"is in {neighbor.state} state (not Established)"
            )

    if result.total_count == 0:
        issues.append(f"{result.switch}: No BGP EVPN neighbors found")

    return issues
