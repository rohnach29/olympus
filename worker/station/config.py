"""
Everything the press run reads from its environment.

Resolved lazily rather than at import so that tests, and the parts of the
graph that need no credentials, can run without a full environment.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# Local runs read the app's .env.local; on GitHub Actions the variables are
# already in the environment and this simply finds nothing.
load_dotenv(Path(__file__).resolve().parents[2] / ".env.local")

# --- models -----------------------------------------------------------------

# 3.7 was 503 for an entire day during the audition while 3.6 delivered every
# time, so the fallback is load-bearing, not decorative.
WRITER_MODEL = os.getenv("STATION_WRITER_MODEL", "gemini-3.7-flash")
WRITER_FALLBACK_MODEL = os.getenv("STATION_WRITER_FALLBACK_MODEL", "gemini-3.6-flash")

# The anchor: a Fish Audio voice reading the whole show in one take. The voice
# id is the Seth Meyers clone picked in the 2026-08-18 audition (private,
# single-listener use); the free tier's fair-use limits comfortably cover one
# ninety-second episode a day.
FISH_API = "https://api.fish.audio"
FISH_TTS_MODEL = os.getenv("STATION_FISH_MODEL", "s2.1-pro-free")
FISH_VOICE_ID = os.getenv("STATION_FISH_VOICE", "b14fde3acde74506b67fc7b8a7dedba7")

# The understudy. If Fish is down for the morning, the show falls back to the
# original Gemini chunked pipeline. Pinned per episode: "Charon" is a
# *different voice* on 3.1 than on 2.5, so a mid-show fallback would change
# the anchor between two sentences.
TTS_MODEL = os.getenv("STATION_TTS_MODEL", "gemini-3.1-flash-tts-preview")
TTS_VOICE = os.getenv("STATION_TTS_VOICE", "Charon")

GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models"

# --- synthesis --------------------------------------------------------------

# Fish reads the whole show in one take; these govern the Gemini fallback,
# where long single-shot takes drift muffled and nasal — Google documents it,
# and we heard it at 97 seconds. Chunking at paragraph boundaries keeps every
# fallback take inside the clean zone. MAX_CHUNK_CHARS also still shapes the
# transcript's B-side segments on every engine.
MAX_CHUNK_CHARS = 600
CHUNK_GAP_MS = 350
PCM_SAMPLE_RATE = 24_000
WAVEFORM_BUCKETS = 240

TTS_ATTEMPTS = 4
TTS_BACKOFF_S = 30
REQUEST_TIMEOUT_S = 120

# --- the run ----------------------------------------------------------------

MAX_REWRITES = 2

# The show is named for the listener's morning, not for UTC. The nightly cron
# fires at 23:00 UTC, which is already tomorrow where the listener is sleeping,
# so the date must be resolved in their zone or every episode would be filed
# against the wrong day.
STATION_TZ = os.getenv("STATION_TZ", "Asia/Kolkata")


def require(name: str) -> str:
    """Read a required variable, failing loudly rather than half-running."""
    value = os.getenv(name)
    if not value:
        raise RuntimeError(
            f"{name} is not set. Local runs read ../.env.local; "
            "GitHub Actions injects it from repository secrets."
        )
    return value


def api_base() -> str:
    """The Olympus app the worker talks to (never the database directly)."""
    return require("STATION_API_URL").rstrip("/")


def station_secret() -> str:
    return require("STATION_SECRET")


def gemini_key() -> str:
    return require("GEMINI_API_KEY")


def fish_key() -> str:
    return require("FISH_AUDIO_API_KEY")


def checkpoint_dsn() -> str | None:
    """
    Where graph checkpoints live.

    Postgres rather than SQLite because the Actions runner is destroyed after
    every run: a local file would take the resume point with it. DIRECT_ is
    preferred since the checkpointer issues DDL on first use.

    A connect_timeout is forced onto the DSN: without one, a wedged or
    unreachable database makes the run hang silently instead of failing with
    a line the log can show.
    """
    dsn = os.getenv("DIRECT_DATABASE_URL") or os.getenv("DATABASE_URL")
    if dsn and "connect_timeout=" not in dsn:
        dsn += ("&" if "?" in dsn else "?") + "connect_timeout=15"
    return dsn
