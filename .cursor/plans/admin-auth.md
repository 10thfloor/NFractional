# Admin Auth Plan for Sensitive Endpoints

## Objectives

- Enforce admin-only access on server for sensitive mutations.
- Provide a safe client path (no secret leakage) to invoke required admin actions (e.g., treasury setup) used by the UI.
- Keep behavior consistent across emulator/testnet with clear env configuration.

## Endpoints requiring admin auth (server)

- Already guarded by `isAdminRequest()` (x-admin-auth == ADMIN_API_KEY):
- `ensureVaultTreasury(network, vaultId)`
- `setVaultMaxSupply(network, vaultId, maxSupply)`
- `mintShares(network, vaultId, recipient, amount)`
- `configureShareSupply(network, vaultId, maxSupply, escrowAmount, escrowRecipient)`
- `setTransferMode(network, symbol, mode)`
- `scheduleFeeActivation(network, vaultId)`
- `scheduleFeeParams(network, vaultId, feeBps, vaultSplitBps, protocolSplitBps, effectiveAt)`
- `scheduleDistribution(network, vaultId, programId, asset, totalAmount, schedule, startsAt, endsAt)`

- Keep public (no admin header):
- `registerVaultFromNFT` (server performs admin follow-ups internally; no client secret needed)
- All read-only queries and user-driven actions already client-signed via wallet

## Server enforcement & configuration

- Env: `ADMIN_API_KEY` (API service)
- Validation: reject missing or incorrect `x-admin-auth`
- Logging: log admin caller IP and route (without secrets)
- Rate limit: optional (e.g., Fastify plugin) for admin routes

## Client access patterns

- Never expose admin secret to the browser.
- Web app adds a Next.js server route that proxies admin GraphQL mutations:
- `web/src/app/api/admin/ensure-vault-treasury/route.ts` → forwards GraphQL with `x-admin-auth: process.env.ADMIN_API_KEY` (server-only env)
- Accepts `{ vaultId }`, injects `network`, forwards to `services/api` GraphQL
- Update UI helpers to call the web API proxy instead of calling the API GraphQL admin mutation directly from the browser.

## Files to change

- `web/src/lib/graphql.ts`: add a server-side admin fetch helper (for optional server usage)
- `web/src/app/api/admin/ensure-vault-treasury/route.ts`: new proxy route
- `web/src/lib/api/pools.ts`: update `ensureVaultTreasury` to call the new proxy when running in the browser
- `web/src/app/vaults/[vaultId]/components/SwapPanel.tsx`: include `platformAdmin` in effect deps; keep preflight
- `web/src/app/pools/components/PoolCard.tsx`: include `platformAdmin` in effect deps; keep preflight

## Env & secrets

- API service: `ADMIN_API_KEY` (required)
- Web app: no public admin key; use server-only env (e.g., `ADMIN_API_KEY`) in Next.js route
- Document env setup in `services/api/README.md` and `web/README.md`

## UX & error handling

- If proxy returns 401/"unauthorized": show concise hint: "Admin backend not configured; contact operator"
- Retry preflight once on swap error with invalid capability

## Verification steps

- Emulator: add/remove treasuries; validate swap both directions
- Testnet: confirm proxy works with configured ADMIN_API_KEY; no secrets in client bundle
- Confirm that share_to_flow routes fee using per‑vault share receiver; flow_to_share routes FLOW fee

## Optional hardening (later)

- Signature-based admin auth (JWT or HMAC) instead of static header
- IP allowlist for admin routes
- Structured audit logs for admin mutations
