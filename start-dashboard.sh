#!/bin/bash
# If bioclaw is already running on 3847 (via launchd), just wait.
# Otherwise start the dev server.
if lsof -i :3847 -sTCP:LISTEN -t > /dev/null 2>&1; then
  echo "BioClaw dashboard already running on port 3847"
  # Keep process alive so preview tool considers it running
  while true; do sleep 60; done
else
  cd "$(dirname "$0")"
  exec npm run dev
fi
