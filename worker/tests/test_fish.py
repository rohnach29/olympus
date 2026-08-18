"""
The Fish engine's pure parts, pinned against a captured stream.

`fixtures/fish_sse.txt` is a real with-timestamp response (probed 2026-08-18,
audio payloads trimmed), so the parser is tested against what the wire
actually says rather than what the docs promise.
"""

from pathlib import Path

import pytest

from station import config
from station.nodes import fish
from station.nodes.fish import (
    FishOutOfCredit,
    merge_alignment,
    paragraph_starts,
    parse_sse,
    strip_tags,
)

FIXTURE = (Path(__file__).parent / "fixtures" / "fish_sse.txt").read_text()

# The exact text the fixture stream was synthesized from.
PROBE_SCRIPT = (
    "[confident] Good morning, this is Station Olympus. "
    "[break] Recovery stands at seventy-eight.\n\n"
    "[calm] More after the break."
)


class TestParseSse:
    def test_every_data_payload_is_decoded_in_order(self):
        events = parse_sse(FIXTURE)
        assert len(events) == 6
        assert all("alignment" in e for e in events)

    def test_garbage_lines_are_skipped_not_fatal(self):
        assert parse_sse("data: {broken\n\ndata: {\"ok\": 1}\n") == [{"ok": 1}]


class TestMergeAlignment:
    def test_only_the_last_snapshot_per_chunk_counts(self):
        merged = merge_alignment(parse_sse(FIXTURE))
        # The stream re-sends the growing list six times; merged is the final
        # fourteen words once, not the sum of every snapshot.
        assert len(merged) == 14
        assert merged[0] == {"text": "Good", "start": 0.0}
        assert merged[-1]["text"] == "break"

    def test_chunk_offsets_make_times_absolute(self):
        events = [
            {"chunk_seq": 0, "chunk_audio_offset_sec": 0.0,
             "alignment": {"segments": [{"text": "one", "start": 0.0, "end": 0.2}]}},
            {"chunk_seq": 1, "chunk_audio_offset_sec": 5.0,
             "alignment": {"segments": [{"text": "two", "start": 0.4, "end": 0.6}]}},
        ]
        merged = merge_alignment(events)
        assert merged == [{"text": "one", "start": 0.0}, {"text": "two", "start": 5.4}]


class TestParagraphStarts:
    def test_finds_each_paragraph_in_the_recording(self):
        alignment = merge_alignment(parse_sse(FIXTURE))
        assert paragraph_starts(PROBE_SCRIPT, alignment) == [0.0, 4.0]

    def test_tags_and_hyphens_do_not_break_the_match(self):
        # "seventy-eight" arrives from Fish as one token, "seventyeight";
        # the walk above only succeeds if both normalizations agree.
        alignment = merge_alignment(parse_sse(FIXTURE))
        assert paragraph_starts(PROBE_SCRIPT, alignment) != []

    def test_a_mismatched_script_yields_no_marks(self):
        alignment = merge_alignment(parse_sse(FIXTURE))
        wrong = "Entirely different words.\n\nNothing matches here."
        assert paragraph_starts(wrong, alignment) == []

    def test_a_drifted_walk_yields_no_marks(self):
        # First words match but the paragraphs are shorter than what was
        # spoken — every mark after the drift would seek to the wrong line.
        alignment = merge_alignment(parse_sse(FIXTURE))
        drifted = "Good morning.\n\nMore lies."
        assert paragraph_starts(drifted, alignment) == []


class _FakeResponse:
    def __init__(self, status_code: int, text: str = ""):
        self.status_code = status_code
        self.text = text

    def read(self):
        return b""

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class TestSynthesizeShowFailureModes:
    def test_out_of_credit_aborts_without_retrying(self, monkeypatch):
        calls = []
        monkeypatch.setattr(fish.httpx, "stream", lambda *a, **k: calls.append(1) or _FakeResponse(402))
        monkeypatch.setattr(config, "fish_key", lambda: "test-key")

        with pytest.raises(FishOutOfCredit):
            fish.synthesize_show("Good morning.")
        assert len(calls) == 1, "a 402 must not be retried into a balance"

    def test_a_bad_gateway_uses_the_whole_retry_budget(self, monkeypatch):
        calls = []
        monkeypatch.setattr(fish.httpx, "stream", lambda *a, **k: calls.append(1) or _FakeResponse(503))
        monkeypatch.setattr(fish.time, "sleep", lambda s: None)
        monkeypatch.setattr(config, "fish_key", lambda: "test-key")

        with pytest.raises(RuntimeError, match="failed after"):
            fish.synthesize_show("Good morning.")
        assert len(calls) == config.TTS_ATTEMPTS


class TestStripTags:
    def test_tags_vanish_and_spacing_heals(self):
        tagged = "[confident] Good morning. [break] [soft tone] Recovery stands at seventy-eight."
        assert strip_tags(tagged) == "Good morning. Recovery stands at seventy-eight."

    def test_written_sounds_survive(self):
        assert strip_tags("[chuckling] Ha — no fine print.") == "Ha — no fine print."

    def test_untagged_text_is_untouched(self):
        plain = "Six hours and forty-nine minutes — a fine night."
        assert strip_tags(plain) == plain

    def test_paragraph_breaks_survive(self):
        assert strip_tags("[calm] One.\n\n[proud] Two.") == "One.\n\nTwo."

    def test_a_stray_open_bracket_is_not_eaten(self):
        assert "[" in strip_tags("An array [ opens here and never closes " + "x" * 80)
