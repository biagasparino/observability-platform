#!/usr/bin/env bash
# Usage: ./scripts/inject-fault.sh latency|errors|db-exhaust [value]
set -euo pipefail

URL="${API_URL:-http://localhost:3000}"
SCENARIO="${1:?Usage: inject-fault.sh <latency|errors|db-exhaust> [value]}"
VALUE="${2:-}"

case "$SCENARIO" in
  latency)
    MS="${VALUE:-2500}"
    curl -s -X POST "$URL/chaos/latency" -H "Content-Type: application/json" -d "{\"ms\": $MS}"
    echo
    echo "Injected ${MS}ms of latency into /orders. Watch the Duration panel on the RED dashboard."
    ;;
  errors)
    RATE="${VALUE:-0.5}"
    curl -s -X POST "$URL/chaos/errors" -H "Content-Type: application/json" -d "{\"rate\": $RATE}"
    echo
    echo "Injecting 5xx on ~$(echo "$RATE * 100" | bc)% of requests. Watch the Errors panel and HighHttp5xxRate alert."
    ;;
  db-exhaust)
    COUNT="${VALUE:-8}"
    curl -s -X POST "$URL/chaos/db-exhaust" -H "Content-Type: application/json" -d "{\"connections\": $COUNT}"
    echo
    echo "Holding $COUNT database connections. Watch db_pool_connections_in_use approach the max on the USE dashboard."
    ;;
  *)
    echo "Unknown scenario: $SCENARIO (expected latency, errors, or db-exhaust)"
    exit 1
    ;;
esac
