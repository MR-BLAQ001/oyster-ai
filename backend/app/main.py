"""OYSTER AI — FastAPI application.

Safety-first API. In this foundation release:
  - No payment provider, wallet signer, or external deployment path exists.
  - DEMO_MODE=true (default) disables the owner bearer-token guard — for
    loopback/LAN development only, NEVER the public internet.
  - Every state-changing endpoint respects the emergency safety stop.
"""
from __future__ import annotations

import os
import uuid

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import engine
from .domain import can_multiply, mask_destination, threshold, valid_destination
from .store import connect, get_setting, init_db, is_stopped, log, set_setting

DEMO = os.getenv("DEMO_MODE", "true").lower() == "true"
TOKEN = os.getenv("OWNER_API_TOKEN", "")

if not DEMO and not TOKEN:
    raise RuntimeError(
        "OWNER_API_TOKEN is required when DEMO_MODE=false. "
        "Refusing to start without owner authentication."
    )

app = FastAPI(
    title="OYSTER AI API",
    version="0.1.0",
    description="Safety-first monitoring and proposal API for the OYSTER AI ecosystem.",
)

origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # explicit allowlist; never "*"
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)


def require_owner(authorization: str | None = Header(default=None)) -> None:
    """Bearer-token guard, active only when DEMO_MODE=false."""
    if DEMO:
        return
    if not authorization or authorization != f"Bearer {TOKEN}":
        raise HTTPException(status_code=401, detail="Owner authorization required")


# ---------------------------------------------------------------- models


class SetupIn(BaseModel):
    owner_name: str = Field(min_length=1, max_length=100)
    destination_type: str = Field(pattern="^(crypto|bank|provider)$")
    destination: str = Field(min_length=4, max_length=180)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    provider: str = Field(default="manual reference", max_length=80)


class ActivateIn(BaseModel):
    acknowledged: bool
    accepts_no_guarantees: bool


class StopIn(BaseModel):
    enabled: bool
    reason: str = Field(default="Owner safety control", max_length=240)


# ---------------------------------------------------------------- startup


@app.on_event("startup")
def startup():
    init_db()


# ---------------------------------------------------------------- read endpoints


@app.get("/api/health")
def health():
    return {"status": "ok", "demo_mode": DEMO, "external_actions_enabled": False}


@app.get("/api/dashboard", dependencies=[Depends(require_owner)])
def dashboard():
    with connect() as c:
        activated = get_setting(c, "activated") == "true"
        destination = get_setting(c, "destination")
        inst = c.execute("SELECT COUNT(*) n FROM instances").fetchone()["n"]
        rev = c.execute(
            "SELECT COALESCE(SUM(amount_cents),0) n FROM transactions "
            "WHERE type='revenue' AND status IN ('verified','reconciled')"
        ).fetchone()["n"]
        exp = c.execute(
            "SELECT COALESCE(SUM(amount_cents),0) n FROM transactions "
            "WHERE type='expense' AND status IN ('verified','reconciled')"
        ).fetchone()["n"]
        acts = [dict(r) for r in c.execute(
            "SELECT * FROM activity ORDER BY id DESC LIMIT 10")]
        ops = [dict(r) for r in c.execute(
            "SELECT * FROM opportunities ORDER BY created DESC LIMIT 10")]
        stopped = is_stopped(c)

    status = "paused by safety system" if stopped else ("active" if activated else "ready to launch")
    return {
        "demo_mode": DEMO,
        "activated": activated,
        "setup_complete": bool(destination),
        "network_status": status,
        "instances": inst,
        "revenue_cents": rev,
        "expenses_cents": exp,
        "net_profit_cents": rev - exp,
        "currency": get_setting(c, "currency") or "USD",
        "owner_name": get_setting(c, "owner_name"),
        "destination_masked": mask_destination(destination) if destination else "",
        "activities": acts,
        "opportunities": ops,
    }


@app.get("/api/network", dependencies=[Depends(require_owner)])
def network():
    with connect() as c:
        instances = [dict(r) for r in c.execute(
            "SELECT * FROM instances ORDER BY generation, created")]
        businesses = [dict(r) for r in c.execute(
            "SELECT * FROM businesses ORDER BY created DESC")]
        stopped = is_stopped(c)
    return {"instances": instances, "businesses": businesses, "emergency_stop": stopped}


@app.get("/api/earnings", dependencies=[Depends(require_owner)])
def earnings():
    with connect() as c:
        rows = [dict(r) for r in c.execute(
            "SELECT * FROM transactions ORDER BY created DESC LIMIT 200")]
    return {
        "transactions": rows,
        "note": "Only verified/reconciled transactions count toward totals. "
                "No payment provider is connected in this release.",
    }


@app.get("/api/activity", dependencies=[Depends(require_owner)])
def activity():
    with connect() as c:
        rows = [dict(r) for r in c.execute(
            "SELECT * FROM activity ORDER BY id DESC LIMIT 200")]
    return {"items": rows}


