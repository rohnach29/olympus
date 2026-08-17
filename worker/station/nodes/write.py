"""
The writers' room.

Gemini drafts the show against the facts and, in the same structured response,
declares every number it spoke and where it took it from. That declaration is
what makes the next node's job deterministic: the gate never has to parse
"six hours fifty-two minutes" back into arithmetic.

This node is also the graph's cycle target — when the gate rejects a draft,
control comes back here with the violations attached.
"""

from __future__ import annotations

import json

from pydantic import BaseModel, Field

from .. import config
from ..prompts import REWRITE_INSTRUCTION, WRITER_SYSTEM
from ..state import DeskState


class NumberClaimModel(BaseModel):
    """One number the script speaks, traced to its source."""

    spoken: str = Field(description='The number as written in the script, e.g. "seventy-nine"')
    value: float = Field(description="Its numeric value, e.g. 79")
    fact_path: str = Field(
        description='Dotted path into FACTS it came from, e.g. "night.deep_min"'
    )


class ScriptDraft(BaseModel):
    """What the writer returns: the show, and its own account of the numbers."""

    script: str = Field(description="The spoken words only, five paragraphs, blank line between")
    numbers_used: list[NumberClaimModel] = Field(
        default_factory=list,
        description="Every number spoken in the script. Must be complete.",
    )


def _draft_with(model: str, prompt: str) -> ScriptDraft:
    """One attempt against one model."""
    # Imported here so the module can be imported (and tested) without the
    # langchain dependency present.
    from langchain_core.messages import HumanMessage, SystemMessage
    from langchain_google_genai import ChatGoogleGenerativeAI

    # No temperature: provider defaults are what these models were tuned for,
    # and forcing determinism on this family leaks scratchpad and loops.
    llm = ChatGoogleGenerativeAI(model=model, google_api_key=config.gemini_key())
    structured = llm.with_structured_output(ScriptDraft)

    return structured.invoke(
        [SystemMessage(content=WRITER_SYSTEM), HumanMessage(content=prompt)]
    )


def draft_script(prompt: str) -> tuple[ScriptDraft, str]:
    """
    Draft with the primary model, falling back a tier if it will not answer.

    The fallback is not decorative: during the audition the primary returned
    503 for an entire working day while the fallback answered every time.
    """
    try:
        return _draft_with(config.WRITER_MODEL, prompt), config.WRITER_MODEL
    except Exception as err:  # noqa: BLE001 — any failure means try the other model
        print(f"  write: {config.WRITER_MODEL} failed ({err}); falling back")
        return (
            _draft_with(config.WRITER_FALLBACK_MODEL, prompt),
            config.WRITER_FALLBACK_MODEL,
        )


def build_prompt(state: DeskState) -> str:
    """First pass gets the facts; a rewrite also gets its own failed draft."""
    facts_json = json.dumps(state.get("facts"), indent=2)
    prompt = f"FACTS:\n{facts_json}\n\nWrite this morning's show."

    violations = state.get("violations") or []
    if violations:
        prompt += "\n\n" + REWRITE_INSTRUCTION.format(
            script=state.get("script") or "",
            violations="\n".join(f"- {v}" for v in violations),
        )
    return prompt


def make_write_node(drafter=draft_script):
    """Factory so tests can inject a stub writer and exercise the real graph."""

    def write_node(state: DeskState) -> DeskState:
        attempt = state.get("retries", 0)
        draft, model = drafter(build_prompt(state))

        words = len(draft.script.split())
        label = "write" if attempt == 0 else f"rewrite {attempt}"
        print(f"  {label}: {words} words via {model}, {len(draft.numbers_used)} numbers declared")

        return {  # type: ignore[return-value]
            "script": draft.script.strip(),
            "numbers": [claim.model_dump() for claim in draft.numbers_used],
            "writer_model": model,
            # Counting here rather than in the router keeps the router a pure
            # function of state, which is what makes it testable with a dict.
            "retries": attempt + 1,
        }

    return write_node
