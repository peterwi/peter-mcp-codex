"""CLI tests for my-tool."""

import pytest
from click.testing import CliRunner
from my_tool.cli import main


class TestMainCommands:
    """Test main CLI commands."""

    def test_help(self, runner):
        """Test help output."""
        result = runner.invoke(main, ["--help"])
        assert result.exit_code == 0
        assert "My Tool" in result.output

    def test_version(self, runner):
        """Test version output."""
        result = runner.invoke(main, ["--version"])
        assert result.exit_code == 0
        assert "0.1.0" in result.output


class TestHelloCommand:
    """Test hello command."""

    def test_hello_basic(self, runner):
        """Test basic hello."""
        result = runner.invoke(main, ["hello", "World"])
        assert result.exit_code == 0
        assert "Hello, World!" in result.output

    def test_hello_with_spaces(self, runner):
        """Test hello with name containing spaces."""
        result = runner.invoke(main, ["hello", "John Doe"])
        assert result.exit_code == 0
        assert "Hello, John Doe!" in result.output


class TestProcessCommand:
    """Test process command."""

    def test_process_json_format(self, runner):
        """Test process with JSON output."""
        result = runner.invoke(main, ["process", "test data", "-f", "json"])
        assert result.exit_code == 0
        assert '"input": "test data"' in result.output
        assert '"length": 9' in result.output
        assert '"words": 2' in result.output

    def test_process_table_format(self, runner):
        """Test process with table output."""
        result = runner.invoke(main, ["process", "test", "--format", "table"])
        assert result.exit_code == 0
        assert "Key" in result.output
        assert "Value" in result.output

    def test_process_compact_format(self, runner):
        """Test process with compact output."""
        result = runner.invoke(main, ["process", "test", "-f", "compact"])
        assert result.exit_code == 0
        assert "input=test" in result.output

    def test_process_verbose(self, runner):
        """Test process with verbose flag."""
        result = runner.invoke(main, ["process", "test", "-v"])
        assert result.exit_code == 0
        assert "Processing:" in result.output


class TestCacheCommands:
    """Test cache subcommands."""

    def test_cache_status(self, runner):
        """Test cache status command."""
        result = runner.invoke(main, ["cache", "status"])
        assert result.exit_code == 0
        assert "Cache directory:" in result.output
        assert "Exists:" in result.output

    def test_cache_clear_empty(self, runner):
        """Test cache clear when cache doesn't exist."""
        result = runner.invoke(main, ["cache", "clear"])
        assert result.exit_code == 0
        # Should succeed even if cache doesn't exist