# ---------------------------------------------------------------- write endpoints


@app.post("/api/setup", dependencies=[Depends(require_owner)])
def setup(b: SetupIn):
    if not valid_destination(b.destination_type, b.destination):
        raise HTTPException(
            422,
            "Destination format invalid. Provide a public address or provider "
            "reference — never credentials, keys, or seed phrases.",
        )
    with connect() as c:
        set_setting(c, "owner_name", b.owner_name.strip())
        set_setting(c, "destination_type", b.destination_type)
        set_setting(c, "destination", b.destination.strip())
        set_setting(c, "currency", b.currency.upper())
        set_setting(c, "provider", b.provider.strip())
        log(c, "Payout destination reference saved", status="success",
            details="Reference only; no payment or withdrawal connection enabled")
    return {"saved": True,
            "message": "Saved as destination reference only; no payout connection enabled."}


@app.post("/api/activate", dependencies=[Depends(require_owner)])
def activate(b: ActivateIn):
    if not (b.acknowledged and b.accepts_no_guarantees):
        raise HTTPException(422, "Both safety acknowledgements are required")
    with connect() as c:
        if not get_setting(c, "destination"):
            raise HTTPException(409, "Configure a payout destination reference first")
        if is_stopped(c):
            raise HTTPException(423, "Emergency safety stop is active")
        if get_setting(c, "activated") != "true":
            iid = "oi_" + uuid.uuid4().hex[:12]
            c.execute(
                "INSERT INTO instances(id, generation, parent, name, status, threshold_cents) "
                "VALUES (?,?,NULL,?,'active',?)",
                (iid, 1, "Oyster Root", int(threshold(1) * 100)),
            )
            set_setting(c, "activated", "true")
            log(c, "Monitoring network initialized — demo mode", status="success",
                instance_id=iid,
                details="No external operations, AI providers, or simulated earnings")
    return {"activated": True, "external_actions_enabled": False,
            "message": "Monitoring network initialized. No external operations started."}


@app.post("/api/opportunities/discover", dependencies=[Depends(require_owner)])
def discover():
    with connect() as c:
        if is_stopped(c):
            raise HTTPException(423, "Emergency safety stop is active")
        if get_setting(c, "activated") != "true":
            raise HTTPException(409, "Initialize the network first")
        created = engine.discover_proposals(c)
    return {"created": len(created), "proposals": created,
            "external_actions_enabled": False}


@app.post("/api/network/multiply", dependencies=[Depends(require_owner)])
def multiply():
    with connect() as c:
        if is_stopped(c):
            raise HTTPException(423, "Emergency safety stop is active")
        parent = c.execute(
            "SELECT * FROM instances WHERE status='active' "
            "ORDER BY generation DESC LIMIT 1").fetchone()
        if not parent:
            raise HTTPException(409, "No active instance to multiply")
        verified = c.execute(
            "SELECT COALESCE(SUM(amount_cents),0) n FROM transactions "
            "WHERE instance_id=? AND type='revenue' "
            "AND status IN ('verified','reconciled')",
            (parent["id"],),
        ).fetchone()["n"]
        available = (verified - parent["used_cents"]) / 100.0
        gen = parent["generation"]
        if not can_multiply(gen, available):
            raise HTTPException(
                409,
                f"Verified, uncommitted earnings (${available:.2f}) do not meet "
                f"the generation {gen} threshold (${threshold(gen)}).",
            )
        child_gen = gen + 1
        child = "oi_" + uuid.uuid4().hex[:12]
        c.execute(
            "INSERT INTO instances(id, generation, parent, name, status, threshold_cents) "
            "VALUES (?,?,?,?,?,'active',?)",
            (child, child_gen, parent["id"], f"Oyster Gen {child_gen}",
             int(threshold(child_gen) * 100)),
        )
        c.execute(
            "UPDATE instances SET used_cents = used_cents + ? WHERE id = ?",
            (int(threshold(gen) * 100), parent["id"]),
        )
        log(c, "Verified threshold reached — child instance created", status="success",
            instance_id=child,
            details=f"Parent {parent['id']} crossed ${threshold(gen)} threshold")
    return {"created": True, "instance_id": child, "generation": child_gen,
            "threshold": str(threshold(child_gen))}


@app.post("/api/safety-stop", dependencies=[Depends(require_owner)])
def safety_stop(b: StopIn):
    with connect() as c:
        c.execute(
            "UPDATE safety SET stopped=?, reason=? WHERE id=1",
            (int(b.enabled), b.reason if b.enabled else ""),
        )
        if b.enabled:
            c.execute("UPDATE instances SET status='paused' WHERE status='active'")
        else:
            c.execute("UPDATE instances SET status='active' WHERE status='paused'")
        log(c, "Emergency stop enabled" if b.enabled else "Emergency stop cleared",
            status="warning" if b.enabled else "success",
            details=b.reason if b.enabled else "Owner control")
    return {"emergency_stop": b.enabled}