# Security — OYSTER AI

## Non-negotiable rules (enforced today)

1. **Never enter wallet seed phrases, private keys, bank passwords, or card PINs.** The payout destination is a *reference* (public address or provider reference). It grants no spending or withdrawal permission.
2. **The AI has no money permissions.** No wallet signer, no payout processor, no autonomous spending path exists in this release. Revenue stays $0.00 until a verified, audited payment integration is added.
3. **The safety stop is independent of AI logic.** It is a database flag the AI cannot clear. While active, activation, discovery, and multiplication are blocked.
4. **Only verified ledger rows count.** Pending/unconfirmed values never display as collected money.
5. **No secrets in the frontend.** All provider configuration lives server-side; the client only ever sees masked destination references (`••••12345`).
6. **Parameterized SQL everywhere.** No string-built queries.
7. **Input validation on every endpoint.** Pydantic models with min/max lengths; unknown fields rejected.

## Current limitations (be honest, be safe)

This foundation release is a **local development demo**:

- `DEMO_MODE=true` disables the owner bearer-token guard. Do not expose the API to the public internet in demo mode.
- No account authentication, sessions, or CSRF protection yet — local/loopback only.
- SQLite single-file storage; fine for development, not for production.
- No rate limiting, no HTTPS termination (use a local reverse proxy if you need LAN testing over TLS).

## Pre-production checklist (must complete before any real use)

- [ ] PostgreSQL + Alembic migrations with encrypted storage at rest
- [ ] Audited identity provider (OAuth2/OIDC) with secure HttpOnly, SameSite cookie sessions
- [ ] CSRF defense on all state-changing endpoints
- [ ] Strict CORS allowlist (never `*`)
- [ ] Rate limiting / brute-force protection
- [ ] Secrets manager (AWS Secrets Manager / Vault) — no secrets in env files committed to the repo
- [ ] Signed payment-provider webhooks + idempotency keys + reconciliation job
- [ ] Immutable, exported audit logs
- [ ] Security review / penetration test before handling any real financial data
- [ ] Legal & compliance review for every jurisdiction you operate in (tax, business registration, consumer law)

## If something goes wrong

- Use the dashboard's **Emergency safety stop** to pause all autonomous activity.
- In this release, with external actions disabled, the realistic worst case is bad local data — the stop exists to build the habit and the audit trail for future releases.
- Report suspected issues via GitHub Issues on this repository.
