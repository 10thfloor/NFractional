#!/bin/sh
set -eu

# NATS JetStream setup for Fractional NFT SDK
# Usage:
#   chmod +x infra/nats/jetstream-setup.sh
#   NETWORK=testnet NATS_URL=nats://localhost:4222 ./infra/nats/jetstream-setup.sh

NATS_URL="${NATS_URL:-nats://localhost:4222}"
NETWORK="${NETWORK:-testnet}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
JS_DIR="${SCRIPT_DIR}/js"

echo "Using NATS server: ${NATS_URL} (network=${NETWORK})"

js_request() {
  sub="$1"; shift
  payload="$1"; shift || true
  if [ -z "${payload}" ]; then
    payload='{}'
  fi
  # Capture JSON response and check for JetStream error
  resp=$(nats -s "${NATS_URL}" request --timeout=5s "${sub}" "${payload}" 2>/dev/null || true)
  echo "${resp}"
  echo "${resp}" | grep -q '"error"' && echo "JS API error on ${sub}: ${resp}" 1>&2 && return 1
  return 0
}

render_json() {
  fpath="$1"; shift
  awk -v NETWORK="${NETWORK}" '{
    gsub(/\$\{NETWORK\}/, NETWORK);
    print;
  }' "${fpath}"
}

ensure_stream() {
  name="$1"; shift
  subjects="$1"; shift
  # Check via JS API
  if js_request "\$JS.API.STREAM.INFO.${name}" '{}' | grep -q '"config"'; then
    echo "Stream '${name}' already exists"
    return 0
  fi
  echo "Creating stream '${name}' with subjects: ${subjects}"
  cfg_file="${JS_DIR}/streams/${name}.json"
  if [ ! -f "${cfg_file}" ]; then
    echo "Missing stream config: ${cfg_file}" >&2
    exit 1
  fi
  cfg="$(render_json "${cfg_file}")"
  js_request "\$JS.API.STREAM.CREATE.${name}" "${cfg}" >/dev/null || {
    echo "Failed to create stream '${name}'" >&2
    exit 1
  }
  # Verify
  js_request "\$JS.API.STREAM.INFO.${name}" '{}' | grep -q '"config"' || {
    echo "Stream '${name}' not found after creation" >&2
    exit 1
  }
}

ensure_consumer() {
  stream="$1"; shift
  durable="$1"; shift
  filter="$1"; shift
  if js_request "\$JS.API.CONSUMER.INFO.${stream}.${durable}" '{}' | grep -q '"config"'; then
    echo "Consumer '${durable}' on stream '${stream}' already exists"
    return 0
  fi
  echo "Creating consumer '${durable}' on stream '${stream}' (filter=${filter})"
  cfile="${JS_DIR}/consumers/${stream}.${durable}.json"
  if [ ! -f "${cfile}" ]; then
    echo "Missing consumer config: ${cfile}" >&2
    exit 1
  fi
  ccfg="$(render_json "${cfile}")"
  js_request "\$JS.API.CONSUMER.DURABLE.CREATE.${stream}.${durable}" "${ccfg}" >/dev/null || {
    echo "Failed to create consumer '${durable}' on stream '${stream}'" >&2
    exit 1
  }
}

ensure_kv() {
  bucket="$1"; shift
  # KV implemented as a specialized stream named KV_<bucket>
  kv_stream="KV_${bucket}"
  if js_request "\$JS.API.STREAM.INFO.${kv_stream}" '{}' | grep -q '"config"'; then
    echo "KV bucket '${bucket}' already exists"
    return 0
  fi
  echo "Creating KV bucket '${bucket}'"
  kfile="${JS_DIR}/kv/${bucket}.json"
  if [ ! -f "${kfile}" ]; then
    echo "Missing KV config: ${kfile}" >&2
    exit 1
  fi
  kcfg="$(render_json "${kfile}")"
  js_request "\$JS.API.STREAM.CREATE.${kv_stream}" "${kcfg}" >/dev/null || {
    echo "Failed to create KV bucket stream '${kv_stream}'" >&2
    exit 1
  }
}

# Streams
ensure_stream "FLOW_EVENTS_RAW" "flow.events.raw.*.>"
ensure_stream "FLOW_EVENTS_NORM" "flow.events.norm.*.>"

# Durable consumer for normalized fractional events (indexer)
ensure_consumer "FLOW_EVENTS_NORM" "indexer" "flow.events.norm.${NETWORK}.>"

# KV bucket for indexer checkpoints (key format: ${NETWORK}.${CONSUMER})
ensure_kv "FLOW_INDEX_CHKPT"

echo "JetStream setup complete."


