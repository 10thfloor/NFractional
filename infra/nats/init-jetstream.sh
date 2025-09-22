#!/bin/sh
set -e

# Simple NATS JetStream initialization using nats CLI
# This can be run from any machine that has nats CLI installed and can reach NATS

NATS_URL="${NATS_URL:-nats://flow-nats.internal:4222}"
NETWORK="${NETWORK:-testnet}"

echo "Initializing NATS JetStream streams (network=${NETWORK})"

# Create FLOW_EVENTS_RAW stream
nats -s "${NATS_URL}" stream add FLOW_EVENTS_RAW \
  --subjects "flow.events.raw.*.>" \
  --storage file \
  --retention limits \
  --max-bytes 536870912 \
  --discard old \
  --duplicate-window 120s \
  --replicas 1 \
  --no-allow-rollup \
  --no-deny-delete \
  --no-deny-purge || echo "Stream FLOW_EVENTS_RAW may already exist"

# Create FLOW_EVENTS_NORM stream  
nats -s "${NATS_URL}" stream add FLOW_EVENTS_NORM \
  --subjects "flow.events.norm.*.>" \
  --storage file \
  --retention limits \
  --max-bytes 536870912 \
  --discard old \
  --duplicate-window 120s \
  --replicas 1 \
  --no-allow-rollup \
  --no-deny-delete \
  --no-deny-purge || echo "Stream FLOW_EVENTS_NORM may already exist"

# Create consumer for indexer
nats -s "${NATS_URL}" consumer add FLOW_EVENTS_NORM indexer \
  --filter "flow.events.norm.${NETWORK}.fractional.*" \
  --ack explicit \
  --deliver all \
  --replay instant \
  --max-pending 10000 || echo "Consumer indexer may already exist"

# Create KV bucket for checkpoints
nats -s "${NATS_URL}" kv add FLOW_INDEX_CHKPT \
  --replicas 1 \
  --max-bytes 536870912 || echo "KV bucket FLOW_INDEX_CHKPT may already exist"

echo "JetStream initialization complete"

