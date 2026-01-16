"""Generic MCP server factory - DRY implementation for MCP tools."""

import asyncio
from mcp.server import Server
from mcp.server.stdio import stdio_server


def create_server(name: str, tools: list, execute_func):
    """Create MCP server with standard configuration.

    Args:
        name: Server name (e.g., "my-tool")
        tools: List of tool definitions
        execute_func: Async function to execute tools

    Returns:
        Configured Server instance and main function
    """
    app = Server(name)

    @app.list_tools()
    async def list_tools():
        return tools

    @app.call_tool()
    async def call_tool(name: str, arguments: dict):
        return await execute_func(name, arguments)

    async def run():
        async with stdio_server() as (read_stream, write_stream):
            await app.run(read_stream, write_stream, app.create_initialization_options())

    def main():
        asyncio.run(run())

    return app, main
