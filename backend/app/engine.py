"""OYSTER AI — opportunity discovery engine (proposal-only).

This engine creates REVIEWABLE PROPOSAL RECORDS. It performs no external
actions: no scraping, no account creation, no deployment, no spending.
Every proposal is a deterministic, zero-capital business idea intended for
the owner's evaluation.
"""
from __future__ import annotations

import uuid
from typing import Any

from .store import log

# Deterministic candidate set — zero upfront capital, legitimate models only.
CANDIDATES: list[tuple[str, str, str]] = [
    (
        "Onboarding checklist for indie creators",
        "digital_product",
        "Original, focused checklist validated through direct interviews and a "
        "free static landing page. Zero capital: built with free tiers and open "
        "source tooling. Demand signals come from conversation, not paid ads.",
    ),
    (
        "Open-source niche calculator",
        "software_tool",
        "A small browser-based utility solving one specific calculation problem. "
        "Hosted on a free static tier. Monetization via optional paid features or "
        "sponsorship once organic usage is proven.",
    ),
    (
        "Plain-language workflow guide",
        "informational_product",
        "An original, practical guide for a specific recurring workflow. Validated "
        "with a free outline and feedback requests before any production work.",
    ),
]


def discover_proposals(c) -> list[dict[str, Any]]:
    """Create proposal records for any candidate not yet recorded.

    Idempotent: calling twice does not duplicate proposals.
    """
    created: list[dict[str, Any]] = []
    for title, category, rationale in CANDIDATES:
        if c.execute("SELECT 1 FROM opportunities WHERE title = ?", (title,)).fetchone():
            continue
        oid = uuid.uuid4().hex
        c.execute(
            "INSERT INTO opportunities(id, title, category, rationale, status, cost_cents) "
            "VALUES (?,?,?,?,?,0)",
            (oid, title, category, rationale, "proposal"),
        )
        created.append(
            {"id": oid, "title": title, "category": category,
             "rationale": rationale, "status": "proposal", "cost_cents": 0}
        )
    log(
        c, "Opportunity research completed", status="success",
        details=f"{len(created)} new proposal(s); no external actions taken",
    )
    return created