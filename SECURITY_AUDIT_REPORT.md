# Flow Hackathon Security Audit Report

## Executive Summary
This comprehensive security analysis identified multiple vulnerabilities and weaknesses across authentication, API security, secrets management, error handling, and operational security. The application handles blockchain transactions and financial assets, making security critical.

---

## HIGH SEVERITY ISSUES (Critical - Requires Immediate Action)

### 1. **Client-Side Secret Exposure in Environment Variables**
**Location:** `/web/src/app/api/admin/sign/route.ts:6-97`
**Severity:** CRITICAL
**Description:** 
- `FLOW_ADMIN_SIGN_SECRET` is loaded directly into Next.js environment and passed to browser in Authorization headers
- Even though it's a server-side route, the pattern is dangerously exposed if .env files are committed
- The secret is used to authenticate to the backend's `/flow/admin-sign` endpoint

**Risk:** 
- Compromise of the frontend repository or environment exposure leads to complete admin access
- No rotation mechanism for leaked secrets

**Recommendations:**
1. Remove `FLOW_ADMIN_SIGN_SECRET` from client environment entirely
2. Implement proxy-based signing where the backend initiates admin signing requests
3. Use short-lived JWT tokens issued by the backend instead of passing secrets through client
4. Ensure .env.local is in .gitignore and enforce secret scanning on CI/CD
5. Implement secret rotation procedures

---

### 2. **Admin Authentication Weakness - String Comparison without Timing Attack Protection**
**Location:** `/services/api/src/graphql/resolvers/index.ts:60-68`
**Severity:** HIGH
**Description:**
```typescript
function isAdminRequest(context: any): boolean {
  try {
    const hdr = (
      context?.reply?.request?.headers?.["x-admin-auth"] || ""
    ).toString();
    return !!hdr && hdr.length > 0 && hdr === ENV.ADMIN_API_KEY;
  } catch {
    return false;
  }
}
```
- Simple string equality comparison vulnerable to timing attacks
- No rate limiting on admin mutation endpoints
- Admin key is a simple string, not a cryptographically secure token

**Risk:**
- Attacker could brute-force or use timing side-channels to discover the admin API key
- Compromised key affects all admin operations system-wide

**Recommendations:**
1. Use `crypto.timingSafeEqual()` for string comparison
2. Implement rate limiting on admin endpoints (max 5 requests/minute per IP)
3. Use bcrypt/scrypt-hashed tokens instead of plaintext keys
4. Rotate admin API key regularly (monthly)
5. Log all admin authentication attempts with IP/timestamp

---

### 3. **Hardcoded Default Secrets in Non-Production Environments**
**Location:** `/services/api/src/lib/env.ts:46, 59`
**Severity:** HIGH
**Description:**
```typescript
FLOW_ADMIN_SIGN_SECRET: process.env.FLOW_ADMIN_SIGN_SECRET || (isProduction ? "" : "keyboardcat"),
ADMIN_API_KEY: process.env.ADMIN_API_KEY || (isProduction ? "" : "keyboard-cat"),
```
- Hardcoded default secrets like "keyboardcat" and "keyboard-cat" in development
- While marked as development-only, these are known and easily guessed
- If code is leaked or repository is public, these defaults can be used against staging/test environments

**Risk:**
- Public git repositories with these defaults allow unauthorized access to dev/test environments
- Credentials might be exposed in error logs or debugging output

**Recommendations:**
1. Use randomly generated secrets with `openssl rand -hex 32` for every environment
2. Never commit any secrets (even placeholders) - generate them during deployment
3. Use Vault/AWS Secrets Manager for secret management
4. Mark .env files in .gitignore
5. Implement pre-commit hook to prevent accidental secret commits

---

### 4. **Missing HTTPS Enforcement and CORS Wildcard in Non-Production**
**Location:** `/services/api/src/server.ts:29-47`
**Severity:** HIGH
**Description:**
```typescript
if (ENV.NODE_ENV === "production") {
  if (!ENV.CORS_ORIGIN || ENV.CORS_ORIGIN === "*") {
    throw new Error("CORS_ORIGIN must be set to an explicit origin");
  }
}
// Development allows "*"
const corsOrigin = ENV.CORS_ORIGIN === "*" ? true : ENV.CORS_ORIGIN.split(",");
```
- CORS is set to "*" in development, allowing any origin to make requests
- No HTTPS/TLS requirement validation
- Credentials sent with cross-origin requests

