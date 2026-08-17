"""
The audio helpers exist to work around one measured defect: long single-shot
takes drift muffled. These tests pin the shape of that workaround.
"""

import array

from station import config
from station.nodes.tts import split_chunks, stitch, waveform_peaks, wav_container


class TestSplitChunks:
    def test_splits_on_paragraphs(self):
        script = "First segment.\n\nSecond segment.\n\nThird segment."
        assert split_chunks(script) == ["First segment.", "Second segment.", "Third segment."]

    def test_blank_paragraphs_are_dropped(self):
        assert split_chunks("One.\n\n\n\nTwo.") == ["One.", "Two."]

    def test_long_paragraph_splits_at_sentence_ends(self):
        sentence = "This sentence is exactly long enough to matter. "
        chunks = split_chunks(sentence * 20, limit=200)

        assert len(chunks) > 1
        assert all(len(c) <= 200 for c in chunks)
        # Never mid-sentence: a stranded clause loses its intonation.
        assert all(c.strip().endswith(".") for c in chunks)

    def test_nothing_is_lost(self):
        script = "Alpha one. Beta two.\n\nGamma three. Delta four."
        rejoined = " ".join(split_chunks(script, limit=25))
        for word in ["Alpha", "Beta", "Gamma", "Delta"]:
            assert word in rejoined


class TestStitch:
    def test_inserts_a_gap_between_chunks(self):
        a, b = b"\x01\x02" * 10, b"\x03\x04" * 10
        joined = stitch([a, b], gap_ms=100)

        expected_gap = int(config.PCM_SAMPLE_RATE * 2 * 0.1)
        assert len(joined) == len(a) + len(b) + expected_gap
        assert joined.startswith(a)
        assert joined.endswith(b)

    def test_single_chunk_gets_no_gap(self):
        assert stitch([b"\x01\x02"]) == b"\x01\x02"


class TestWaveform:
    def test_peaks_are_scaled_to_one_hundred(self):
        samples = array.array("h", [0, 4000, -8000, 16000] * 500)
        peaks = waveform_peaks(samples.tobytes(), buckets=10)

        assert len(peaks) <= 10
        assert max(peaks) == 100
        assert all(0 <= p <= 100 for p in peaks)

    def test_silence_does_not_divide_by_zero(self):
        assert set(waveform_peaks(b"\x00\x00" * 1000, buckets=4)) == {0}

    def test_empty_audio_yields_nothing(self):
        assert waveform_peaks(b"") == []


class TestWavContainer:
    def test_header_declares_the_real_rate_and_size(self):
        pcm = b"\x00\x01" * 1000
        wav = wav_container(pcm, rate=24000)

        assert wav[:4] == b"RIFF" and wav[8:12] == b"WAVE"
        assert int.from_bytes(wav[24:28], "little") == 24000
        assert int.from_bytes(wav[40:44], "little") == len(pcm)
        assert len(wav) == len(pcm) + 44
