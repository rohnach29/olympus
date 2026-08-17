"""
The graph, exercised whole.

These run the real edges, the real router and the real cycle — only the model,
the synthesizer and the network are stubbed. What the test proves is what runs
at four in the morning.
"""

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


def run_graph(drafter, **kwargs):
    published: list[dict] = []

    def poster(payload):
        published.append(payload)
        return {"status": "published", "airDate": payload["airDate"], "pruned": 0}

    graph = build_graph(
        fetcher=lambda date: FACTS,
        drafter=drafter,
        poster=poster,
        with_audio=False,
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


class TestDryRun:
    def test_dry_run_produces_the_show_but_airs_nothing(self):
        final, published = run_graph(Recorder(GOOD), dry_run=True)

        assert published == []
        assert final["published"] == {"dryRun": True}
        assert "seventy-nine" in final["script"]
