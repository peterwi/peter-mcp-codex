"""Configuration constants for my-tool."""

from pathlib import Path

# Cache configuration
CACHE_DIR = Path("/tmp/my-tool-cache")
CACHE_FILE = CACHE_DIR / "data.json"
METADATA_FILE = CACHE_DIR / "metadata.json"

# Output formats
OUTPUT_FORMATS = ("json", "table", "compact")
DEFAULT_FORMAT = "json"

# API configuration (example)
DEFAULT_TIMEOUT = 30
MAX_RETRIES = 3
