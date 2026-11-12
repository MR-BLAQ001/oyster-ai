# Install on macOS — OYSTER AI

## Prerequisites

- macOS with **Python 3.11+** (`python3 --version`)
- **Node.js 20+** and npm (`node --version`)
- Git

## Setup

1. Clone and enter the repo:

```sh
git clone https://github.com/MR-BLAQ001/oyster-ai.git
cd oyster-ai
git checkout develop
cp .env.example .env
```

2. Start the backend (terminal 1):

```sh
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The SQLite database file is created automatically on first run. API docs: http://localhost:8000/docs

3. Start the frontend (terminal 2):

```sh
cd frontend
npm install
npm run dev -- --hostname 0.0.0.0
```

4. Open **http://localhost:3000**

## Running tests

```sh
cd backend
source .venv/bin/activate
python -m unittest discover -s tests -v
```

Expected result: all domain policy tests pass (threshold math, eligibility gates, destination validation).

## Notes

- Keep `DEMO_MODE=true` for local use. Demo mode disables the owner bearer-token guard — for loopback/LAN only, never the public internet.
- To reset all data: stop the backend and delete `backend/oyster.sqlite3`.
- The `--host 0.0.0.0` flag binds to your LAN so your phone can reach the app (see INSTALL_ANDROID.md).
