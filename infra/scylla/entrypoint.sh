#!/bin/bash
set -e

# Detect Fly.io IPv6 address (fdaa: prefix)
# Try multiple methods to get the IPv6 address since 'ip' command may not be available
# Method 1: Check /proc/net/if_inet6 for fdaa: addresses
IPV6_ADDR=$(cat /proc/net/if_inet6 2>/dev/null | awk '{print $4}' | grep -E '^fdaa' | head -1 | sed 's/\(.\{4\}\)\(.\{4\}\)\(.\{4\}\)\(.\{4\}\)\(.\{4\}\)\(.\{4\}\)\(.\{4\}\)\(.\{4\}\)/\1:\2:\3:\4:\5:\6:\7:\8/')

# Method 2: If that fails, try parsing from hostname or environment
if [ -z "$IPV6_ADDR" ]; then
  # Fly.io may expose the private IP via FLY_PRIVATE_IP or similar
  IPV6_ADDR="${FLY_PRIVATE_IP:-}"
fi

# Method 3: If still empty, use 0.0.0.0 but we'll need broadcast-address
if [ -z "$IPV6_ADDR" ]; then
  echo "Warning: Could not detect Fly.io IPv6 address (fdaa:), using 0.0.0.0"
  IPV6_ADDR="0.0.0.0"
fi

echo "Using address: $IPV6_ADDR"

# Use Scylla's docker-entrypoint.py (same as FlyDatabases example)
# Use 256 tokens to match existing data (default for multi-node)
# If you want to use 1 token for single-node, clear the volume first:
# flyctl volumes destroy vol_<volume-id> -a flow-scylla
exec /docker-entrypoint.py \
  --seeds "${IPV6_ADDR}" \
  --smp "1" \
  --memory "512M" \
  --overprovisioned "1" \
  --num-tokens "256" \
  --api-address "${IPV6_ADDR}" \
  --listen-address "${IPV6_ADDR}" \
  --rpc-address "${IPV6_ADDR}" \
  --alternator-address "${IPV6_ADDR}" \
  --broadcast-address "${IPV6_ADDR}" \
  --broadcast-rpc-address "${IPV6_ADDR}"

