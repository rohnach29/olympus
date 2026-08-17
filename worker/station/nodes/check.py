"""
The fact gate: pure Python, no model, no network.

The show is allowed to exaggerate an opinion and never a measurement. This
module is the only thing standing between a confident model and a confidently
wrong number, so it is deliberately dumb, deterministic and unit-tested: a gate
that sometimes asks an LLM whether it lied is not a gate.

Three rules, in increasing order of paranoia:

1. No digits anywhere. Numbers must be spoken words, so a digit means the
   writer ignored its instructions and the TTS would read it awkwardly anyway.
2. Every declared number resolves to a real fact and matches it.
3. Every number *heard* in the script was declared. Rule 2 catches misquoting;
   this catches inventing — a number the writer never mentioned in its list.
"""

from __future__ import annotations

import re
from typing import Any, Iterable

from ..state import DeskState, NumberClaim

ONES = {
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
    "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
    "sixteen", "seventeen", "eighteen", "nineteen",
}
TENS = {"twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"}
SCALES = {"hundred", "thousand", "million"}
NUMBER_WORDS = ONES | TENS | SCALES

# A run containing one of these is certainly a measurement, not prose.
BIG_WORDS = TENS | SCALES

# ...and a small run right before one of these is a measurement too:
# "six hours", "ten steps". Bare small numbers ("one of the best mornings")
# are prose and must not be flagged, or the gate cries wolf every day.
UNIT_WORDS = {
    "hour", "hours", "minute", "minutes", "second", "seconds",
    "step", "steps", "gram", "grams", "calorie", "calories", "kilocalories",
    "score", "point", "points", "beat", "beats", "percent", "milliseconds",
}

_TOLERANCE = 0.5


def normalize(text: str) -> str:
    """Lowercase, hyphens to spaces, collapse whitespace."""
    return re.sub(r"\s+", " ", text.lower().replace("-", " ")).strip()


def resolve_path(facts: dict[str, Any] | None, path: str) -> Any:
    """
    Walk a dotted path such as 'night.deep_min'. Missing yields None.

    List indices are understood in either spelling — `workouts.0.duration` and
    `workouts[0].duration` — because the writer reaches for both, and a fact it
    quoted correctly must not be rejected over notation.
    """
    node: Any = facts
    for part in re.split(r"\.|\[(\d+)\]", path):
        if not part:
            continue
        if isinstance(node, dict) and part in node:
            node = node[part]
        elif isinstance(node, list) and part.isdigit() and int(part) < len(node):
            node = node[int(part)]
        else:
            return None
    return node


def _numbers_in(value: Any) -> list[float]:
    """
    Every number a fact could reasonably be quoted as.

    Facts are pre-formatted for speech, so some are strings: "6h52m" is quoted
    as six and fifty-two, "23:22" as eleven twenty-two. Rather than teach this
    module those formats, take any integer appearing in the string.
    """
    if isinstance(value, bool):
        return []
    if isinstance(value, (int, float)):
        return [float(value)]
    if isinstance(value, str):
        found = re.findall(r"\d+", value)
        candidates = [float(n) for n in found]
        # A clock time is one number as often as it is two: "23:22" is honestly
        # quoted as twenty-three, as twenty-two, or as the whole reading.
        # Accepting the joined digits too saves a rewrite every single morning
        # without letting a genuine misquote through.
        if len(found) > 1:
            candidates.append(float("".join(found)))
        return candidates
    return []


def find_number_runs(script: str) -> list[str]:
    """
    Maximal runs of consecutive number-words that read as measurements.

    "six hours fifty-two minutes" yields "six" and "fifty two" as two runs
    (the unit word breaks them), both significant. "one of those mornings"
    yields nothing.
    """
    tokens = re.findall(r"[a-z]+", script.lower().replace("-", " "))
    runs: list[str] = []
    i = 0
    while i < len(tokens):
        if tokens[i] not in NUMBER_WORDS:
            i += 1
            continue

        start = i
        while i < len(tokens) and (
            tokens[i] in NUMBER_WORDS
            # "one hundred and twenty" — 'and' only counts inside a run
            or (tokens[i] == "and" and i + 1 < len(tokens) and tokens[i + 1] in NUMBER_WORDS)
        ):
            i += 1

        run = [t for t in tokens[start:i] if t != "and"]
        following = tokens[i : i + 2]
        significant = any(w in BIG_WORDS for w in run) or any(
            w in UNIT_WORDS for w in following
        )
        if significant:
            runs.append(" ".join(run))

    return runs