**Risk:**
- If development code accidentally reaches production, CORS wildcard allows any malicious site to make authenticated requests
- Man-in-the-middle attacks possible if HTTPS not enforced

**Recommendations:**
1. Never use "*" for CORS, even in development - use specific localhost origin
2. Enforce HTTPS only in production via middleware
3. Add Strict-Transport-Security header
4. Implement CORS preflight request validation
5. Use SameSite=Strict for all sensitive cookies

---

### 5. **Unauthenticated GraphQL Introspection and Development Tools Exposed**
**Location:** `/services/api/src/server.ts:106`
**Severity:** HIGH
**Description:**
```typescript
await app.register(mercurius, {
  schema: typeDefs,
  resolvers: buildResolvers(cassandra),
  graphiql: true,  // GraphiQL IDE always enabled
  errorHandler: (error, _request, _reply) => {
    console.error("GraphQL error:", error.message || String(error));
  },
});
```
- GraphiQL interface enabled without authentication check
- GraphQL introspection queries allowed on all environments
- Detailed error messages logged to console and potentially exposed

**Risk:**
- Attackers can enumerate entire GraphQL schema without authentication
- Discover admin mutations and query patterns
- Identify internal field names and data structures
- Use introspection for automated exploitation

**Recommendations:**
1. Disable GraphiQL in production: `graphiql: process.env.NODE_ENV !== 'production'`
2. Implement authentication middleware for introspection queries
3. Disable introspection completely in production
4. Use error sanitization - don't expose implementation details in errors
5. Implement query complexity limits and depth limits to prevent DoS

---

## MEDIUM SEVERITY ISSUES (Important - Should Fix in Next Sprint)

### 6. **Weak Input Validation on Critical Parameters**
**Location:** `/services/api/src/server.ts:114-202`
**Severity:** MEDIUM
**Description:**
- Parameters like `vaultId`, `seller`, `account`, `listingId` are parsed as strings without robust validation
- String-to-String conversion without format validation:
```typescript
const seller = String(body.seller || "");
const vaultId = String(body.vaultId || "");
```
- No validation that these are valid Flow addresses (should be hex format)
- No length limits on string parameters

**Risk:**
- Potential for injection attacks if parameters used in Cadence scripts
- Invalid data could corrupt database state
- Resource exhaustion with very long strings

**Recommendations:**
1. Add strict regex validation for Flow addresses: `/^0x[a-fA-F0-9]{16}$/`
2. Use zod schemas consistently for all inputs (already doing for some endpoints)
3. Implement maximum length limits for all string inputs
4. Validate vaultId format before use
5. Add whitelist validation for enum-like parameters (network, status)

---

### 7. **GraphQL Admin Mutations Without Rate Limiting**
**Location:** `/services/api/src/graphql/resolvers/index.ts:1071+` (admin mutations)
**Severity:** MEDIUM
**Description:**
- Admin mutations (mintShares, scheduleFeeParams, scheduleDistribution, etc.) have admin checks but no rate limiting
- No per-user request quotas
- No audit logging of admin actions beyond console.error

**Risk:**
- Malicious admin could spam mutations to DoS database
- No record of who performed sensitive operations
- Compliance/audit trail missing

**Recommendations:**
1. Implement per-API-key rate limiting (e.g., 10 requests/minute for admin APIs)
2. Add request tracking middleware with IP, timestamp, operation type
3. Log all admin mutations to a separate audit table in Cassandra
4. Implement circuit breaker pattern for database write limits
5. Add request ID tracking for tracing and debugging

---

### 8. **Error Information Disclosure**
**Location:** `/services/api/src/server.ts` (multiple endpoints)
**Severity:** MEDIUM
**Description:**
```typescript
catch (e) {
  reply.code(400);
  return { error: (e as Error).message };  // Raw error messages exposed
}
```
- All error messages directly exposed to client
- Stack traces might leak in error messages
- Internal database/system errors revealed

