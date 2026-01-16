"""Shared test fixtures for my-tool."""

import pytest
from pathlib import Path
from click.testing import CliRunner


@pytest.fixture
def runner():
    """Provide a Click CLI test runner."""
    return CliRunner()


@pytest.fixture
def temp_cache_dir(tmp_path):
    """Provide a temporary cache directory."""
    cache_dir = tmp_path / "cache"
    cache_dir.mkdir()
    return cache_dir


@pytest.fixture
def sample_data():
    """Provide sample test data."""
    return {
        "key": "value",
        "items": [1, 2, 3],
        "nested": {"a": 1, "b": 2},
    }