def number_words_only(text: str) -> str:
    """
    Reduce a phrase to the number words in it.

    Both sides of the coverage check go through this so they are compared on
    the same footing: the writer may declare "six hours fifty-two minutes" or
    "a hundred and twenty", while a run holds only the numerals. Without this
    projection the units and filler words make identical numbers look different.
    """
    return " ".join(t for t in normalize(text).split() if t in NUMBER_WORDS)


def _covered(run: str, spokens: Iterable[str]) -> bool:
    """A run is covered if it overlaps a declared claim in either direction."""
    run_words = number_words_only(run)
    if not run_words:
        return True

    for spoken in spokens:
        words = number_words_only(spoken)
        if words and (run_words in words or words in run_words):
            return True
    return False


def check_script(
    script: str, numbers: list[NumberClaim], facts: dict[str, Any] | None
) -> list[str]:
    """Return one human-readable violation per problem; empty means airable."""
    violations: list[str] = []

    digits = re.findall(r"\d+", script)
    if digits:
        violations.append(
            f"the script contains digits ({', '.join(sorted(set(digits))[:5])}); "
            "numbers must be spelled as words"
        )

    for claim in numbers:
        spoken = claim.get("spoken", "")
        path = claim.get("fact_path", "")
        value = claim.get("value")

        fact = resolve_path(facts, path)
        if fact is None:
            violations.append(
                f'"{spoken}" cites {path or "no fact"}, which is not in the facts'
            )
            continue

        candidates = _numbers_in(fact)
        if not candidates:
            violations.append(f'"{spoken}" cites {path}, which holds no number ({fact!r})')
            continue

        try:
            claimed = float(value)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            violations.append(f'"{spoken}" declared a non-numeric value ({value!r})')
            continue

        if not any(abs(claimed - c) <= _TOLERANCE for c in candidates):
            violations.append(
                f'"{spoken}" says {claimed:g} but {path} is {fact!r}'
            )

    spokens = [normalize(c.get("spoken", "")) for c in numbers]
    for run in find_number_runs(script):
        if not _covered(run, spokens):
            violations.append(f'"{run}" is spoken but never declared, so it cannot be verified')

    return violations


def check_node(state: DeskState) -> DeskState:
    """
    Grade the draft. This node only records what it found — the decision about
    where to go next lives on the edge, in `route_after_check`.
    """
    violations = check_script(
        state.get("script") or "",
        state.get("numbers") or [],
        state.get("facts"),
    )
    if violations:
        print(f"  check: {len(violations)} violation(s)")
        for v in violations:
            print(f"    - {v}")
    else:
        print("  check: every number verified against the ledger")

    return {"violations": violations}  # type: ignore[return-value]


def unverifiable_phrases(violations: list[str]) -> list[str]:
    """The spoken phrases named in violations, for the degrade node to cut."""
    return [normalize(m) for m in re.findall(r'"([^"]+)"', " ".join(violations))]


def strip_unverified(script: str, phrases: list[str]) -> str:
    """
    Cut the sentences carrying unverifiable numbers, keep the rest.

    Used only after rewrites are exhausted. A slightly shorter show is a much
    better outcome than a wrong number spoken with total confidence.
    """
    if not phrases:
        return script

    kept_paragraphs: list[str] = []
    for paragraph in script.split("\n\n"):
        sentences = re.split(r"(?<=[.!?])\s+", paragraph.strip())
        kept = [s for s in sentences if not any(p in normalize(s) for p in phrases)]
        if kept:
            kept_paragraphs.append(" ".join(kept))

    return "\n\n".join(kept_paragraphs)


def degrade_node(state: DeskState) -> DeskState:
    """Last resort: air the verifiable part of the show."""
    phrases = unverifiable_phrases(state.get("violations") or [])
    trimmed = strip_unverified(state.get("script") or "", phrases)
    print(f"  degrade: cut {len(phrases)} unverifiable claim(s) and aired the rest")
    return {"script": trimmed, "violations": []}  # type: ignore[return-value]
