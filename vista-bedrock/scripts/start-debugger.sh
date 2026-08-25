#!/bin/bash
# Start the Vista script debugger server
# This server allows Minecraft Bedrock to connect for script debugging

echo "Starting Vista Script Debugger Server..."
echo "========================================"
echo ""
echo "Make sure you have enabled in your world:"
echo "  - Beta APIs experiment"
echo "  - Script Debugger experiment"
echo ""
echo "In Minecraft, use one of these commands:"
echo "  /script debugger connect"
echo "  /script debugger vista.sami-s.dev:19144"
echo ""
echo "Or connect VS Code using .vscode/launch.json"
echo ""

cd "$(dirname "$0")/.."
node scripts/debugger-server/server.js
