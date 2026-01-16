"""MCP tool definitions for my-tool.

Define your MCP tools here. Each tool should have:
- name: Unique identifier for the tool
- description: What the tool does (shown to AI assistants)
- inputSchema: JSON Schema for the tool's parameters
"""

import json
from typing import Any

from mcp.types import Tool, TextContent

from my_tool import constants
from my_tool.exceptions import MyToolError


TOOLS = [
    Tool(
        name="my_tool_hello",
        description="""Say hello to someone.

        A simple example tool that demonstrates basic MCP tool structure.

        Example:
          my_tool_hello(name="World") -> "Hello, World!"
        """,
        inputSchema={
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Name to greet",
                }
            },
            "required": ["name"],
        },
    ),
    Tool(
        name="my_tool_process",
        description="""Process input text and return analysis.

        Analyzes the input text and returns statistics including
        length, word count, and uppercase version.

        Example:
          my_tool_process(input="hello world") -> {length: 11, words: 2, ...}
        """,
        inputSchema={
            "type": "object",
            "properties": {
                "input": {
                    "type": "string",
                    "description": "Text to process",
                },
                "format": {
                    "type": "string",
                    "enum": ["json", "table", "compact"],
                    "description": "Output format",
                    "default": "json",
                },
            },
            "required": ["input"],
        },
    ),
    Tool(
        name="my_tool_cache_status",
        description="""Get cache status information.

        Returns information about the tool's cache including
        location, existence, and size.
        """,
        inputSchema={
            "type": "object",
            "properties": {},
        },
    ),
]


async def execute_tool(name: str, arguments: dict) -> Any:
    """Execute MCP tool and return results.

    Routes tool calls to appropriate handlers and formats responses.
    """
    try:
        if name == "my_tool_hello":
            return await hello_handler(arguments)
        elif name == "my_tool_process":
            return await process_handler(arguments)
        elif name == "my_tool_cache_status":
            return await cache_status_handler(arguments)
        else:
            return [TextContent(type="text", text=f"Unknown tool: {name}")]

    except MyToolError as e:
        return [TextContent(type="text", text=f"Error: {e}")]
    except Exception as e:
        return [TextContent(type="text", text=f"Unexpected error: {e}")]


async def hello_handler(arguments: dict) -> list[TextContent]:
    """Handle hello tool calls."""
    name = arguments.get("name", "World")
    result = f"Hello, {name}!"
    return [TextContent(type="text", text=result)]


async def process_handler(arguments: dict) -> list[TextContent]:
    """Handle process tool calls."""
    input_text = arguments["input"]
    fmt = arguments.get("format", "json")

    # Process the input
    result = {
        "input": input_text,
        "length": len(input_text),
        "words": len(input_text.split()),
        "uppercase": input_text.upper(),
    }

    # Format output
    if fmt == "json":
        output = json.dumps(result, indent=2)
    elif fmt == "table":
        lines = ["Key                  Value", "-" * 40]
        for key, value in result.items():
            lines.append(f"{key:<20} {value}")
        output = "\n".join(lines)
    else:
        output = " | ".join(f"{k}={v}" for k, v in result.items())

    return [TextContent(type="text", text=output)]


async def cache_status_handler(arguments: dict) -> list[TextContent]:
    """Handle cache status tool calls."""
    status = {
        "cache_dir": str(constants.CACHE_DIR),
        "cache_file": str(constants.CACHE_FILE),
        "exists": constants.CACHE_FILE.exists(),
    }

    if status["exists"]:
        status["size_bytes"] = constants.CACHE_FILE.stat().st_size

    return [TextContent(type="text", text=json.dumps(status, indent=2))]
