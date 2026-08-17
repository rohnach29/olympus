"""
The clipboard that travels through the graph.

This is the one idea the whole library rests on: a single typed object that
every node reads, and that each node updates by returning *only the keys it
changed*. LangGraph merges those partial updates into the state it carries to
the next node.

The default merge is **overwrite** — returning {"violations": [...]} replaces
the old list rather than appending to it. That is what we want everywhere
here, so no field declares a reducer; a field that needed append-don't-replace
would be written as `Annotated[list[str], operator.add]`.
"""

from __future__ import annotations

from typing import Any, TypedDict


class NumberClaim(TypedDict):
    """One number the script speaks, and where the writer says it came from."""

    spoken: str  # how it appears in the script: "seventy-nine"
    value: float  # what it means: 79
    fact_path: str  # where it came from: "night.deep_min"


class TranscriptLine(TypedDict):
    speaker: str
    text: str


class DeskState(TypedDict, total=False):
    """
    State for one morning's press run.

    `total=False` because the graph fills this in progressively: `gather` is
    the first node that can promise `facts`, `write` the first that can
    promise `script`.
    """

    # set at invocation
    date: str

    # gather
    facts: dict[str, Any] | None

    # write
    script: str | None
    numbers: list[NumberClaim]
    writer_model: str | None

    # check
    violations: list[str]
    retries: int

    # tts
    audio_b64: str | None
    duration_s: float | None
    waveform: list[int]
    segment_starts: list[float]
    transcript: list[TranscriptLine]
    tts_model: str | None

    # publish
    published: dict[str, Any] | None


def initial_state(date: str) -> DeskState:
    """A fresh clipboard. Counters start at zero so routers can trust them."""
    return {
        "date": date,
        "facts": None,
        "script": None,
        "numbers": [],
        "writer_model": None,
        "violations": [],
        "retries": 0,
        "audio_b64": None,
        "duration_s": None,
        "waveform": [],
        "segment_starts": [],
        "transcript": [],
        "tts_model": None,
        "published": None,
    }
