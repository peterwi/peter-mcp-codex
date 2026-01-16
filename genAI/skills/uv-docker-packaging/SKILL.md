---
name: UV Docker Packaging
description: UV-based Python environment packaging for Docker containers. Use when containerising Python applications, configuring multi-stage Docker builds, optimising image sizes, or deploying applications with UV dependency management. Provides Dockerfile templates, project setup patterns, and best practices for development and production workflows.
category: development
---

# UV Docker Packaging

UV-based Python environment for containerised applications.

## Installation

```bash
# Install UV
curl -LsSf https://astral.sh/uv/install.sh | sh

# Or via pip
pip install uv
```

## Quick Start

```bash
# New project
uv init my-project
cd my-project

# Add dependencies
uv add requests pandas

# Build Docker image
docker build -t my-app .
```

## Usage

### Project Setup
```bash
# Create project
uv init project-name

# Production dependencies
uv add fastapi uvicorn

# Development dependencies
uv add --dev pytest black ruff
```

### Docker Configuration

#### Basic Dockerfile
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN pip install uv && uv sync --frozen
COPY . .
CMD ["uv", "run", "python", "main.py"]
```

#### Multi-stage Build
```dockerfile
FROM python:3.11-slim as builder
RUN pip install uv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

FROM python:3.11-slim
COPY --from=builder /.venv /.venv
COPY . .
CMD ["/.venv/bin/python", "main.py"]
```

## Examples

### Basic Web API
```bash
# Setup
uv init web-api
cd web-api
uv add fastapi uvicorn

# Docker build
docker build -t web-api .
docker run -p 8000:8000 web-api
```

### Development Workflow
```bash
# Install dependencies
uv sync

# Run application
uv run python main.py

# Run tests
uv run pytest

# Format code
uv run ruff format .
```

### Production Build
```bash
# Lock dependencies
uv lock

# Build optimised image
docker build -f Dockerfile.prod -t app:latest .

# Run container
docker run -p 8000:8000 app:latest
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| UV not found | Install via curl or pip |
| Dependency conflicts | Run `uv lock --upgrade` |
| Docker build fails | Ensure pyproject.toml and uv.lock copied correctly |
