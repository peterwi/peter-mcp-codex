"""Pydantic models for structured output from Cisco MCP tools."""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class SwitchRole(str, Enum):
    """Role of a switch in the fabric."""

    SPINE = "spine"
    LEAF = "leaf"
    BORDER = "border"


class Switch(BaseModel):
    """A network switch in the inventory."""

    hostname: str = Field(description="Switch hostname")
    ip: str = Field(description="Management IP address")
    role: SwitchRole = Field(description="Switch role (spine, leaf, border)")
    rack: str = Field(description="Rack location")

    @property
    def short_name(self) -> str:
        """Return short name without TIG suffix."""
        return self.hostname.split("-TIG-")[0] if "-TIG-" in self.hostname else self.hostname


class SwitchInventory(BaseModel):
    """Complete switch inventory."""

    switches: list[Switch] = Field(description="List of all switches")
    total_count: int = Field(description="Total number of switches")
    spine_count: int = Field(description="Number of spine switches")
    leaf_count: int = Field(description="Number of leaf switches")
    border_count: int = Field(description="Number of border leaf switches")


class CommandResult(BaseModel):
    """Result of running a command on a switch."""

    switch: str = Field(description="Switch hostname")
    command: str = Field(description="Command executed")
    output: str = Field(description="Raw command output")
    success: bool = Field(description="Whether command succeeded")
    error: Optional[str] = Field(default=None, description="Error message if failed")


class MultiSwitchCommandResult(BaseModel):
    """Result of running a command on multiple switches."""

    command: str = Field(description="Command executed")
    results: list[CommandResult] = Field(description="Results from each switch")
    success_count: int = Field(description="Number of successful executions")
    failure_count: int = Field(description="Number of failed executions")


class OSPFNeighborState(str, Enum):
    """OSPF neighbor states."""

    DOWN = "DOWN"
    ATTEMPT = "ATTEMPT"
    INIT = "INIT"
    TWO_WAY = "2WAY"
    EXSTART = "EXSTART"
    EXCHANGE = "EXCHANGE"
    LOADING = "LOADING"
    FULL = "FULL"


class OSPFNeighbor(BaseModel):
    """An OSPF neighbor."""

    neighbor_id: str = Field(description="OSPF neighbor router ID")
    priority: int = Field(description="Neighbor priority")
    state: str = Field(description="OSPF state (e.g., FULL)")
    dead_time: str = Field(description="Dead time remaining")
    address: str = Field(description="Neighbor IP address")
    interface: str = Field(description="Local interface")
    is_healthy: bool = Field(description="Whether neighbor is in FULL state")


class OSPFNeighborsResult(BaseModel):
    """Result of OSPF neighbor verification."""

    switch: str = Field(description="Switch hostname")
    neighbors: list[OSPFNeighbor] = Field(description="List of OSPF neighbors")
    total_count: int = Field(description="Total number of neighbors")
    full_count: int = Field(description="Number of neighbors in FULL state")
    problem_count: int = Field(description="Number of neighbors not in FULL state")
    raw_output: str = Field(description="Raw command output")


class BGPNeighbor(BaseModel):
    """A BGP EVPN neighbor."""

    neighbor_id: str = Field(description="BGP neighbor IP")
    asn: int = Field(description="Remote AS number")
    state: str = Field(description="BGP state (e.g., Established)")
    prefixes_received: int = Field(description="Number of prefixes received")
    up_time: str = Field(description="Time since established")
    is_established: bool = Field(description="Whether session is established")


class BGPEVPNResult(BaseModel):
    """Result of BGP EVPN verification."""

    switch: str = Field(description="Switch hostname")
    local_asn: int = Field(description="Local AS number")
    neighbors: list[BGPNeighbor] = Field(description="List of BGP neighbors")
    total_count: int = Field(description="Total number of neighbors")
    established_count: int = Field(description="Number of established sessions")
    problem_count: int = Field(description="Number of non-established sessions")
    raw_output: str = Field(description="Raw command output")


class VPCPeerState(str, Enum):
    """vPC peer states."""

    PEER_OK = "peer-ok"
    PEER_UNREACHABLE = "peer-unreachable"
    PEER_DOWN = "peer-down"


class VPCStatus(BaseModel):
    """vPC domain status."""

    switch: str = Field(description="Switch hostname")
    domain_id: int = Field(description="vPC domain ID")
    role: str = Field(description="vPC role (primary/secondary)")
    peer_status: str = Field(description="Peer status")
    peer_keepalive_status: str = Field(description="Peer keepalive status")
    peer_link_status: str = Field(description="Peer link status")
    vpc_count: int = Field(description="Number of vPCs")
    is_healthy: bool = Field(description="Whether vPC is healthy")
    raw_output: str = Field(description="Raw command output")


class NVEPeer(BaseModel):
    """An NVE (VXLAN) peer."""

    peer_ip: str = Field(description="Peer VTEP IP")
    state: str = Field(description="Peer state")
    learn_type: str = Field(description="Learning type (CP/DP)")
    uptime: str = Field(description="Time since up")
    is_up: bool = Field(description="Whether peer is up")


class NVEPeersResult(BaseModel):
    """Result of NVE peers verification."""

    switch: str = Field(description="Switch hostname")
    peers: list[NVEPeer] = Field(description="List of NVE peers")
    total_count: int = Field(description="Total number of peers")
    up_count: int = Field(description="Number of up peers")
    down_count: int = Field(description="Number of down peers")
    raw_output: str = Field(description="Raw command output")


class InterfaceStatus(BaseModel):
    """Status of a network interface."""

    name: str = Field(description="Interface name")
    admin_state: str = Field(description="Administrative state")
    oper_state: str = Field(description="Operational state")
    speed: str = Field(description="Interface speed")
    type: str = Field(description="Interface type")


class InterfaceErrors(BaseModel):
    """Error counters for an interface."""

    name: str = Field(description="Interface name")
    input_errors: int = Field(description="Input errors")
    output_errors: int = Field(description="Output errors")
    crc_errors: int = Field(description="CRC errors")
    input_discards: int = Field(description="Input discards")
    output_discards: int = Field(description="Output discards")
    has_errors: bool = Field(description="Whether interface has errors")


class InterfaceErrorsResult(BaseModel):
    """Result of interface error check."""

    switch: str = Field(description="Switch hostname")
    interfaces: list[InterfaceErrors] = Field(description="List of interfaces with counters")
    interfaces_with_errors: int = Field(description="Number of interfaces with errors")
    raw_output: str = Field(description="Raw command output")


class SwitchStatus(BaseModel):
    """Quick health status of a switch."""

    switch: str = Field(description="Switch hostname")
    reachable: bool = Field(description="Whether switch is reachable")
    uptime: str = Field(description="System uptime")
    version: str = Field(description="NX-OS version")
    model: str = Field(description="Switch model")
    serial: str = Field(description="Serial number")
    cpu_usage: str = Field(description="CPU usage percentage")
    memory_usage: str = Field(description="Memory usage percentage")


class FabricHealthSummary(BaseModel):
    """Summary of overall fabric health."""

    total_switches: int = Field(description="Total switches in fabric")
    reachable_switches: int = Field(description="Number of reachable switches")
    ospf_healthy: bool = Field(description="All OSPF adjacencies healthy")
    bgp_healthy: bool = Field(description="All BGP sessions healthy")
    vpc_healthy: bool = Field(description="All vPC domains healthy")
    nve_healthy: bool = Field(description="All NVE peers healthy")
    overall_healthy: bool = Field(description="Overall fabric health")
    issues: list[str] = Field(description="List of detected issues")
