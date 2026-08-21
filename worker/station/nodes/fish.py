"""
The anchor's booth: Fish Audio S2.1, one take, timestamps included.

Fish reads the entire tagged script in a single request — no manual chunking,
no stitched seams, and the voice holds steady past the minute mark where
Gemini TTS drifts nasal. The `[bracket]` stage directions the writer embeds
are performed, not spoken.

The streaming with-timestamp endpoint returns two things interleaved: raw PCM
audio and a word-level alignment. The alignment is what lets the page keep
its click-to-seek B-side without per-segment synthesis: we find where each
paragraph's first word lands and publish those times as `segment_starts`.

Wire-format notes, confirmed by probe on 2026-08-18:
- Server-Sent Events; each `data:` line is JSON with `audio_base64`,
  `alignment` (a *cumulative snapshot* per `chunk_seq` — replace, never
  append), `chunk_seq`, and `chunk_audio_offset_sec` to make times absolute.
- `format: "pcm"` + `sample_rate` are honored: 16-bit mono, no container.
- Alignment tokens are the spoken words with punctuation stripped and hyphens
  collapsed ("seventy-eight" arrives as one token, "seventyeight"); bracket
  tags do not appear at all.
"""

from __future__ import annotations

import base64
import json
import re
import time

import httpx

from .. import config

# One bracketed direction. The 60-char bound keeps a stray "[" in prose (none
# should exist, but writers surprise you) from eating half the script.
TAG = re.compile(r"\[[^\]\n]{1,60}\]")


class FishOutOfCredit(RuntimeError):
    """HTTP 402 — retrying will not conjure a balance."""


def strip_tags(text: str) -> str:
    """
    The spoken words only, tidied.

    Used everywhere a human or a non-Fish system sees the script: the
    published transcript, the Gemini fallback engine, and the alignment
    matcher — all of which must agree on what was actually said.
    """
    bare = TAG.sub(" ", text)
    bare = re.sub(r"[ \t]+", " ", bare)
    bare = re.sub(r" +([,.;:!?…])", r"\1", bare)
    return "\n".join(line.strip() for line in bare.splitlines()).strip()


def _tokens(text: str) -> list[str]:
    """Words the way Fish's alignment spells them: bare, lowercased, joined
    across hyphens. Purely-punctuation 'words' (a lone em-dash) vanish."""
    out = []
    for word in text.split():
        bare = re.sub(r"[^a-z0-9]", "", word.lower())
        if bare:
            out.append(bare)
    return out


def parse_sse(raw: str) -> list[dict]:
    """Decode every `data:` payload of an SSE stream, in arrival order."""
    events = []
    for line in raw.splitlines():
        if line.startswith("data:"):
            try:
                events.append(json.loads(line[5:].strip()))
            except json.JSONDecodeError:
                continue
    return events


def merge_alignment(events: list[dict]) -> list[dict]:
    """
    One absolute-time word list from the stream's snapshots.

    Each `chunk_seq` re-sends its whole alignment as it grows, so only the
    last snapshot per seq counts; its `chunk_audio_offset_sec` shifts the
    chunk-local times onto the full recording's clock.
    """
    latest: dict[int, tuple[float, list[dict]]] = {}
    for event in events:
        alignment = event.get("alignment")
        if not alignment:
            continue
        seq = event.get("chunk_seq", 0)
        offset = float(event.get("chunk_audio_offset_sec") or 0.0)
        latest[seq] = (offset, alignment.get("segments") or [])

    merged = []
    for seq in sorted(latest):
        offset, segments = latest[seq]
        for seg in segments:
            merged.append({"text": seg["text"], "start": float(seg["start"]) + offset})
    return merged


