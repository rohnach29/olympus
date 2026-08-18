"""
The graph, exercised whole.

These run the real edges, the real router and the real cycle — only the model,
the synthesizer and the network are stubbed. What the test proves is what runs
at four in the morning.
"""

from station import config
from station.graph import build_graph, route_after_check
from station.nodes.write import NumberClaimModel, ScriptDraft
from station.state import initial_state

FACTS = {
    "verdict": {"recovery": 76, "band": "recovered"},
    "night": {"asleep": "6h52m", "deep_min": 79, "score": 87},
    "yesterday": {"steps": 6828, "protein_g": 86},
}

GOOD = ScriptDraft(
    script="Good morning. Deep sleep came in at seventy-nine minutes.",
    numbers_used=[NumberClaimModel(spoken="seventy-nine", value=79, fact_path="night.deep_min")],
)

# Same show, but the writer has misquoted the ledger.
BAD = ScriptDraft(
    script="Good morning. Deep sleep came in at ninety-five minutes.",
    numbers_used=[NumberClaimModel(spoken="ninety-five", value=95, fact_path="night.deep_min")],
)


class Recorder:
    """A stand-in for the writers' room that hands back scripted drafts."""

    def __init__(self, *drafts):
        self.drafts = list(drafts)
        self.prompts: list[str] = []

    def __call__(self, prompt):
        self.prompts.append(prompt)
        draft = self.drafts[min(len(self.prompts) - 1, len(self.drafts) - 1)]
        return draft, "stub-model"


def run_graph(drafter, with_audio=False, **kwargs):
    published: list[dict] = []

    def poster(payload):
        published.append(payload)
        return {"status": "published", "airDate": payload["airDate"], "pruned": 0}

    graph = build_graph(
        fetcher=lambda date: FACTS,
        drafter=drafter,
        poster=poster,
        with_audio=with_audio,
        **kwargs,
    )
    final = graph.invoke(initial_state("2026-08-16"))
    return final, published


class TestRouter:
    """The one decision in the graph, tested with plain dictionaries."""

    def test_clean_draft_goes_to_air(self):
        assert route_after_check({"violations": [], "retries": 1}) == "tts"

    def test_dirty_draft_goes_back_to_the_writer(self):
        assert route_after_check({"violations": ["wrong"], "retries": 1}) == "write"

    def test_out_of_drafts_degrades_instead_of_looping(self):
        assert route_after_check({"violations": ["wrong"], "retries": 3}) == "degrade"


class TestHappyPath:
    def test_a_clean_show_is_written_once_and_published(self):
        drafter = Recorder(GOOD)
        final, published = run_graph(drafter)

        assert len(drafter.prompts) == 1, "a clean draft must not be rewritten"
        assert final["violations"] == []
        assert len(published) == 1
        assert published[0]["airDate"] == "2026-08-16"
        assert published[0]["factsUsed"] == FACTS
        assert published[0]["audioBase64"] is None  # with_audio=False

    def test_transcript_is_speaker_tagged(self):
        _, published = run_graph(Recorder(GOOD))
        assert published[0]["transcript"] == [
            {"speaker": "ANCHOR", "text": "Good morning. Deep sleep came in at seventy-nine minutes."}
        ]


class TestRewriteCycle:
    def test_a_wrong_number_sends_the_show_back_and_the_fix_airs(self):
        drafter = Recorder(BAD, GOOD)
        final, published = run_graph(drafter)

        assert len(drafter.prompts) == 2, "the cycle must fire exactly once"
        assert "ninety-five" in drafter.prompts[1], "the rewrite must see its own failed draft"
        assert "night.deep_min is 79" in drafter.prompts[1], "and why it failed"
        assert final["violations"] == []
        assert "seventy-nine" in published[0]["transcript"][0]["text"]

    def test_an_incorrigible_writer_is_degraded_not_looped_forever(self):
        drafter = Recorder(BAD)  # never improves
        final, published = run_graph(drafter)

        assert len(drafter.prompts) == 3, "one draft plus MAX_REWRITES rewrites"
        assert len(published) == 1, "the morning still airs"

        aired = published[0]["transcript"][0]["text"]
        assert "ninety-five" not in aired, "the wrong number must never be spoken"
        assert "Good morning." in aired, "the rest of the show survives"


# A tagged draft, as the writer now produces: stage directions for the voice,
# never for the listener's eyes.
TAGGED = ScriptDraft(
    script="[confident] Good morning. [break] Deep sleep came in at seventy-nine minutes.",
    numbers_used=[NumberClaimModel(spoken="seventy-nine", value=79, fact_path="night.deep_min")],
)

# A tenth of a second of silence — enough PCM for ffmpeg to encode honestly.
PCM = b"\x00\x00" * 2400


class TestEngineFallback:
    def test_fish_single_take_is_the_engine_of_record(self):
        final, published = run_graph(
            Recorder(GOOD),
            with_audio=True,
            fish_synthesizer=lambda script: (PCM, [0.0]),
        )
        assert published[0]["ttsModel"] == f"fish/{config.FISH_TTS_MODEL}"
        assert published[0]["segmentStarts"] == [0.0]
        assert published[0]["audioBase64"]

    def test_a_fish_outage_falls_back_to_gemini_with_bare_words(self):
        def fish_down(script):
            raise RuntimeError("503 storm")

        heard: list[str] = []

        def gemini(chunk, model, voice):
            heard.append(chunk)
            return PCM

        _, published = run_graph(
            Recorder(TAGGED),
            with_audio=True,
            fish_synthesizer=fish_down,
            synthesizer=gemini,
        )
        assert published[0]["ttsModel"] == config.TTS_MODEL
        assert published[0]["audioBase64"]
        # Gemini would read "[break]" aloud, so it must never see a tag.
        assert heard and all("[" not in chunk for chunk in heard)

    def test_both_engines_down_still_airs_the_transcript(self):
        def down(*args, **kwargs):
            raise RuntimeError("everything is on fire")

        _, published = run_graph(
            Recorder(GOOD),
            with_audio=True,
            fish_synthesizer=down,
            synthesizer=down,
        )
        assert len(published) == 1, "a text-only morning beats a lost one"
        assert published[0]["audioBase64"] is None
        assert published[0]["transcript"], "the B-side survives"

    def test_transcript_never_shows_stage_directions(self):
        _, published = run_graph(Recorder(TAGGED))
        assert published[0]["transcript"] == [
            {"speaker": "ANCHOR", "text": "Good morning. Deep sleep came in at seventy-nine minutes."}
        ]


class TestDryRun:
    def test_dry_run_produces_the_show_but_airs_nothing(self):
        final, published = run_graph(Recorder(GOOD), dry_run=True)

        assert published == []
        assert final["published"] == {"dryRun": True}
        assert "seventy-nine" in final["script"]
