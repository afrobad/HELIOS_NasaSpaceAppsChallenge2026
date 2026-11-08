#!/usr/bin/env bash
# Starts a local web server (needed because browsers block loading 3D models from file://)
cd "$(dirname "$0")"
node tools/gen-manifest.mjs 2>/dev/null || true
echo "Open http://localhost:5173"
if command -v python3 >/dev/null; then python3 -m http.server 5173; else npx --yes http-server . -p 5173 -c-1; fi