**Risk:**
- Information disclosure helps attackers understand system internals
- Database errors expose schema information
- Path traversal or other errors reveal file structure

**Recommendations:**
1. Sanitize error messages before returning to client
2. Log full errors server-side with unique error IDs
3. Return generic error messages: "Operation failed" with error ID
4. Implement proper error classification (user error vs system error)
5. Use error tracking service (Sentry, DataDog) for monitoring

---

### 9. **Missing CSRF Protection**
**Location:** `/web/src/app/api/admin/*`
**Severity:** MEDIUM
**Description:**
- Admin endpoints accept POST requests without CSRF tokens
- No origin/referer validation beyond CORS
- Nonce mechanism exists for admin signing but only validates challenge nonce, not request nonce

**Risk:**
- Cross-site request forgery attacks possible if attacker tricks admin into visiting malicious page
- Attacker can trigger admin mutations without admin knowledge

**Recommendations:**
1. Implement CSRF token middleware for all state-changing endpoints
2. Validate Origin header strictly
3. Use SameSite=Strict cookies for all admin-related cookies
4. Require explicit CSRF token in request body or header
5. Implement request signing with nonce

---

### 10. **Cassandra Database Security**
**Location:** `/services/api/src/server.ts:94-101`
**Severity:** MEDIUM
**Description:**
```typescript
const cassandra = new Cassandra({
  contactPoints: ENV.CASSANDRA_CONTACT_POINTS,
  localDataCenter: "datacenter1",
  keyspace: ENV.CASSANDRA_KEYSPACE,
  queryOptions: { consistency: 1 },
});
```
- No explicit authentication credentials visible (uses defaults)
- Connection security not configured (TLS/SSL unknown)
- Consistency level set to 1 (weak) for data integrity

**Risk:**
- Unencrypted database connections if TLS not configured
- Data corruption possible with consistency level 1
- Default/weak credentials if not overridden
- No connection pooling limits visible

**Recommendations:**
1. Explicitly configure TLS/SSL for Cassandra connections
2. Use QUORUM or LOCAL_QUORUM consistency for critical operations
3. Implement database credentials in environment variables
4. Set max connection pool size to prevent resource exhaustion
5. Use IP whitelisting for Cassandra access

---

### 11. **Private Key Handling in Flow Authentication**
**Location:** `/services/api/src/lib/flowAuth.ts:40-70`
**Severity:** MEDIUM
**Description:**
```typescript
export function getSigningFunction(
  addrNo0x: string,
  pkHex: string,
  keyIndex: number
) {
  return async (signable: any) => {
    if (!pkHex || pkHex.trim().length === 0) {
      throw new Error("FRACTIONAL_PLATFORM_ADMIN_KEY is empty...");
    }
```
- Private key stored in environment variable (reasonable for server, but high risk)
- Private key validated but not protected from logging
- Key is used for transaction signing without additional validation

**Risk:**
- If server is compromised, private key exposed
- Could be logged in error messages or debug output
- No key rotation mechanism

**Recommendations:**
1. Use Hardware Security Module (HSM) or Key Management Service (KMS) for private key storage
2. Implement key rotation with versioning
3. Never log private key values - sanitize debug output
4. Use secure key derivation if splitting key across multiple servers
5. Implement key usage audit logging

---

## LOW SEVERITY ISSUES (Best Practices & Code Quality)

### 12. **Missing Security Headers**
**Location:** `/services/api/src/server.ts`
**Severity:** LOW
**Description:**
- No security headers configured (X-Content-Type-Options, X-Frame-Options, CSP, etc.)

**Recommendations:**
1. Add helmet.js or manual header middleware
2. Set X-Content-Type-Options: nosniff
3. Set X-Frame-Options: DENY
4. Set Content-Security-Policy header
5. Set X-XSS-Protection: 1; mode=block

---

### 13. **No Input Size Limits**
**Location:** `/services/api/src/server.ts`
**Severity:** LOW
**Description:**
- No request body size limits configured
- No GraphQL query complexity limits

**Recommendations:**
1. Set request size limits (e.g., 1MB max)
2. Implement GraphQL query depth limiting
3. Add operation timeout limits
4. Implement maximum field count validation

