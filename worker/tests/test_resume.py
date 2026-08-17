"""
Resuming a broken press run.

This is the reason the graph is checkpointed. Synthesis is the step most
likely to fail at four in the morning — the TTS endpoints throw 400s, 503
storms, hangs and a daily quota wall — and it is also the step that happens
*after* the expensive part. Without checkpoints, a failure there means paying
the writer all over again on a twenty-calls-a-day budget.

The test proves the property directly: kill a run after the show is written,
resume it, and count how many times the writer was asked to work.
"""

import pytest
from langgraph.checkpoint.memory import InMemorySaver

from station.graph import build_graph
from station.nodes.write import NumberClaimModel, ScriptDraft
from station.state import initial_state

FACTS = {"night": {"deep_min": 79}}

DRAFT = ScriptDraft(
    script="Good morning. Deep sleep came in at seventy-nine minutes.",
    numbers_used=[NumberClaimModel(spoken="seventy-nine", value=79, fact_path="night.deep_min")],
)


class CountingWriter:
    def __init__(self):
        self.calls = 0

    def __call__(self, prompt):
        self.calls += 1
        return DRAFT, "stub-model"


def test_a_run_that_dies_at_publish_resumes_without_rewriting():
    writer = CountingWriter()
    checkpointer = InMemorySaver()
    thread = {"configurable": {"thread_id": "station-2026-08-16"}}

    def failing_poster(payload):
        raise RuntimeError("503 from the publish door")

    first = build_graph(
        fetcher=lambda date: FACTS,
        drafter=writer,
        poster=failing_poster,
        with_audio=False,
        checkpointer=checkpointer,
    )

    with pytest.raises(RuntimeError, match="503"):
        first.invoke(initial_state("2026-08-16"), config=thread)

    assert writer.calls == 1, "the show was written once before the failure"

    # Morning two: the same thread, a publish door that now answers. Passing
    # None as input is what tells LangGraph to continue rather than restart.
    published = []
    second = build_graph(
        fetcher=lambda date: FACTS,
        drafter=writer,
        poster=lambda payload: published.append(payload) or {"status": "published"},
        with_audio=False,
        checkpointer=checkpointer,
    )
    final = second.invoke(None, config=thread)

    assert writer.calls == 1, "resuming must not re-spend the writer"
    assert len(published) == 1, "and the morning still airs"
    assert "seventy-nine" in final["script"]


def test_state_survives_the_failure_intact():
    """What was learned before the crash is still there afterwards."""
    checkpointer = InMemorySaver()
    thread = {"configurable": {"thread_id": "station-2026-08-17"}}

    graph = build_graph(
        fetcher=lambda date: FACTS,
        drafter=CountingWriter(),
        poster=lambda payload: (_ for _ in ()).throw(RuntimeError("down")),
        with_audio=False,
        checkpointer=checkpointer,
    )
    with pytest.raises(RuntimeError):
        graph.invoke(initial_state("2026-08-17"), config=thread)

    saved = graph.get_state(thread).values
    assert saved["facts"] == FACTS
    assert "seventy-nine" in saved["script"]
    assert saved["violations"] == []
    # The checkpoint knows publish is what still has to happen.
    assert graph.get_state(thread).next == ("publish",)
