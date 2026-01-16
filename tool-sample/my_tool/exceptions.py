"""Custom exceptions for my-tool."""


class MyToolError(Exception):
    """Base exception for my-tool."""

    pass


class ConfigurationError(MyToolError):
    """Configuration-related errors."""

    pass


class APIError(MyToolError):
    """API communication errors."""

    pass


class CacheError(MyToolError):
    """Cache-related errors."""

    pass


class ValidationError(MyToolError):
    """Input validation errors."""

    pass
