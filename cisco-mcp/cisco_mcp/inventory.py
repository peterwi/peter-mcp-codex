"""Switch inventory management for Cisco MCP server."""

import os
from pathlib import Path
from typing import Optional

from cisco_mcp.models import Switch, SwitchInventory, SwitchRole


class SwitchInventoryManager:
    """Manages the switch inventory loaded from switches.txt."""

    def __init__(self, inventory_file: Optional[str] = None):
        """Initialize inventory manager.

        Args:
            inventory_file: Path to switches.txt. Defaults to switches.txt in project root.
        """
        if inventory_file is None:
            # Default to switches.txt in the project root
            project_root = Path(__file__).parent.parent
            inventory_file = str(project_root / "switches.txt")

        self.inventory_file = inventory_file
        self._switches: list[Switch] = []
        self._loaded = False

    def load(self) -> None:
        """Load switch inventory from file."""
        self._switches = []

        if not os.path.exists(self.inventory_file):
            raise FileNotFoundError(f"Inventory file not found: {self.inventory_file}")

        with open(self.inventory_file) as f:
            for line in f:
                line = line.strip()
                # Skip comments and empty lines
                if not line or line.startswith("#"):
                    continue

                parts = line.split()
                if len(parts) >= 2:
                    ip = parts[0]
                    hostname = parts[1]

                    # Determine role from parts or hostname
                    if len(parts) >= 3:
                        role_str = parts[2].lower()
                    else:
                        # Infer from hostname
                        hostname_lower = hostname.lower()
                        if hostname_lower.startswith("ss"):
                            role_str = "spine"
                        elif hostname_lower.startswith("bl"):
                            role_str = "border"
                        else:
                            role_str = "leaf"

                    # Map role string to enum
                    role_map = {
                        "spine": SwitchRole.SPINE,
                        "leaf": SwitchRole.LEAF,
                        "border": SwitchRole.BORDER,
                    }
                    role = role_map.get(role_str, SwitchRole.LEAF)

                    # Get rack from parts or extract from hostname
                    if len(parts) >= 4:
                        rack = parts[3]
                    else:
                        # Extract rack from hostname (e.g., LS1a-TIG-6A7 -> 6A7)
                        rack_parts = hostname.split("-")
                        rack = rack_parts[-1] if len(rack_parts) > 1 else "unknown"

                    self._switches.append(
                        Switch(hostname=hostname, ip=ip, role=role, rack=rack)
                    )

        self._loaded = True

    @property
    def switches(self) -> list[Switch]:
        """Get all switches, loading if necessary."""
        if not self._loaded:
            self.load()
        return self._switches

    def get_inventory(self) -> SwitchInventory:
        """Get the complete switch inventory as a structured object."""
        switches = self.switches
        return SwitchInventory(
            switches=switches,
            total_count=len(switches),
            spine_count=len([s for s in switches if s.role == SwitchRole.SPINE]),
            leaf_count=len([s for s in switches if s.role == SwitchRole.LEAF]),
            border_count=len([s for s in switches if s.role == SwitchRole.BORDER]),
        )

    def get_switch_by_name(self, name: str) -> Optional[Switch]:
        """Get a switch by hostname or short name.

        Args:
            name: Full hostname or short name (e.g., 'SS1' or 'SS1-TIG-6A21')
        """
        name_lower = name.lower()
        for switch in self.switches:
            if switch.hostname.lower() == name_lower:
                return switch
            if switch.short_name.lower() == name_lower:
                return switch
        return None

    def get_switch_by_ip(self, ip: str) -> Optional[Switch]:
        """Get a switch by IP address."""
        for switch in self.switches:
            if switch.ip == ip:
                return switch
        return None

    def get_switches_by_role(self, role: SwitchRole) -> list[Switch]:
        """Get all switches with a specific role."""
        return [s for s in self.switches if s.role == role]

    def get_switches_by_rack(self, rack: str) -> list[Switch]:
        """Get all switches in a specific rack."""
        rack_lower = rack.lower()
        return [s for s in self.switches if s.rack.lower() == rack_lower]

    def get_spines(self) -> list[Switch]:
        """Get all spine switches."""
        return self.get_switches_by_role(SwitchRole.SPINE)

    def get_leafs(self) -> list[Switch]:
        """Get all leaf switches (including border leafs)."""
        return [
            s
            for s in self.switches
            if s.role in (SwitchRole.LEAF, SwitchRole.BORDER)
        ]

    def get_border_leafs(self) -> list[Switch]:
        """Get all border leaf switches."""
        return self.get_switches_by_role(SwitchRole.BORDER)

    def get_tor_leafs(self) -> list[Switch]:
        """Get all ToR leaf switches (excluding border leafs)."""
        return self.get_switches_by_role(SwitchRole.LEAF)

    def get_all_hostnames(self) -> list[str]:
        """Get list of all switch hostnames."""
        return [s.hostname for s in self.switches]

    def get_all_ips(self) -> list[str]:
        """Get list of all switch IPs."""
        return [s.ip for s in self.switches]


# Global inventory instance
_inventory: Optional[SwitchInventoryManager] = None


def get_inventory() -> SwitchInventoryManager:
    """Get the global inventory manager instance."""
    global _inventory
    if _inventory is None:
        _inventory = SwitchInventoryManager()
    return _inventory


def reload_inventory() -> SwitchInventoryManager:
    """Reload the inventory from file."""
    global _inventory
    _inventory = SwitchInventoryManager()
    _inventory.load()
    return _inventory
