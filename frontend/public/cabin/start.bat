@echo off
cd /d "%~dp0"
where node >nul 2>nul && node tools\gen-manifest.mjs
echo Open http://localhost:5173
where python >nul 2>nul && (python -m http.server 5173) || (npx --yes http-server . -p 5173 -c-1)
