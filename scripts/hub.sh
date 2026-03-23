#!/usr/bin/env bash
cd "$(dirname "$0")/hub"
[ -d node_modules ] || npm install --silent
exec node hub.js "$@"
