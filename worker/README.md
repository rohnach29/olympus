# The press run

The nightly worker that produces Station Olympus — the morning show about your
own body. Python, LangGraph, run by GitHub Actions on a cron. It is never
deployed: a runner checks out this repo, runs it for about two minutes, and is
destroyed. "Deploying" the worker is `git push`.

## The graph

```
START → gather → write → check ─┬─ clean ──────────────→ tts → publish → END
                                ├─ violations, drafts left → write ↺
                                └─ out of drafts → degrade → tts
```

| Node | What it does |
|---|---|
| `gather` | Asks the Olympus app for the morning's facts. The worker never touches the database, so the radio can't contradict the paper. |
| `write` | Gemini drafts the show **and declares every number it spoke**, with the fact each came from. |
| `check` | Pure Python. No digits allowed, every declared number must match the ledger, and every number heard must have been declared. |
| `degrade` | Last resort: cut the sentences carrying unverifiable numbers, air the rest. |
| `tts` | Synthesizes in chunks and stitches — a single long take drifts muffled. |
| `publish` | POSTs the episode back to the app, which owns the blob and the schema. |

State is checkpointed to Postgres after every node under `station-<date>`, so a
run that dies at synthesis resumes at synthesis instead of paying to write the
show again. On a ten-calls-a-day TTS quota that is a billing feature.

## Running it

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

.venv/bin/python -m station.run                     # this morning, for real
.venv/bin/python -m station.run --date 2026-08-16   # a specific morning
.venv/bin/python -m station.run --no-audio          # skip synthesis
.venv/bin/python -m station.run --dry-run           # produce, publish nothing
.venv/bin/python -m station.run --fresh             # ignore saved progress

.venv/bin/python -m pytest
```

Local runs read `../.env.local`; Actions injects the same names from repository
secrets. Required: `STATION_API_URL`, `STATION_SECRET`, `GEMINI_API_KEY`, and
`DIRECT_DATABASE_URL` (checkpoints only — never for reading health data).

`ffmpeg` must be on PATH for mp3 encoding; it ships with `ubuntu-latest`.

## Things learned the hard way

- **Don't mix TTS models within one episode.** "Charon" on 3.1 is a different
  voice from "Charon" on 2.5, so a mid-show fallback changes the anchor
  between paragraphs. The model is pinned per run; chunks retry instead.
- **Writer fallback is load-bearing.** `gemini-3.7-flash` returned 503 for an
  entire working day while 3.6 answered every time.
- **Never set temperature.** Provider defaults are what these models were tuned
  for; forcing determinism on this family leaks scratchpad and loops.
- **Facts may be strings.** `"6h52m"` and `"23:22"` are quoted as any of their
  parts or as the whole reading, so the gate accepts all of them.
