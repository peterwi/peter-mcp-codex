"""Async SSH client for Cisco switch communication."""

import asyncio
import logging
import os
import re
from pathlib import Path
from typing import Optional

import asyncssh

from cisco_mcp.models import CommandResult

logger = logging.getLogger(__name__)

# Default SSH settings
DEFAULT_SSH_KEY = os.path.expanduser("~/.ssh/cisco-key")
DEFAULT_USERNAME = "cisco-mcp"
DEFAULT_TIMEOUT = 30  # seconds
DEFAULT_COMMAND_TIMEOUT = 60  # seconds for long commands


class SSHConnectionError(Exception):
    """Raised when SSH connection fails."""

    pass


class CommandExecutionError(Exception):
    """Raised when command execution fails."""

    pass


class InvalidCommandError(Exception):
    """Raised when an invalid (non-read-only) command is attempted."""

    pass


# Allowed command prefixes for read-only operations
ALLOWED_COMMAND_PREFIXES = (
    "show ",
    "display ",
    "dir ",
    "pwd",
    "terminal length",
    "terminal width",
)

# Explicitly blocked command patterns
BLOCKED_COMMAND_PATTERNS = [
    r"^conf",  # configure
    r"^copy",
    r"^delete",
    r"^write",
    r"^reload",
    r"^shutdown",
    r"^no\s+",
    r"^clear\s+(?!counters)",  # allow clear counters
    r"^debug",
    r"^undebug",
]


def validate_command(command: str) -> None:
    """Validate that a command is read-only.

    Args:
        command: The command to validate.

    Raises:
        InvalidCommandError: If the command is not allowed.
    """
    cmd = command.strip().lower()

    # Check if command starts with allowed prefix
    if not any(cmd.startswith(prefix) for prefix in ALLOWED_COMMAND_PREFIXES):
        raise InvalidCommandError(
            f"Command '{command}' is not allowed. Only 'show' commands are permitted."
        )

    # Double-check against blocked patterns
    for pattern in BLOCKED_COMMAND_PATTERNS:
        if re.match(pattern, cmd):
            raise InvalidCommandError(
                f"Command '{command}' matches blocked pattern and is not allowed."
            )


def mask_sensitive_output(output: str) -> str:
    """Mask sensitive information in command output.

    Args:
        output: Raw command output.

    Returns:
        Output with sensitive data masked.
    """
    # Mask passwords and keys
    patterns = [
        (r"(password\s*[=:]\s*)(\S+)", r"\1********"),
        (r"(key\s*[=:]\s*)(\S+)", r"\1********"),
        (r"(secret\s*[=:]\s*)(\S+)", r"\1********"),
        (r"(md5\s+\d+\s+)(\S+)", r"\1********"),
        (r"(community\s+)(\S+)", r"\1********"),
    ]

    result = output
    for pattern, replacement in patterns:
        result = re.sub(pattern, replacement, result, flags=re.IGNORECASE)

    return result


