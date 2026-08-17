"""
Giving the show its voice.

Everything here is the shape of one hard-won finding: a single long take
degrades. Past about a minute the voice drifts muffled and nasal on every
Gemini TTS model — Google documents it, and we heard it clearly at
ninety-seven seconds. So the script is cut at its paragraph seams,
synthesized a piece at a time, and stitched back together with a breath
between. Each piece starts fresh at full clarity, and the seams fall exactly
where a news anchor would pause anyway.

Two rules the audition paid for:

- **Pin the model for the whole episode.** "Charon" on 3.1 is a different
  voice from "Charon" on 2.5; falling back mid-show would change the anchor
  between paragraphs. Better to fail a chunk and retry than to swap voices.
- **Expect the endpoint to misbehave.** In one afternoon we saw 400s on valid
  requests, 503 storms, a two-minute hang and the daily quota wall. Retry with
  backoff, and time every request out.
"""

from __future__ import annotations

import array
import base64
import re
import struct
import subprocess
import tempfile
import time
from pathlib import Path

import httpx

from .. import config
from ..prompts import DELIVERY_DIRECTION
from ..state import DeskState


def split_chunks(script: str, limit: int = config.MAX_CHUNK_CHARS) -> list[str]:
    """
    Cut the script into synthesis-sized pieces at natural pauses.

    Paragraphs first, since the writer is told to separate the show's five
    segments with blank lines. A paragraph longer than the limit is split
    again at sentence ends — never mid-sentence, which would strand a clause
    without its intonation.
    """
    chunks: list[str] = []

    for paragraph in (p.strip() for p in script.split("\n\n")):
        if not paragraph:
            continue
        if len(paragraph) <= limit:
            chunks.append(paragraph)
            continue

        current = ""
        for sentence in re.split(r"(?<=[.!?])\s+", paragraph):
            candidate = f"{current} {sentence}".strip()
            if current and len(candidate) > limit:
                chunks.append(current)
                current = sentence
            else:
                current = candidate
        if current:
            chunks.append(current)

    return chunks


def synthesize_chunk(text: str, model: str, voice: str) -> bytes:
    """One chunk to raw PCM, retrying through the endpoint's bad moods."""
    body = {
        "contents": [{"role": "user", "parts": [{"text": f"{DELIVERY_DIRECTION}\n\n{text}"}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}},
        },
    }

    last_error: Exception | None = None
    for attempt in range(1, config.TTS_ATTEMPTS + 1):
        try:
            response = httpx.post(
                f"{config.GEMINI_API}/{model}:generateContent",
                params={"key": config.gemini_key()},
                json=body,
                timeout=config.REQUEST_TIMEOUT_S,
            )
            if response.status_code != 200:
                raise RuntimeError(f"{response.status_code} {response.text[:160]}")

            for part in response.json()["candidates"][0]["content"]["parts"]:
                data = part.get("inlineData", {}).get("data")
                if data:
                    return base64.b64decode(data)
            raise RuntimeError("response carried no audio")

        except Exception as err:  # noqa: BLE001 — every failure here is retryable
            last_error = err
            print(f"    chunk attempt {attempt}/{config.TTS_ATTEMPTS} failed: {err}")
            if attempt < config.TTS_ATTEMPTS:
                time.sleep(config.TTS_BACKOFF_S)

    raise RuntimeError(f"synthesis failed after {config.TTS_ATTEMPTS} attempts: {last_error}")


def stitch(pcms: list[bytes], gap_ms: int = config.CHUNK_GAP_MS) -> bytes:
    """Join chunk audio with a silence gap, so the seams read as breaths."""
    gap = b"\x00" * int(config.PCM_SAMPLE_RATE * 2 * gap_ms / 1000)
    return gap.join(pcms)


def wav_container(pcm: bytes, rate: int = config.PCM_SAMPLE_RATE) -> bytes:
    """Wrap raw 16-bit mono PCM in a WAV header."""
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF", 36 + len(pcm), b"WAVE",
        b"fmt ", 16, 1, 1, rate, rate * 2, 2, 16,
        b"data", len(pcm),
    )
    return header + pcm


def waveform_peaks(pcm: bytes, buckets: int = config.WAVEFORM_BUCKETS) -> list[int]:
    """
    Reduce the audio to a few hundred amplitudes, 0-100.

    The player draws its trace from these, so the page never downloads and
    decodes the mp3 just to know what the morning looked like.
    """
    samples = array.array("h")
    samples.frombytes(pcm[: len(pcm) - (len(pcm) % 2)])
    if not samples:
        return []

    size = max(1, len(samples) // buckets)
    peaks: list[int] = []
    for start in range(0, len(samples), size):
        window = samples[start : start + size]
        if window:
            peaks.append(max(abs(s) for s in window))

    ceiling = max(peaks) or 1
    return [round(p / ceiling * 100) for p in peaks[:buckets]]


def encode_mp3(pcm: bytes) -> bytes:
    """
    Compress for delivery: ~4.6 MB of WAV becomes well under a megabyte.

    Not merely a nicety — raw WAV would exceed the publish route's request
    body limit, so the episode could not be delivered at all.
    """
    with tempfile.TemporaryDirectory() as tmp:
        wav_path = Path(tmp) / "episode.wav"
        mp3_path = Path(tmp) / "episode.mp3"
        wav_path.write_bytes(wav_container(pcm))

        result = subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav_path),
             "-ac", "1", "-b:a", "64k", str(mp3_path)],
            capture_output=True,
        )
        if result.returncode != 0:
            raise RuntimeError(f"ffmpeg failed: {result.stderr.decode()[:200]}")
        return mp3_path.read_bytes()


def make_tts_node(synthesizer=synthesize_chunk, *, with_audio: bool = True):
    """
    Factory. `with_audio=False` runs the show as text only — used for dry runs
    and for the days the TTS quota is already spent, so a script still gets
    written and published rather than the morning being lost entirely.
    """

    def tts_node(state: DeskState) -> DeskState:
        script = state.get("script") or ""
        chunks = split_chunks(script)
        transcript = [{"speaker": "ANCHOR", "text": c} for c in chunks]

        if not with_audio:
            print(f"  tts: skipped — {len(chunks)} segment(s) written, no audio")
            return {"transcript": transcript, "segment_starts": []}  # type: ignore[return-value]

        model = config.TTS_MODEL
        pcms: list[bytes] = []
        starts: list[float] = []
        elapsed = 0.0

        for index, chunk in enumerate(chunks, start=1):
            print(f"  tts: chunk {index}/{len(chunks)} ({len(chunk)} chars) on {model}")
            pcm = synthesizer(chunk, model, config.TTS_VOICE)
            starts.append(round(elapsed, 2))
            elapsed += len(pcm) / 2 / config.PCM_SAMPLE_RATE + config.CHUNK_GAP_MS / 1000
            pcms.append(pcm)

        joined = stitch(pcms)
        duration = len(joined) / 2 / config.PCM_SAMPLE_RATE
        mp3 = encode_mp3(joined)
        print(f"  tts: {duration:.1f}s, {len(mp3) / 1024:.0f} KB mp3")

        return {  # type: ignore[return-value]
            "audio_b64": base64.b64encode(mp3).decode(),
            "duration_s": duration,
            "waveform": waveform_peaks(joined),
            "segment_starts": starts,
            "transcript": transcript,
            "tts_model": model,
        }

    return tts_node
