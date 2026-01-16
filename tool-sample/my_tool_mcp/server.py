"""MCP server for my-tool.

This server exposes my-tool functionality to AI assistants via MCP.
"""

import asyncio
from mcp.server import Server
from mcp.server.stdio import stdio_server

from .tools import TOOLS, execute_tool

app = Server("my-tool")


@app.list_tools()
async def list_tools():
    """Return list of available tools."""
    return TOOLS


@app.call_tool()
async def call_tool(name: str, arguments: dict):
    """Execute a tool by name with given arguments."""
    return await execute_tool(name, arguments)


def main():
    """Entry point for MCP server."""
    asyncio.run(stdio_server(app))


if __name__ == "__main__":
    main()
