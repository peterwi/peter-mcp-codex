#!/bin/bash
# setup-node.sh - Install Node.js 22.x from NodeSource
# Required for running perf-mcp MCP server

set -e

echo "=== Installing Node.js 22.x from NodeSource ==="

# Install prerequisites
echo "Installing prerequisites..."
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

# Add NodeSource GPG key
echo "Adding NodeSource repository..."
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
  | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg

# Add NodeSource repository
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
  | sudo tee /etc/apt/sources.list.d/nodesource.list >/dev/null

# Install Node.js
echo "Installing Node.js..."
sudo apt-get update
sudo apt-get install -y nodejs

# Verify installation
echo ""
echo "=== Node.js Installation Complete ==="
node --version
npm --version

echo ""
echo "You can now build and run perf-mcp:"
echo "  cd /opt/peter-mcp/perf-mcp"
echo "  npm install"
echo "  npm run build"
echo "  npm start"
