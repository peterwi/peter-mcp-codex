"""Parser for interface command output."""

import re

from cisco_mcp.models import InterfaceErrors, InterfaceErrorsResult, InterfaceStatus


def parse_interface_brief(output: str) -> list[InterfaceStatus]:
    """Parse 'show interface brief' output.

    Example output format:
    --------------------------------------------------------------------------------
    Ethernet      VLAN    Type Mode   Status  Reason                   Speed     Port
    Interface                                                                    Ch #
    --------------------------------------------------------------------------------
    Eth1/1        --      eth  routed down    Administratively down      auto(D) --
    Eth1/2        --      eth  routed up      none                       400G(D) --
    Eth1/3        --      eth  routed up      none                       400G(D) --

    Args:
        output: Raw command output.

    Returns:
        List of interface statuses.
    """
    interfaces: list[InterfaceStatus] = []

    # Pattern for ethernet interfaces
    eth_pattern = re.compile(
        r"(Eth\d+/\d+(?:/\d+)?)\s+"  # Interface name
        r"(\S+)\s+"  # VLAN or --
        r"(\S+)\s+"  # Type
        r"(\S+)\s+"  # Mode
        r"(\S+)\s+"  # Status (up/down)
        r"(.+?)\s+"  # Reason
        r"(\S+)"  # Speed
    )

    # Pattern for port-channels
    po_pattern = re.compile(
        r"(Po\d+)\s+"  # Port-channel name
        r"(\S+)\s+"  # VLAN or --
        r"(\S+)\s+"  # Type
        r"(\S+)"  # Status (up/down)
    )

    for line in output.splitlines():
        line = line.strip()

        eth_match = eth_pattern.match(line)
        if eth_match:
            interfaces.append(
                InterfaceStatus(
                    name=eth_match.group(1),
                    admin_state="up" if "admin" not in eth_match.group(6).lower() else "down",
                    oper_state=eth_match.group(5),
                    speed=eth_match.group(7),
                    type=eth_match.group(3),
                )
            )
            continue

        po_match = po_pattern.match(line)
        if po_match:
            interfaces.append(
                InterfaceStatus(
                    name=po_match.group(1),
                    admin_state="up",
                    oper_state=po_match.group(4),
                    speed="aggregated",
                    type=po_match.group(3),
                )
            )

    return interfaces


def parse_interface_counters(output: str, switch_name: str) -> InterfaceErrorsResult:
    """Parse 'show interface counters errors' output.

    Example output format:
    --------------------------------------------------------------------------------
    Port          Align-Err    FCS-Err   Xmit-Err    Rcv-Err  UnderSize OutDiscards
    --------------------------------------------------------------------------------
    Eth1/1                0          0          0          0          0           0
    Eth1/2                0          0          0          0          0           0

    --------------------------------------------------------------------------------
    Port          Single-Col  Multi-Col   Late-Col  Exces-Col  Carri-Sen       Runts
    --------------------------------------------------------------------------------
    Eth1/1                0          0          0          0          0           0
    Eth1/2                0          0          0          0          0           0

    --------------------------------------------------------------------------------
    Port           Giants   InDiscards
    --------------------------------------------------------------------------------
    Eth1/1               0            0
    Eth1/2               0            0

    Args:
        output: Raw command output.
        switch_name: Name of the switch for result labeling.

    Returns:
        Parsed interface errors result.
    """
    interfaces: dict[str, InterfaceErrors] = {}

    # Pattern to match error counter lines
    # The format varies, but typically: Interface followed by numbers
    error_pattern = re.compile(
        r"(Eth\d+/\d+(?:/\d+)?|Po\d+)\s+"  # Interface name
        r"(\d+)\s+"  # First counter
        r"(\d+)\s+"  # Second counter
        r"(\d+)\s+"  # Third counter
        r"(\d+)\s+"  # Fourth counter
        r"(\d+)\s+"  # Fifth counter
        r"(\d+)"  # Sixth counter
    )

    # Simpler pattern for lines with fewer counters
    simple_pattern = re.compile(
        r"(Eth\d+/\d+(?:/\d+)?|Po\d+)\s+"  # Interface name
        r"(\d+)\s+"  # First counter
        r"(\d+)"  # Second counter
    )

    for line in output.splitlines():
        line = line.strip()

        match = error_pattern.match(line)
        if match:
            name = match.group(1)
            if name not in interfaces:
                interfaces[name] = InterfaceErrors(
                    name=name,
                    input_errors=0,
                    output_errors=0,
                    crc_errors=0,
                    input_discards=0,
                    output_discards=0,
                    has_errors=False,
                )

            # Accumulate errors from different counter tables
            # The exact column meanings depend on which section we're in
            # For simplicity, sum all non-zero values as potential errors
            for i in range(2, 8):
                val = int(match.group(i))
                if val > 0:
                    interfaces[name].input_errors += val
                    interfaces[name].has_errors = True
            continue

        simple_match = simple_pattern.match(line)
        if simple_match:
            name = simple_match.group(1)
            if name not in interfaces:
                interfaces[name] = InterfaceErrors(
                    name=name,
                    input_errors=0,
                    output_errors=0,
                    crc_errors=0,
                    input_discards=0,
                    output_discards=0,
                    has_errors=False,
                )

            val1 = int(simple_match.group(2))
            val2 = int(simple_match.group(3))
            if val1 > 0 or val2 > 0:
                interfaces[name].input_errors += val1 + val2
                interfaces[name].has_errors = True

    interface_list = list(interfaces.values())
    interfaces_with_errors = len([i for i in interface_list if i.has_errors])

    return InterfaceErrorsResult(
        switch=switch_name,
        interfaces=interface_list,
        interfaces_with_errors=interfaces_with_errors,
        raw_output=output,
    )


def get_interface_issues(result: InterfaceErrorsResult) -> list[str]:
    """Get list of interface issues from parsed result.

    Args:
        result: Parsed interface errors result.

    Returns:
        List of issue descriptions.
    """
    issues = []

    for iface in result.interfaces:
        if iface.has_errors:
            issues.append(
                f"{result.switch}: Interface {iface.name} has errors "
                f"(input: {iface.input_errors}, output: {iface.output_errors})"
            )

    return issues
