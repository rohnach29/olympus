"""
The fact gate is the only thing standing between a confident model and a
confidently wrong number, so it gets the most rigorous tests in the worker.
"""

from station.nodes.check import (
    check_script,
    find_number_runs,
    resolve_path,
    strip_unverified,
    unverifiable_phrases,
)

FACTS = {
    "morning_of": "Sunday 2026-08-16",
    "verdict": {"recovery": 76, "band": "recovered"},
    "night": {"asleep": "6h52m", "deep_min": 79, "score": 87, "bedtime": "23:22"},
    "yesterday": {
        "steps": 6828,
        "protein_g": 86,
        "meals": ["Rajma chawal"],
        "workouts": [{"type": "yoga", "durationMinutes": 44}],
    },
}


def claim(spoken, value, path):
    return {"spoken": spoken, "value": value, "fact_path": path}


class TestResolvePath:
    def test_walks_dotted_paths(self):
        assert resolve_path(FACTS, "night.deep_min") == 79
        assert resolve_path(FACTS, "verdict.band") == "recovered"

    def test_missing_yields_none(self):
        assert resolve_path(FACTS, "night.nonsense") is None
        assert resolve_path(FACTS, "nowhere.at.all") is None
        assert resolve_path(None, "night.deep_min") is None

    def test_walks_into_lists_either_way_they_are_written(self):
        # The writer reaches for both notations; a correctly quoted fact must
        # not be rejected over punctuation.
        assert resolve_path(FACTS, "yesterday.workouts[0].durationMinutes") == 44
        assert resolve_path(FACTS, "yesterday.workouts.0.durationMinutes") == 44
        assert resolve_path(FACTS, "yesterday.workouts[3].durationMinutes") is None


class TestNumberRuns:
    def test_finds_measurements(self):
        runs = find_number_runs("You logged seventy-nine minutes of deep sleep.")
        assert runs == ["seventy nine"]

    def test_small_numbers_next_to_units_count(self):
        assert find_number_runs("You slept six hours.") == ["six"]

    def test_bare_small_numbers_are_prose(self):
        # The gate must not cry wolf on ordinary English, or every show fails.
        assert find_number_runs("One of those mornings. Two ways to look at it.") == []

    def test_joins_across_and(self):
        # "and" holds the run together but is not itself part of the number.
        assert find_number_runs("A hundred and twenty steps") == ["hundred twenty"]

    def test_a_claim_written_with_and_still_covers_its_run(self):
        # Both sides are compared on number words alone, so filler and units
        # cannot make the same figure look like two different ones.
        script = "You walked a hundred and twenty steps."
        numbers = [claim("a hundred and twenty steps", 120, "yesterday.walk")]
        facts = {"yesterday": {"walk": 120}}
        assert check_script(script, numbers, facts) == []


class TestCheckScript:
    def test_clean_script_passes(self):
        script = "You slept six hours and fifty-two minutes, with seventy-nine minutes of deep sleep."
        numbers = [
            claim("six hours fifty-two minutes", 6, "night.asleep"),
            claim("seventy-nine", 79, "night.deep_min"),
        ]
        assert check_script(script, numbers, FACTS) == []

    def test_digits_are_rejected(self):
        violations = check_script("You slept 6 hours.", [], FACTS)
        assert any("digits" in v for v in violations)

    def test_misquoted_number_is_caught(self):
        script = "Deep sleep came in at ninety-five minutes."
        numbers = [claim("ninety-five", 95, "night.deep_min")]  # the fact says 79
        violations = check_script(script, numbers, FACTS)
        assert any("ninety-five" in v and "79" in v for v in violations)

    def test_citing_a_fact_that_does_not_exist_is_caught(self):
        script = "Your VO2 max hit fifty-two."
        numbers = [claim("fifty-two", 52, "yesterday.vo2max")]
        violations = check_script(script, numbers, FACTS)
        assert any("not in the facts" in v for v in violations)

    def test_undeclared_number_is_caught(self):
        # The model invented a figure and simply did not mention it in its list.
        script = "You took twelve thousand steps yesterday."
        violations = check_script(script, [], FACTS)
        assert any("never declared" in v for v in violations)

    def test_string_facts_can_be_quoted_by_either_part(self):
        # "6h52m" may honestly be spoken as six, or as fifty-two.
        script = "Fifty-two minutes past the hour."
        assert check_script(script, [claim("fifty-two", 52, "night.asleep")], FACTS) == []

    def test_time_facts_resolve(self):
        script = "Lights out at eleven twenty-two."
        numbers = [claim("eleven twenty-two", 22, "night.bedtime")]
        assert check_script(script, numbers, FACTS) == []

    def test_a_clock_time_may_be_quoted_whole(self):
        # The first live run declared 2322 for "23:22" and lost a rewrite to
        # it. Reading the clock as one number is honest, so it passes.
        script = "Lights out at eleven twenty-two."
        numbers = [claim("eleven twenty-two", 2322, "night.bedtime")]
        assert check_script(script, numbers, FACTS) == []

    def test_a_duration_may_be_declared_as_total_minutes(self):
        # Two real runs lost a rewrite to this: the writer speaks "six hours
        # fifty-two minutes" and declares the arithmetic truth, 412 minutes.
        # The gate does no math, so the product belongs in the accepted set.
        script = "You slept six hours fifty-two minutes."
        numbers = [claim("six hours fifty-two minutes", 412, "night.asleep")]
        assert check_script(script, numbers, FACTS) == []

    def test_a_duration_total_must_still_be_right(self):
        script = "You slept six hours fifty-two minutes."
        numbers = [claim("six hours fifty-two minutes", 397, "night.asleep")]
        assert check_script(script, numbers, FACTS) != []

    def test_the_dateline_can_be_declared_against_morning_of(self):
        # "August sixteenth, twenty twenty-six" — the day and year are numbers
        # like any other; a real run lost a rewrite to leaving them undeclared.
        script = "It is August sixteenth, twenty twenty-six. A fine morning."
        numbers = [claim("twenty twenty-six", 2026, "morning_of")]
        assert check_script(script, numbers, FACTS) == []

    def test_a_workout_duration_can_be_quoted_from_its_list(self):
        script = "You gave it forty-four minutes on the mat."
        numbers = [claim("forty-four", 44, "yesterday.workouts[0].durationMinutes")]
        assert check_script(script, numbers, FACTS) == []


class TestDegrade:
    def test_cuts_only_the_offending_sentence(self):
        script = (
            "Good morning. Deep sleep came in at ninety-five minutes.\n\n"
            "You took six thousand eight hundred twenty-eight steps."
        )
        violations = ['"ninety-five" says 95 but night.deep_min is 79']
        trimmed = strip_unverified(script, unverifiable_phrases(violations))

        assert "ninety-five" not in trimmed
        assert "Good morning." in trimmed
        assert "six thousand eight hundred twenty-eight" in trimmed

    def test_drops_paragraphs_that_lose_every_sentence(self):
        script = "Deep sleep hit ninety-five minutes.\n\nHave a good day."
        trimmed = strip_unverified(script, ["ninety five"])
        assert trimmed == "Have a good day."

    def test_no_phrases_leaves_the_script_alone(self):
        assert strip_unverified("Untouched.", []) == "Untouched."
