"""
Handing the finished episode back to Olympus.

The worker owns no credentials beyond the shared secret: the app uploads the
audio and writes the row, because the app owns the schema. This node is the
last step of the graph and the only one with a side effect the world can see.
"""

from __future__ import annotations

from typing import Any

import httpx

from .. import config
from ..state import DeskState


def post_episode(payload: dict[str, Any]) -> dict[str, Any]:
    """POST the episode; the app replies with what it stored."""
    response = httpx.post(
        f"{config.api_base()}/api/station/publish",
        headers={"Authorization": f"Bearer {config.station_secret()}"},
        json=payload,
        timeout=config.REQUEST_TIMEOUT_S,
    )
    if response.status_code != 200:
        raise RuntimeError(f"publish rejected: {response.status_code} {response.text[:200]}")
    return response.json().get("data", {})


def make_publish_node(poster=post_episode, *, dry_run: bool = False):
    """Factory; `dry_run` prints the show instead of airing it."""

    def publish_node(state: DeskState) -> DeskState:
        payload = {
            "airDate": state["date"],
            "transcript": state.get("transcript") or [],
            "factsUsed": state.get("facts") or {},
            "writerModel": state.get("writer_model"),
            "ttsModel": state.get("tts_model"),
            "audioBase64": state.get("audio_b64"),
            "durationS": state.get("duration_s"),
            "waveform": state.get("waveform") or None,
            "segmentStarts": state.get("segment_starts") or None,
        }

        if dry_run:
            print("  publish: dry run — nothing sent")
            return {"published": {"dryRun": True}}  # type: ignore[return-value]

        result = poster(payload)
        print(
            f"  publish: {result.get('status')} for {result.get('airDate')}"
            + (f", pruned {result['pruned']} old episode(s)" if result.get("pruned") else "")
        )
        return {"published": result}  # type: ignore[return-value]

    return publish_node
