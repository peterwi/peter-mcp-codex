"""Parser for OSPF command output."""

import re
from typing import Optional

from cisco_mcp.models import OSPFNeighbor, OSPFNeighborsResult


def parse_ospf_neighbors(output: str, switch_name: str) -> OSPFNeighborsResult:
    """Parse 'show ip ospf neighbors' output.

    Example output format:
    OSPF Process ID UNDERLAY VRF default
    Total number of neighbors: 2
    Neighbor ID     Pri State            Up Time  Address         Interface
    192.168.0.1       1 FULL/DR          2d03h    192.168.3.40    Eth1/29
    192.168.0.2       1 FULL/BDR         2d03h    192.168.3.44    Eth1/30

    Args:
        output: Raw command output.
        switch_name: Name of the switch for result labeling.

    Returns:
        Parsed OSPF neighbors result.
    """
    neighbors: list[OSPFNeighbor] = []

    # Pattern to match neighbor lines
    # Neighbor ID     Pri State            Up Time  Address         Interface
    neighbor_pattern = re.compile(
        r"(\d+\.\d+\.\d+\.\d+)\s+"  # Neighbor ID
        r"(\d+)\s+"  # Priority
        r"(\S+)\s+"  # State (e.g., FULL/DR, EXSTART/-)
        r"(\S+)\s+"  # Up Time / Dead Time
        r"(\d+\.\d+\.\d+\.\d+)\s+"  # Address
        r"(\S+)"  # Interface
    )

    for line in output.splitlines():
        line = line.strip()
        match = neighbor_pattern.match(line)
        if match:
            neighbor_id = match.group(1)
            priority = int(match.group(2))
            state_full = match.group(3)
            dead_time = match.group(4)
            address = match.group(5)
            interface = match.group(6)

            # Extract base state (before /)
            state = state_full.split("/")[0] if "/" in state_full else state_full
            is_healthy = state.upper() == "FULL"

            neighbors.append(
                OSPFNeighbor(
                    neighbor_id=neighbor_id,
                    priority=priority,
                    state=state_full,
                    dead_time=dead_time,
                    address=address,
                    interface=interface,
                    is_healthy=is_healthy,
                )
            )

    full_count = len([n for n in neighbors if n.is_healthy])
    problem_count = len(neighbors) - full_count

    return OSPFNeighborsResult(
        switch=switch_name,
        neighbors=neighbors,
        total_count=len(neighbors),
        full_count=full_count,
        problem_count=problem_count,
        raw_output=output,
    )


def get_ospf_issues(result: OSPFNeighborsResult) -> list[str]:
    """Get list of OSPF issues from parsed result.

    Args:
        result: Parsed OSPF neighbors result.

    Returns:
        List of issue descriptions.
    """
    issues = []

    for neighbor in result.neighbors:
        if not neighbor.is_healthy:
            issues.append(
                f"{result.switch}: OSPF neighbor {neighbor.neighbor_id} on "
                f"{neighbor.interface} is in {neighbor.state} state (not FULL)"
            )

    if result.total_count == 0:
        issues.append(f"{result.switch}: No OSPF neighbors found")

    return issues
