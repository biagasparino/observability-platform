#!/usr/bin/env bash
set -euo pipefail
URL="${API_URL:-http://localhost:3000}"
curl -s -X POST "$URL/chaos/reset"
echo
echo "All chaos scenarios reset to normal."