def paragraph_starts(script: str, alignment: list[dict]) -> list[float]:
    """
    Where each paragraph begins in the recording.

    Walks the alignment against the tag-stripped paragraphs, anchoring each
    paragraph on its first two words. Fish occasionally merges or splits a
    token mid-paragraph, which drifts the expected position — so the anchor
    is hunted in a small window on *both* sides of where counting says it
    should be, and the two-word match keeps a coincidental single word from
    anchoring the wrong line.

    Deliberately faint-hearted beyond that: real disagreement returns [] —
    the page shows numbered segments without seek marks, which is a far
    better morning than a run failed over timestamps or, worse, marks that
    seek to the wrong line.
    """
    paragraphs = [p for p in (strip_tags(p) for p in script.split("\n\n")) if p]
    words = [w["text"].lower() for w in alignment]

    def find_anchor(expected: list[str], cursor: int, floor: int) -> int:
        lo = max(floor, cursor - 6)
        hi = min(len(words), cursor + 8)
        for probe in range(lo, hi):
            if words[probe] != expected[0]:
                continue
            if len(expected) == 1 or (
                probe + 1 < len(words) and words[probe + 1] == expected[1]
            ):
                return probe
        return -1

    starts: list[float] = []
    cursor = 0
    floor = 0  # never anchor at or before the previous paragraph's start
    for index, paragraph in enumerate(paragraphs):
        expected = _tokens(paragraph)
        if not expected:
            return []
        anchor = find_anchor(expected, cursor, floor)
        if anchor < 0:
            around = " ".join(words[max(0, cursor - 3) : cursor + 5])
            print(
                f"  tts: seek-mark walk lost paragraph {index + 1} — "
                f'expected "{" ".join(expected[:2])}" near "{around}"'
            )
            return []
        starts.append(round(alignment[anchor]["start"], 2))
        floor = anchor + 1
        cursor = anchor + len(expected)

    # The whole script should be spoken for; a large deficit or surplus means
    # the walk drifted and every mark after the drift is a lie. A few merged
    # or split tokens across a whole show are expected and harmless.
    slack = max(3, len(words) // 25)
    if abs(cursor - len(words)) > slack:
        print(
            f"  tts: seek-mark walk ended {cursor - len(words):+d} words adrift "
            f"of the recording ({len(words)} spoken)"
        )
        return []
    return starts


def synthesize_show(script: str) -> tuple[bytes, list[float]]:
    """
    The whole tagged script to (raw PCM, paragraph start times), one request.

    Retries ride the same budget as the Gemini loop, except a 402 — out of
    credit — aborts at once: the fallback engine is the answer to that, not
    three more minutes of polite retrying.
    """
    body = {
        "text": script,
        "reference_id": config.FISH_VOICE_ID,
        "format": "pcm",
        "sample_rate": config.PCM_SAMPLE_RATE,
        "normalize": False,
    }
    headers = {
        "Authorization": f"Bearer {config.fish_key()}",
        "Content-Type": "application/json",
        "model": config.FISH_TTS_MODEL,
    }

    last_error: Exception | None = None
    for attempt in range(1, config.TTS_ATTEMPTS + 1):
        try:
            with httpx.stream(
                "POST",
                f"{config.FISH_API}/v1/tts/stream/with-timestamp",
                json=body,
                headers=headers,
                timeout=config.REQUEST_TIMEOUT_S,
            ) as response:
                if response.status_code == 402:
                    raise FishOutOfCredit("fish audio: 402, out of credit")
                if response.status_code != 200:
                    response.read()
                    raise RuntimeError(
                        f"{response.status_code} {response.text[:160]}"
                    )
                events = parse_sse(response.read().decode("utf-8", "replace"))

            pcm = b"".join(
                base64.b64decode(e["audio_base64"])
                for e in events
                if e.get("audio_base64")
            )
            if not pcm:
                raise RuntimeError("stream carried no audio")

            starts = paragraph_starts(script, merge_alignment(events))
            if not starts:
                print("  tts: fish alignment did not match — publishing without seek marks")
            return pcm, starts

        except FishOutOfCredit:
            raise
        except Exception as err:  # noqa: BLE001 — everything else is retryable
            last_error = err
            print(f"    fish attempt {attempt}/{config.TTS_ATTEMPTS} failed: {err}")
            if attempt < config.TTS_ATTEMPTS:
                time.sleep(config.TTS_BACKOFF_S)

    raise RuntimeError(
        f"fish synthesis failed after {config.TTS_ATTEMPTS} attempts: {last_error}"
    )
