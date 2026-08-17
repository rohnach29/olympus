"""
The editorial desk, wired.

    START → gather → write → check ─┬─ clean ──────────────→ tts → publish → END
                                    ├─ violations, drafts left → write ↺
                                    └─ out of drafts → degrade → tts

Three things are worth noticing about this shape, because they are the whole
reason LangGraph is here rather than a plain function:

1. **Nodes do work; edges decide.** `check_node` records what it found and
   nothing else. Where to go next is `route_after_check`, a pure function of
   state — so the interesting logic can be tested with a dictionary and no
   model, no network, and no graph.

2. **The cycle.** `check` can send control *backwards* to `write`. Expressed
   as a straight-line script this is a while-loop tangled with flags; as a
   graph it is one arrow that points the other way.

3. **Checkpointing.** Compiled with a checkpointer, state is saved after every
   node. A run that dies at synthesis resumes at synthesis — on a ten-calls-a-
   day quota, not re-spending the writer is a billing feature, not a nicety.
"""

from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from . import config
from .nodes.check import check_node, degrade_node
from .nodes.gather import fetch_facts, make_gather_node
from .nodes.publish import make_publish_node, post_episode
from .nodes.tts import make_tts_node, synthesize_chunk
from .nodes.write import draft_script, make_write_node
from .state import DeskState


def route_after_check(state: DeskState) -> str:
    """
    The one decision in the graph.

    A clean draft goes to air. A dirty one goes back to the writer while there
    are drafts left in the budget. When the budget is gone we neither loop
    forever nor abandon the morning: `degrade` cuts the unverifiable sentences
    and airs the rest, because a wrong number must never be spoken but a
    slightly shorter show is perfectly fine.
    """
    if not state.get("violations"):
        return "tts"
    if state.get("retries", 0) > config.MAX_REWRITES:
        return "degrade"
    return "write"


def build_graph(
    *,
    fetcher=fetch_facts,
    drafter=draft_script,
    synthesizer=synthesize_chunk,
    poster=post_episode,
    with_audio: bool = True,
    dry_run: bool = False,
    checkpointer=None,
):
    """
    Assemble and compile the desk.

    Every outside dependency arrives as an argument so the tests can run the
    real graph — the real edges, the real router, the real cycle — against
    stubs. What is exercised in the test is the thing that runs at 4am.
    """
    builder = StateGraph(DeskState)

    builder.add_node("gather", make_gather_node(fetcher))
    builder.add_node("write", make_write_node(drafter))
    builder.add_node("check", check_node)
    builder.add_node("degrade", degrade_node)
    builder.add_node("tts", make_tts_node(synthesizer, with_audio=with_audio))
    builder.add_node("publish", make_publish_node(poster, dry_run=dry_run))

    builder.add_edge(START, "gather")
    builder.add_edge("gather", "write")
    builder.add_edge("write", "check")
    builder.add_conditional_edges(
        "check",
        route_after_check,
        # The map is what a reader (and the diagram renderer) sees as the
        # branch's possible destinations.
        {"write": "write", "degrade": "degrade", "tts": "tts"},
    )
    builder.add_edge("degrade", "tts")
    builder.add_edge("tts", "publish")
    builder.add_edge("publish", END)

    return builder.compile(checkpointer=checkpointer)
