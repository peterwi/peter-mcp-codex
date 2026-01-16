"""CLI for my-tool.

This is a sample CLI implementation demonstrating common patterns.
Copy and customize for your own tools.
"""

import json
import click

from . import constants
from .exceptions import MyToolError


@click.group()
@click.version_option()
def main() -> None:
    """My Tool - A sample CLI tool template.

    This tool demonstrates common patterns for building CLI tools
    with Click. Copy and customize for your own use cases.

    Examples:

      my-tool hello World

      my-tool process "input data" --format json

      my-tool cache status
    """
    pass


@main.command()
@click.argument("name")
def hello(name: str) -> None:
    """Say hello to NAME.

    A simple example command that takes an argument.

    Examples:

      my-tool hello World

      my-tool hello "John Doe"
    """
    click.echo(f"Hello, {name}!")


@main.command()
@click.argument("input")
@click.option(
    "--format",
    "-f",
    "fmt",
    type=click.Choice(constants.OUTPUT_FORMATS, case_sensitive=False),
    default=constants.DEFAULT_FORMAT,
    help="Output format",
)
@click.option(
    "--verbose",
    "-v",
    is_flag=True,
    default=False,
    help="Enable verbose output",
)
def process(input: str, fmt: str, verbose: bool) -> None:
    """Process INPUT and display results.

    Demonstrates argument handling, options, and output formatting.

    Examples:

      my-tool process "test data"

      my-tool process "data" --format table

      my-tool process "data" -f json -v
    """
    try:
        if verbose:
            click.echo(f"Processing: {input}")

        # Example processing logic
        result = {
            "input": input,
            "length": len(input),
            "words": len(input.split()),
            "uppercase": input.upper(),
        }

        # Format and output
        output = _format_output(result, fmt)
        click.echo(output)

    except MyToolError as e:
        click.echo(f"Error: {e}", err=True)
        raise SystemExit(1)


@main.group()
def cache() -> None:
    """Cache management commands.

    Commands for managing the local cache.
    """
    pass


@cache.command(name="status")
def cache_status() -> None:
    """Show cache status.

    Displays information about the cache including location,
    size, and last update time.

    Example:

      my-tool cache status
    """
    status = {
        "cache_dir": str(constants.CACHE_DIR),
        "cache_file": str(constants.CACHE_FILE),
        "exists": constants.CACHE_FILE.exists(),
    }

    if status["exists"]:
        status["size_bytes"] = constants.CACHE_FILE.stat().st_size

    click.echo(f"Cache directory: {status['cache_dir']}")
    click.echo(f"Cache file: {status['cache_file']}")
    click.echo(f"Exists: {status['exists']}")
    if status.get("size_bytes"):
        click.echo(f"Size: {status['size_bytes']} bytes")


@cache.command(name="clear")
def cache_clear() -> None:
    """Clear the cache.

    Removes all cached data. Use this if you need fresh data
    or to free up disk space.

    Example:

      my-tool cache clear
    """
    if constants.CACHE_FILE.exists():
        constants.CACHE_FILE.unlink()
        click.echo("Cache cleared.")
    else:
        click.echo("Cache is already empty.")


def _format_output(data: dict, fmt: str) -> str:
    """Format data for output."""
    if fmt == "json":
        return json.dumps(data, indent=2)
    elif fmt == "table":
        lines = ["Key                  Value", "-" * 40]
        for key, value in data.items():
            lines.append(f"{key:<20} {value}")
        return "\n".join(lines)
    else:
        # Compact format
        return " | ".join(f"{k}={v}" for k, v in data.items())


if __name__ == "__main__":
    main()
