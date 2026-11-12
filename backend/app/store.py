"""OYSTER AI — persistence layer.

SQLite for local development; schema is intentionally PostgreSQL-friendly
(serial ids, ISO timestamps, constraints) so Alembic migrations later are
mechanical, not a rewrite.

Security: every query is parameterized. No exceptions.
"""
import os
import sqlite3
from contextlib import contextmanager

DB_PATH = os.getenv("DATABASE_PATH", "./oyster.sqlite3")

SCHEMA = """
CREATE TABLE IF NOT EXISTS settings (
    k TEXT PRIMARY KEY,
    v TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS instances (
    id          TEXT PRIMARY KEY,
    generation  INTEGER NOT NULL CHECK (generation >= 1),
    parent      TEXT REFERENCES instances(id),
    name        TEXT NOT NULL,
    status      TEXT NOT NULL CHECK (status IN ('active','paused','closed')),
    threshold_cents INTEGER NOT NULL,
    used_cents  INTEGER NOT NULL DEFAULT 0,
    created     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS businesses (
    id          TEXT PRIMARY KEY,
    instance_id TEXT NOT NULL REFERENCES instances(id),
    name        TEXT NOT NULL,
    category    TEXT NOT NULL,
    status      TEXT NOT NULL CHECK (status IN
        ('researching','planning','building','testing','active',
         'improving','unprofitable','suspended','closed')),
    created     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS opportunities (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    category    TEXT NOT NULL,
    rationale   TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'proposal',
    cost_cents  INTEGER NOT NULL DEFAULT 0,
    created     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
    id          TEXT PRIMARY KEY,
    instance_id TEXT REFERENCES instances(id),
    business_id TEXT REFERENCES businesses(id),
    type        TEXT NOT NULL CHECK (type IN ('revenue','expense','payout','reinvestment','refund')),
    amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
    currency    TEXT NOT NULL DEFAULT 'USD',
    status      TEXT NOT NULL CHECK (status IN ('pending','verified','failed','reconciled')),
    external_ref TEXT UNIQUE,
    created     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activity (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    event       TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'info',
    instance_id TEXT,
    details     TEXT NOT NULL DEFAULT '',
    created     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS safety (
    id      INTEGER PRIMARY KEY CHECK (id = 1),
    stopped INTEGER NOT NULL DEFAULT 0 CHECK (stopped IN (0,1)),
    reason  TEXT NOT NULL DEFAULT ''
);

INSERT OR IGNORE INTO safety (id, stopped, reason) VALUES (1, 0, '');

CREATE INDEX IF NOT EXISTS idx_activity_created ON activity(created DESC);
CREATE INDEX IF NOT EXISTS idx_tx_status ON transactions(status, type);
CREATE INDEX IF NOT EXISTS idx_instances_parent ON instances(parent);
"""


@contextmanager
def connect():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA foreign_keys = ON")
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    with connect() as c:
        c.executescript(SCHEMA)


def log(c, event: str, status: str = "info", instance_id: str | None = None, details: str = ""):
    """Append-only activity log write (commit happens via context manager)."""
    c.execute(
        "INSERT INTO activity(event, status, instance_id, details) VALUES (?,?,?,?)",
        (event, status, instance_id, details),
    )


def get_setting(c, key: str) -> str:
    row = c.execute("SELECT v FROM settings WHERE k = ?", (key,)).fetchone()
    return row["v"] if row else ""


def set_setting(c, key: str, value: str):
    c.execute(
        "INSERT INTO settings(k, v) VALUES(?,?) "
        "ON CONFLICT(k) DO UPDATE SET v = excluded.v",
        (key, value),
    )


def is_stopped(c) -> bool:
    row = c.execute("SELECT stopped FROM safety WHERE id = 1").fetchone()
    return bool(row["stopped"])