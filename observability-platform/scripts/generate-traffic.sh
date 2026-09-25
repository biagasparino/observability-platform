#!/usr/bin/env bash
# Generates a steady baseline of traffic against the app so the dashboards
# have something to show before/after you inject a fault.
set -euo pipefail

URL="${1:-http://localhost:3000}"
DURATION="${2:-120}"

echo "Sending traffic to $URL for ${DURATION}s..."
END=$((SECONDS + DURATION))

while [ $SECONDS -lt $END ]; do
  curl -s -o /dev/null "$URL/orders"
  curl -s -o /dev/null -X POST "$URL/orders" \
    -H "Content-Type: application/json" \
    -d '{"item":"demo-item","amount_cents": 1999}'
  sleep 0.2
done

echo "Done."
