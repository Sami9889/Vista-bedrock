# Vista Bedrock Script Debugger Server

Simple Node.js server for Minecraft Bedrock script debugging.

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm start
   # or
   ./scripts/start-debugger.sh
   ```

3. In Minecraft Bedrock:
   - Enable **Beta APIs** experiment
   - Enable **Script Debugger** experiment
   - Run: `/script debugger connect`

4. Or use VS Code:
   - Install "Minecraft Bedrock Edition Debugger" extension
   - Press F5 to attach

## Environment Variables

- `PORT` - Port to listen on (default: 19144)
- `DEBUGGER_HOST` - Hostname for debugger connection

## Connecting from Minecraft

The game can connect to the debugger using:
- `/script debugger connect` - connects to localhost:19144
- `/script debugger vista.sami-s.dev:19144` - connects to remote server

## How It Works

The Bedrock script debugger allows you to:
- Set breakpoints in `main.js`
- Inspect variables and camera state
- Step through camera/viewfinder/TV logic
- Debug the `globalThis.__vista_camera_state` integration

The `CAMERA_MANAGER` in `main.js` tracks all viewfinder positions as virtual cameras, working around Bedrock's single-camera limit.
