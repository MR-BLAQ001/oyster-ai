# Architecture — OYSTER AI

## High-level design

OYSTER AI is a modular monolith with two deployable units:

```
┌──────────────────────────┐         ┌──────────────────────────┐
│  Frontend (Next.js PWA)  │  HTTP   │   Backend (FastAPI)      │
│  - Dashboard UI          │ ──────► │  - REST API              │
│  - Responsive layouts    │  JSON   │  - Domain policies       │
│  - PWA (manifest + SW)   │         │  - SQLite persistence    │
└──────────────────────────┘         └──────────────────────────┘
```

## Frontend (`frontend/`)

- **Next.js 14 (App Router) + TypeScript + CSS**
- Responsive layout: desktop (sidebar + main + right rail) and mobile (single column + bottom nav)
- **Lucide** icons, custom CSS design tokens (palette locked to brand colors)
- PWA: web manifest, service worker (shell caching only — financial data is never cached), SVG icon
- All state comes from the API. The frontend does not persist financial data in localStorage.

## Backend (`backend/`)

- **FastAPI + Pydantic** validation on every input
- **SQLite** local persistence (parameterized queries only; schema is PostgreSQL-migration-ready)
- **Domain layer (`app/domain.py`)** — pure, deterministic, provider-independent policies:
  - `threshold(generation)` → $10 base, +$1 per generation (configurable formula, no hardcoded example lists)
  - `can_multiply(...)` → eligibility gate: verified net funds − commitments ≥ threshold, no double-use, no safety stop
  - `valid_destination(kind, value)` → structural validation of payout destinations (never accepts credentials)
- **Engine layer (`app/engine.py`)** — proposal-only opportunity discovery. Creates reviewable records; performs no external actions, no scraping, no spending.
- **Emergency safety stop** — a single table-level flag that blocks activation, discovery, and multiplication, independent of any AI logic.

## Data model (SQLite tables)

| Table | Purpose |
|---|---|
| `settings` | Owner profile, destination reference, activation state, currency |
| `instances` | AI business instances: id, generation, parent, threshold, used funds, status |
| `businesses` | Business records linked to instances, lifecycle status |
| `opportunities` | Research proposals (never auto-executed) |
| `transactions` | Ledger entries; only `status='verified'` counts toward totals |
| `activity` | Append-only activity log of system events |
| `safety` | Emergency stop flag + reason |

## API surface (v0.1)

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/health` | GET | Liveness + demo-mode flag |
| `/api/dashboard` | GET | Aggregated dashboard state |
| `/api/setup` | POST | Save payout destination reference (never credentials) |
| `/api/activate` | POST | Initialize root monitoring instance (requires double acknowledgement) |
| `/api/opportunities/discover` | POST | Generate review proposals (no external actions) |
| `/api/network` | GET | Instance lineage + business list |
| `/api/network/multiply` | POST | Threshold-gated child-instance creation |
| `/api/earnings` | GET | Verified-ledger totals + transaction history |
| `/api/activity` | GET | Activity log |
| `/api/safety-stop` | POST | Enable/clear emergency stop |

## Financial integrity rules

1. **Only `status='verified'` ledger rows count.** Pending, simulated, or unconfirmed values never display as collected money.
2. **No client-supplied balances.** Multiplication eligibility is computed server-side from the ledger.
3. **Double-entry intent:** revenue/expense rows are separate types with a single ledger; future double-entry + reconciliation layer will build on this schema.
4. **Real zero:** an empty ledger displays $0.00. We never seed fake earnings.

## Safety boundaries (enforced in code)

- No seed phrase, private key, bank password, or PIN is ever accepted — the destination field is a public reference only.
- No wallet signer, payout processor, or autonomous spending path exists in this release.
- The safety stop is a database flag independent of AI logic; the AI cannot clear it itself.
- All API inputs are length-limited and validated (Pydantic), and all SQL is parameterized.

## Production path (not yet implemented)

- PostgreSQL + Alembic migrations, Redis queue + background workers, auth provider with sessions/CSRF, signed provider webhooks with reconciliation, Docker deploy, CI (GitHub Actions), observability. See SECURITY.md for the full pre-production checklist.