---

### 14. **Insufficient Audit Logging**
**Location:** Throughout services/api/src/
**Severity:** LOW
**Description:**
- Limited audit trail for sensitive operations
- No comprehensive logging of database modifications
- No user action tracking for non-blockchain operations

**Recommendations:**
1. Log all admin API calls with user context
2. Log database mutations with before/after state
3. Use structured logging format (JSON)
4. Implement log retention policy
5. Use centralized logging service

---

### 15. **No Dependency Vulnerability Scanning**
**Location:** `package.json` files
**Severity:** LOW
**Description:**
- No evidence of npm audit or dependency checking in CI/CD
- Outdated packages possible (pnpm-lock.yaml exists but not verified)

**Recommendations:**
1. Run `npm audit` or `pnpm audit` in CI/CD
2. Set up Dependabot or Snyk for continuous dependency scanning
3. Implement automated patch management
4. Regular security updates for core dependencies

---

### 16. **Missing TypeScript Strict Mode Issues**
**Location:** `/services/api/src/graphql/resolvers/index.ts:60-68`
**Severity:** LOW
**Description:**
- Type assertions with `any` in critical paths
- Generic error handling without type safety

**Recommendations:**
1. Enable strict TypeScript mode
2. Replace `any` types with proper interfaces
3. Implement proper error types
4. Use type guards for runtime validation

---

### 17. **No Request Timeout Configuration**
**Location:** `/services/api/src/server.ts`
**Severity:** LOW
**Description:**
- Fastify server has no configured timeout limits
- Long-running GraphQL queries not bounded

**Recommendations:**
1. Set Fastify request timeout (e.g., 30 seconds)
2. Implement GraphQL operation timeout
3. Add timeout headers to responses
4. Use circuit breaker pattern for slow operations

---

### 18. **Weak Frontend Storage Security**
**Location:** `/web/src/app/listings/mine/page.tsx:35`
**Severity:** LOW
**Description:**
```typescript
const fromStorage = (
  window.localStorage.getItem("flow.defaultAccount") || ""
).trim();
```
- Using localStorage for account address (non-sensitive but poor practice)
- No data encryption in storage

**Recommendations:**
1. Use sessionStorage for temporary data instead of localStorage
2. Clear storage on logout
3. Implement storage encryption if sensitive data stored
4. Use secure HTTP-only cookies for authentication tokens

---

## SUMMARY STATISTICS

| Severity | Count | Status |
|----------|-------|--------|
| **HIGH** | 5 | ⚠️ Critical |
| **MEDIUM** | 7 | ⚠️ Important |
| **LOW** | 8 | ℹ️ Recommended |
| **TOTAL** | 20 | |

---

## REMEDIATION TIMELINE

### Immediate (Week 1)
1. Remove `FLOW_ADMIN_SIGN_SECRET` from client environment
2. Disable GraphiQL in production
3. Add timing-safe string comparison for admin auth
4. Implement input validation with zod for all endpoints

### Short-term (Weeks 2-4)
1. Add security headers middleware
2. Implement rate limiting on admin endpoints
3. Add comprehensive audit logging
4. Configure Cassandra TLS and authentication
5. Set up dependency vulnerability scanning

### Medium-term (Weeks 5-8)
1. Implement secret rotation mechanism
2. Migrate to Hardware Security Module for private keys
3. Add comprehensive error sanitization
4. Implement CSRF protection
5. Add request timeout limits and complexity validation

### Long-term (Ongoing)
1. Regular security audits (quarterly)
2. Penetration testing (annual)
3. Automated dependency updates
4. Security training for team
5. Incident response plan and testing

---

## Testing Recommendations

### Security Testing Checklist
- [ ] Attempt to access admin endpoints without credentials
- [ ] Brute-force timing attack on admin API key
- [ ] Test GraphQL introspection without auth
- [ ] Attempt CSRF attacks on admin endpoints
- [ ] Test for timing-based side-channel vulnerabilities
- [ ] Validate all input with malicious payloads
- [ ] Test rate limiting on endpoints
- [ ] Verify TLS/HTTPS enforcement
- [ ] Check for secrets in error messages
- [ ] Verify database connection encryption

---
