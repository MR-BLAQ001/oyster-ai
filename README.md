# OYSTER AI

**Your Self-Growing AI Business Ecosystem — Build. Grow. Earn.**

OYSTER AI is a safety-first application for researching, monitoring, and reviewing legitimate online business opportunities. This repository contains the foundation of that application: a responsive web dashboard (Next.js PWA) and a backend API (FastAPI) with persistent records, deterministic policies, and owner-controlled safety boundaries.

## What this project IS

- A working dashboard UI for desktop and mobile (installable PWA).
- A FastAPI backend with persistent SQLite storage (PostgreSQL-ready schema).
- A deterministic multiplication-threshold policy ($10 base, +$1 per generation) with unit tests.
- A proposal-only opportunity research engine — it creates review records, never external actions.
- An owner-controlled emergency safety stop.
- Honest accounting: verified-ledger values only, starting from a real zero.

## What this project is NOT

- It does **not** autonomously earn money or guarantee any income.
- It does **not** hold wallet keys, bank credentials, or withdrawal permissions — ever.
- It does **not** deploy real businesses, call payment providers, or spend funds in this foundation release.
- No AI provider is connected; paid APIs are disabled by default. Deterministic proposal rules are active.

## Slogans

> Build. Grow. Earn.
> Set it once. Let it grow.

## Repository layout (Stage 1)

```
oyster-ai/
├── README.md
├── ARCHITECTURE.md
├── SECURITY.md
├── INSTALL_MAC.md
├── INSTALL_ANDROID.md
├── .env.example
├── .gitignore
├── LICENSE
├── backend/          # FastAPI app, domain policies, tests
└── frontend/        # Next.js app, PWA assets
```

## Quick start (macOS)

1. `cp .env.example .env`
2. Backend: `cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
3. Frontend (new terminal): `cd frontend && npm install && npm run dev -- --hostname 0.0.0.0`
4. Open `http://localhost:3000` · API docs at `http://localhost:8000/docs`

Full setup instructions: see `INSTALL_MAC.md` and `INSTALL_ANDROID.md`.

## Tests

```
cd backend && python -m unittest discover -s tests -v
```

## Honest status

This is an actively developed foundation. Revenue, expenses, and payouts are **$0.00 by design** until verified payment integrations are built and reconciled. Nothing in this app should be read as a promise of earnings.

## License

MIT — see `LICENSE`.
