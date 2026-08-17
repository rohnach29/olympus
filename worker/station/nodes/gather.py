"""
Where the facts come from.

The worker never touches the database. It asks the Olympus app for the same
distilled object the ledger renders, which is the whole reason the radio can
never contradict the paper: there is one implementation of the health maths,
it lives in TypeScript, and this fetches its output.

A node is just a function of state — no model involved here at all.
"""

from __future__ import annotations

from typing import Any

import httpx

from .. import config
from ..state import DeskState


def fetch_facts(date: str) -> dict[str, Any]:
    """GET the morning's facts, authenticated as the worker."""
    response = httpx.get(
        f"{config.api_base()}/api/station/facts",
        params={"date": date},
        headers={"Authorization": f"Bearer {config.station_secret()}"},
        timeout=config.REQUEST_TIMEOUT_S,
    )
    response.raise_for_status()
    payload = response.json()

    facts = payload.get("data")
    if not isinstance(facts, dict):
        raise RuntimeError(f"facts route returned no data object: {payload!r}")
    return facts


def make_gather_node(fetcher=fetch_facts):
    """Built as a factory so tests can hand the graph a stub fetcher."""

    def gather_node(state: DeskState) -> DeskState:
        date = state["date"]
        facts = fetcher(date)
        verdict = facts.get("verdict", {})
        print(
            f"  gather: {date} — recovery {verdict.get('recovery')} "
            f"({verdict.get('band')}), night {'yes' if facts.get('night') else 'none'}"
        )
        return {"facts": facts}  # type: ignore[return-value]

    return gather_node
