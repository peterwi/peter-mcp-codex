"""Parser for NVE (VXLAN) command output."""

import re

from cisco_mcp.models import NVEPeer, NVEPeersResult


def parse_nve_peers(output: str, switch_name: str) -> NVEPeersResult:
    """Parse 'show nve peers' output.

    Example output format:
    Interface Peer-IP          State LearnType Uptime   Router-Mac
    --------- ---------------  ----- --------- -------- -----------------
    nve1      192.168.1.1      Up    CP        2d03h    5254.0012.3456
    nve1      192.168.1.2      Up    CP        2d03h    5254.0012.3457
    nve1      192.168.1.3      Up    CP        1d05h    5254.0012.3458

    Args:
        output: Raw command output.
        switch_name: Name of the switch for result labeling.

    Returns:
        Parsed NVE peers result.
    """
    peers: list[NVEPeer] = []

    # Pattern to match peer lines
    # nve1      192.168.1.1      Up    CP        2d03h    5254.0012.3456
    peer_pattern = re.compile(
        r"nve\d+\s+"  # Interface (nve1, etc.)
        r"(\d+\.\d+\.\d+\.\d+)\s+"  # Peer IP
        r"(\S+)\s+"  # State (Up/Down)
        r"(\S+)\s+"  # LearnType (CP/DP)
        r"(\S+)"  # Uptime
    )

    for line in output.splitlines():
        line = line.strip()
        match = peer_pattern.match(line)
        if match:
            peer_ip = match.group(1)
            state = match.group(2)
            learn_type = match.group(3)
            uptime = match.group(4)

            is_up = state.lower() == "up"

            peers.append(
                NVEPeer(
                    peer_ip=peer_ip,
                    state=state,
                    learn_type=learn_type,
                    uptime=uptime,
                    is_up=is_up,
                )
            )

    up_count = len([p for p in peers if p.is_up])
    down_count = len(peers) - up_count

    return NVEPeersResult(
        switch=switch_name,
        peers=peers,
        total_count=len(peers),
        up_count=up_count,
        down_count=down_count,
        raw_output=output,
    )


def get_nve_issues(result: NVEPeersResult) -> list[str]:
    """Get list of NVE issues from parsed result.

    Args:
        result: Parsed NVE peers result.

    Returns:
        List of issue descriptions.
    """
    issues = []

    for peer in result.peers:
        if not peer.is_up:
            issues.append(
                f"{result.switch}: NVE peer {peer.peer_ip} is {peer.state}"
            )

    if result.total_count == 0:
        issues.append(f"{result.switch}: No NVE peers found")

    return issues
