# Security Hardening Deployment Guide

This document outlines the steps required to deploy the security-hardened version of the application.

## Local Development Setup

### 1. Create `.env` file

Create a `.env` file in the repository root with the following variables:

```bash
# API Service Secrets (REQUIRED in production)
ADMIN_API_KEY=$(openssl rand -hex 32)
FLOW_ADMIN_SIGN_SECRET=$(openssl rand -hex 32)
CORS_ORIGIN=http://localhost:3000

# Flow Platform Admin
FRACTIONAL_PLATFORM_ADMIN_ADDRESS=179b6b1cb6755e31
FRACTIONAL_PLATFORM_ADMIN_KEY=<your-platform-admin-private-key-hex>

# Optional: Dev/Test Minter Account
FLOW_MINTER_ADDR=f8d6e0586b0a20c7
FLOW_MINTER_KEY=<your-minter-private-key-hex>

# Infrastructure Passwords
GF_SECURITY_ADMIN_PASSWORD=$(openssl rand -hex 16)
NATS_SYS_USER=sys
NATS_SYS_PASSWORD=$(openssl rand -hex 16)
NATS_APP_USER=app
NATS_APP_PASSWORD=$(openssl rand -hex 16)

# Network Configuration
FLOW_NETWORK=emulator
FLOW_ACCESS=http://host.docker.internal:8888

# Database Configuration
CASSANDRA_CONTACT_POINTS=scylla
CASSANDRA_KEYSPACE=fractional
```

### 2. Update NATS Configuration

If you're using custom NATS passwords, you'll need to update `infra/nats/nats.conf` to match your `.env` file, or use a wrapper script to substitute environment variables.

### 3. Restart Services

```bash
docker-compose down
docker-compose up -d
```

## Fly.io Deployment

### API Service (flow-gql-api)

#### 1. Set Required Secrets

```bash
flyctl secrets set \
  ADMIN_API_KEY=$(openssl rand -hex 32) \
  FLOW_ADMIN_SIGN_SECRET=$(openssl rand -hex 32) \
  CORS_ORIGIN=https://flow-web.fly.dev \
  -a flow-gql-api
```

#### 2. Set Optional Secrets (if using dev endpoints)

```bash
flyctl secrets set \
  FLOW_MINTER_ADDR=<address> \
  FLOW_MINTER_KEY=<key> \
  -a flow-gql-api
```

#### 3. Set Platform Admin Secrets

```bash
flyctl secrets set \
  FRACTIONAL_PLATFORM_ADMIN_ADDRESS=<address> \
  FRACTIONAL_PLATFORM_ADMIN_KEY=<private_key_hex> \
  -a flow-gql-api
```

#### 4. Verify Secrets

```bash
flyctl secrets list -a flow-gql-api
```

#### 5. Deploy Updated Code

```bash
flyctl deploy -a flow-gql-api
```

### Web Service (flow-web)

#### 1. Get Admin API Key from API Service

```bash
# Get the ADMIN_API_KEY from flow-gql-api secrets
flyctl secrets get ADMIN_API_KEY -a flow-gql-api
```

#### 2. Set Admin API Key in Web Service

```bash
# Set the same ADMIN_API_KEY value in web service
flyctl secrets set ADMIN_API_KEY=<same_value_from_api_service> -a flow-web
```

#### 3. Deploy Updated Code

```bash
flyctl deploy -a flow-web
```

## Verification Steps

### 1. Verify API Service Fails Fast Without Secrets

To test that the service properly validates secrets:

```bash
# Temporarily remove a required secret
flyctl secrets unset ADMIN_API_KEY -a flow-gql-api

# Deploy and verify service fails to start with clear error
flyctl deploy -a flow-gql-api

# Restore the secret
flyctl secrets set ADMIN_API_KEY=<value> -a flow-gql-api
```

### 2. Verify Admin-Sign Endpoint Requires Auth

```bash
# Test without Bearer token (should return 401)
curl -X POST https://flow-gql-api.fly.dev/flow/admin-sign \
  -H "Content-Type: application/json" \
  -d '{"signable": {}}'

# Test with invalid token (should return 401)
curl -X POST https://flow-gql-api.fly.dev/flow/admin-sign \
  -H "Authorization: Bearer invalid-token" \
  -H "Content-Type: application/json" \
  -d '{"signable": {}}'

# Test with valid token (should work)
curl -X POST https://flow-gql-api.fly.dev/flow/admin-sign \
  -H "Authorization: Bearer $(flyctl secrets get FLOW_ADMIN_SIGN_SECRET -a flow-gql-api)" \
  -H "Content-Type: application/json" \
  -d '{"signable": {}}'
```

### 3. Verify CORS Restrictions

```bash
# Test from unauthorized origin (should be blocked)
curl -X GET https://flow-gql-api.fly.dev/flow/addresses \
  -H "Origin: https://evil.com"

# Test from authorized origin (should work)
curl -X GET https://flow-gql-api.fly.dev/flow/addresses \
  -H "Origin: https://flow-web.fly.dev"
```

### 4. Check Logs for Sanitized Errors

```bash
# View API service logs
flyctl logs -a flow-gql-api

# Trigger an authentication error and verify:
# - Client-facing messages are generic
# - Server logs contain detailed information
```

## Security Checklist

- [ ] All secrets are set in Fly.io (no hardcoded defaults)
- [ ] ADMIN_API_KEY is strong (32+ bytes random)
- [ ] FLOW_ADMIN_SIGN_SECRET is strong (32+ bytes random)
- [ ] CORS_ORIGIN is set to explicit origin (not "*")
- [ ] Admin-sign endpoint requires Bearer token authentication
- [ ] Error messages don't expose internal variable names
- [ ] Debug logging is disabled in production
- [ ] Grafana password is changed from default
- [ ] NATS passwords are changed from defaults (if using auth)

## Troubleshooting

### Service Won't Start

If the service fails to start, check:

1. **Missing Secrets**: Verify all required secrets are set
   ```bash
   flyctl secrets list -a flow-gql-api
   ```

2. **Invalid CORS Configuration**: Ensure CORS_ORIGIN is not "*" in production
   ```bash
   flyctl secrets get CORS_ORIGIN -a flow-gql-api
   ```

3. **Check Logs**: View detailed error messages
   ```bash
   flyctl logs -a flow-gql-api
   ```

### Admin Endpoints Not Working

1. Verify ADMIN_API_KEY is set correctly in both API and web services
2. Check that the Bearer token matches FLOW_ADMIN_SIGN_SECRET
3. Ensure the Authorization header is formatted correctly: `Bearer <token>`

### CORS Errors

1. Verify CORS_ORIGIN matches your web app URL exactly (including protocol)
2. Check that credentials are allowed in CORS configuration
3. Ensure the Origin header is being sent correctly from the client