class CiscoSSHClient:
    """Async SSH client for Cisco NX-OS switches."""

    def __init__(
        self,
        host: str,
        username: str = DEFAULT_USERNAME,
        key_file: str = DEFAULT_SSH_KEY,
        timeout: int = DEFAULT_TIMEOUT,
    ):
        """Initialize SSH client.

        Args:
            host: Switch IP address or hostname.
            username: SSH username.
            key_file: Path to SSH private key.
            timeout: Connection timeout in seconds.
        """
        self.host = host
        self.username = username
        self.key_file = key_file
        self.timeout = timeout
        self._connection: Optional[asyncssh.SSHClientConnection] = None

    async def connect(self) -> None:
        """Establish SSH connection to the switch."""
        if self._connection is not None:
            return

        # Check if key file exists
        if not Path(self.key_file).exists():
            raise SSHConnectionError(f"SSH key file not found: {self.key_file}")

        try:
            self._connection = await asyncio.wait_for(
                asyncssh.connect(
                    self.host,
                    username=self.username,
                    client_keys=[self.key_file],
                    known_hosts=None,  # Accept any host key (lab environment)
                ),
                timeout=self.timeout,
            )
            logger.info(f"Connected to {self.host}")
        except asyncio.TimeoutError:
            raise SSHConnectionError(
                f"Connection to {self.host} timed out after {self.timeout}s"
            )
        except asyncssh.Error as e:
            raise SSHConnectionError(f"SSH connection to {self.host} failed: {e}")
        except OSError as e:
            raise SSHConnectionError(f"Network error connecting to {self.host}: {e}")

    async def disconnect(self) -> None:
        """Close SSH connection."""
        if self._connection is not None:
            self._connection.close()
            await self._connection.wait_closed()
            self._connection = None
            logger.info(f"Disconnected from {self.host}")

    async def execute_command(
        self,
        command: str,
        timeout: int = DEFAULT_COMMAND_TIMEOUT,
        validate: bool = True,
    ) -> str:
        """Execute a command on the switch.

        Args:
            command: Command to execute.
            timeout: Command execution timeout in seconds.
            validate: Whether to validate command is read-only.

        Returns:
            Command output.

        Raises:
            InvalidCommandError: If command is not allowed (when validate=True).
            CommandExecutionError: If command execution fails.
            SSHConnectionError: If not connected.
        """
        if validate:
            validate_command(command)

        if self._connection is None:
            await self.connect()

        try:
            # Add terminal length 0 to prevent pagination
            full_command = f"terminal length 0 ; {command}"

            result = await asyncio.wait_for(
                self._connection.run(full_command),
                timeout=timeout,
            )

            output = result.stdout or ""
            # Mask any sensitive data
            output = mask_sensitive_output(output)

            if result.exit_status != 0:
                stderr = result.stderr or ""
                if stderr:
                    raise CommandExecutionError(
                        f"Command failed with exit status {result.exit_status}: {stderr}"
                    )

            return output

        except asyncio.TimeoutError:
            raise CommandExecutionError(
                f"Command '{command}' timed out after {timeout}s"
            )
        except asyncssh.Error as e:
            raise CommandExecutionError(f"Error executing command: {e}")

    async def __aenter__(self) -> "CiscoSSHClient":
        """Async context manager entry."""
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Async context manager exit."""
        await self.disconnect()


class SSHConnectionPool:
    """Pool of SSH connections for efficient switch access."""

    def __init__(
        self,
        username: str = DEFAULT_USERNAME,
        key_file: str = DEFAULT_SSH_KEY,
        max_connections_per_host: int = 2,
    ):
        """Initialize connection pool.

        Args:
            username: SSH username.
            key_file: Path to SSH private key.
            max_connections_per_host: Maximum connections per switch.
        """
        self.username = username
        self.key_file = key_file
        self.max_connections_per_host = max_connections_per_host
        self._connections: dict[str, CiscoSSHClient] = {}
        self._lock = asyncio.Lock()

    async def get_connection(self, host: str) -> CiscoSSHClient:
        """Get or create a connection to a host.

        Args:
            host: Switch IP address or hostname.

        Returns:
            Connected SSH client.
        """
        async with self._lock:
            if host not in self._connections:
                client = CiscoSSHClient(
                    host=host,
                    username=self.username,
                    key_file=self.key_file,
                )
                await client.connect()
                self._connections[host] = client

            return self._connections[host]

    async def execute_command(
        self,
        host: str,
        command: str,
        timeout: int = DEFAULT_COMMAND_TIMEOUT,
    ) -> str:
        """Execute a command on a switch.

        Args:
            host: Switch IP address.
            command: Command to execute.
            timeout: Command timeout.

        Returns:
            Command output.
        """
        client = await self.get_connection(host)
        return await client.execute_command(command, timeout)

    async def execute_on_multiple(
        self,
        hosts: list[str],
        command: str,
        hostnames: Optional[list[str]] = None,
        timeout: int = DEFAULT_COMMAND_TIMEOUT,
    ) -> list[CommandResult]:
        """Execute a command on multiple switches concurrently.

        Args:
            hosts: List of switch IP addresses.
            command: Command to execute.
            hostnames: Optional list of hostnames (for result labeling).
            timeout: Command timeout.

        Returns:
            List of command results.
        """
        if hostnames is None:
            hostnames = hosts

        async def execute_single(host: str, hostname: str) -> CommandResult:
            try:
                output = await self.execute_command(host, command, timeout)
                return CommandResult(
                    switch=hostname,
                    command=command,
                    output=output,
                    success=True,
                )
            except (SSHConnectionError, CommandExecutionError, InvalidCommandError) as e:
                return CommandResult(
                    switch=hostname,
                    command=command,
                    output="",
                    success=False,
                    error=str(e),
                )

        tasks = [
            execute_single(host, hostname)
            for host, hostname in zip(hosts, hostnames)
        ]
        return await asyncio.gather(*tasks)

    async def close_all(self) -> None:
        """Close all connections in the pool."""
        async with self._lock:
            for client in self._connections.values():
                await client.disconnect()
            self._connections.clear()
            logger.info("All connections closed")

    async def __aenter__(self) -> "SSHConnectionPool":
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Async context manager exit."""
        await self.close_all()
