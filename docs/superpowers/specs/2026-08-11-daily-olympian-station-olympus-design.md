# The Daily Olympian + Station Olympus 87.4 — Design Spec

**Date:** 2026-08-11
**Status:** Draft for review
**Supersedes:** `2026-03-24-body-map-ui-redesign-design.md` (Body Map direction is dead)

---

## 1. Concept

Olympus has no dashboard. Every morning, while you sleep, an autonomous editorial
pipeline studies your health data and publishes **one issue** in two editions:

- **The Daily Olympian** — a typeset broadsheet front page (HTML). Findings from
  the correlation engine become articles, the illness sentinel is "The Watchtower"
  column, model errors are owned publicly in a "Corrections" box.
- **Station Olympus 87.4** — the same issue performed as a 2–3 minute radio show
  (multi-speaker TTS audio) that's ready before your alarm.

One pipeline, two renderers. The LLM writes prose; it **never invents a number** —
every statistic is computed deterministically first and fact-checked after.

### Resume goals (explicit design constraints)

- **LangGraph (Python)** orchestrates the editorial pipeline: conditional edges,
  parallel fan-out, a verification/retry loop, and an interrupt path.
- **MCP** is the single tool surface over Olympus data, consumed by *two* clients:
  Claude Desktop (interactive, already live) and the LangGraph pipeline
  (autonomous, via `langchain-mcp-adapters`).
- **Gemini free tier** for all LLM + TTS calls (`langchain-google-genai`).
  Sole user for now; BYOK (per-user encrypted Gemini keys) is the future
  multi-user model and appears here only as a schema note.

---

## 2. What already exists (build on, don't rebuild)

| Piece | Where | State |
|---|---|---|
| Apple Health ingestion | `src/app/api/webhooks/health-auto-export/route.ts` + `api_tokens`/`webhook_logs` tables | **Working.** Health Auto Export app POSTs metrics/sleep/workouts |
| Time-series store | `health_metrics` (generic typed metrics), `sleep_sessions` (stages, HRV, RHR, resp rate), `workouts`, `food_logs`, `daily_scores`, `blood_work` | **Working schema** |
| MCP server | `mcp-server/src/index.ts` — 17 tools (sleep/HRV/workouts/food/blood-work/longevity) | **Working** with Claude Desktop |
| Auth (single user) | iron-session, `users`/`sessions` | Working |
| Web app | Next.js 16 App Router on Vercel, Tailwind 4 | Working; pages will be replaced by the newspaper UI |

Approved visual language (mockups verified 2026-08-10, in scratchpad `pitch2/` and
the pitch artifact): masthead `UnifrakturMaguntia`, headlines `Playfair Display 900`,
body `Old Standard TT`, labels `IBM Plex Mono`; paper `#efe7d2→#e4dabc`, ink
`#1a1712`, overprint red `#a02214`. Radio: walnut/brass studio, VU meters, chaptered
waveform, "THE SHELF" episode archive.

---

## 3. Architecture

```
┌────────────────────────  GitHub Actions (free compute)  ───────────────────────┐
│                                                                                │
│  nightly.yml (cron ≈ 23:00 UTC = 04:30 IST)      sentinel.yml (hourly)         │
│        │                                               │                       │
│        ▼                                               ▼                       │
│  worker/ (Python)                              worker/ sentinel check          │
│  1. stats engine  ── deterministic ──▶ facts   (z-composite vs baselines)      │
│  2. LangGraph editorial desk (Gemini)          breach? ──▶ EXTRA subgraph      │
│  3. renderers: IssueJSON ─▶ (a) stored for     │                               │
│     Next.js typesetting  (b) radio script      │                               │
│  4. TTS (Gemini multi-speaker) ─▶ mp3 ─▶ Vercel Blob                           │
│  5. write `issues` row ─▶ done                                                 │
└──────────────────────────────┬─────────────────────────────────────────────────┘
                               │ CockroachDB (single source of truth)
      ┌────────────────────────┼──────────────────────────┐
      ▼                        ▼                          ▼
 Next.js (Vercel, RSC)    MCP server (stdio)         Claude Desktop
 "/" today's issue        one tool surface  ◀────────  interactive queries
 "/archive" newsstand     also consumed by worker
 "/station" radio player  via langchain-mcp-adapters
```

**Division of labor rule:** numeric truth = Python stats engine (never the LLM);
prose = Gemini inside LangGraph; layout = React templates already designed.

### 3.1 Repo layout (monorepo, two languages)

```
olympus/
├── src/…                     # Next.js app (renderer + ingestion) — TS
├── mcp-server/               # MCP tool surface — TS (extended, §3.6)
├── worker/                   # NEW — Python 3.12, managed with uv
│   ├── pyproject.toml        # langgraph, langchain-google-genai,
│   │                         # langchain-mcp-adapters, psycopg[binary],
│   │                         # scipy, numpy, pydantic
│   ├── olympian/
│   │   ├── stats/            # correlations.py, sentinel.py, trials.py, aggregates.py
│   │   ├── desk/             # graph.py (LangGraph), nodes/, prompts/
│   │   ├── audio/            # tts.py (Gemini multi-speaker), blob.py (Vercel Blob upload)
│   │   ├── db.py             # psycopg reads/writes (stats + publishing only)
│   │   └── run.py            # entrypoints: nightly / sentinel / backfill
│   └── tests/
└── .github/workflows/
    ├── nightly.yml           # the press run
    └── sentinel.yml          # hourly watchtower
```

### 3.2 New database tables (Drizzle migrations in the main app)

```ts
// The published record. content is IssueJSON (§3.4) — the contract.
issues: { id, userId, issueDate (unique per user+kind), number (serial per user),
          kind: 'daily'|'extra'|'sunday', content: jsonb, audioUrl, audioDurationS,
          status: 'published'|'failed', publishedAt, openedAt (nullable — set on
          first view; null = a morning you never read), createdAt }

// Correlation-engine output; the newspaper's "beat sheet" memory.
findings: { id, userId, exposure, outcome, lagDays, rho, pValue, qValue, nDays,
            windowDays, direction, status: 'candidate'|'published'|'retired',
            firstPublishedIssue, lastSeenAt, evidence: jsonb, createdAt }

// Every forecast the paper prints gets scored later → Corrections box + calibration.
forecasts: { id, userId, issueDate, metric, predicted, lo, hi, actual (nullable),
             scoredAt (nullable), createdAt }

// N=1 trials ("page B3").
trials: { id, userId, name, intervention, outcomeMetric, startDate, lengthDays,
          status: 'running'|'concluded'|'aborted', verdict: jsonb (d, ci, ruling),
          createdAt }

// Sentinel state so hourly checks are cheap and alarms aren't re-fired.
sentinelState: { userId (pk), baselines: jsonb, lastComposite, lastCheckedAt,
                 alarmActiveSince (nullable), lastAlarmIssueId (nullable) }
```

The worker reads/writes these with psycopg using the same DATABASE_URL. Drizzle
owns the migrations; Python treats the schema as read-only DDL.

### 3.3 Stats engine (worker/olympian/stats/ — pure functions, unit-tested)

- **Daily aggregates** — one row per day per signal (sleep duration/stages,
  HRV, RHR, resp rate, strain from workouts, last-meal-hour from food logs,
  caffeine mg after noon, alcohol proxy if logged). Source: SQL over existing tables.
- **Correlation engine** — lagged Spearman (lags 0–2 days) between exposure and
  outcome series, ≥ 21 paired days required; permutation test (n=1000) for p;
  Benjamini–Hochberg across the whole grid each night; only q < 0.05 becomes a
  `finding`. Effect restated in plain units for copy ("−34% deep sleep").
- **Sentinel** — 28-day rolling mean/σ for RHR, skin/wrist temp (if present),
  resp rate, HRV; composite z = weighted sum of same-direction deviations;
  alarm at composite ≥ 2.0 sustained across two consecutive checks.
- **Trials** — paired comparison of on-protocol vs baseline days: Cohen's d +
  bootstrap 95% CI (n=2000). Verdict only at completion; the paper refuses early rulings.
- **Forecasts** — tomorrow's recovery/HRV predicted from a simple ridge on the
  last 28 days (features: sleep, strain, meal timing). Written to `forecasts`;
  yesterday's row scored every night. Brier/calibration feeds Corrections.

Newsworthiness (deterministic ranking, no LLM): new finding > trial verdict >
sentinel state change > forecast miss ≥ threshold > streak/record > quiet-day fallback.

### 3.4 IssueJSON — the contract between pipeline and renderers

```jsonc
{
  "kind": "daily", "number": 214, "date": "2026-08-11",
  "masthead": { "folio": "...", "ear_left": "...", "ear_right": "..." },
  "lead": { "headline": "...", "deck": "...", "body_md": "...",
            "figure": { "series": "recovery_28d", "annotation": "...", "caption": "..." } },
  "findings": [ { "finding_id": "...", "headline_bold": "...", "body": "...",
                  "statline": "−34% DEEP · p=0.003 · 41 NIGHTS" } ],
  "watchtower": { "status": "all_quiet" | "storm", "body": "...", "composite_z": 0.4 },
  "forecast": { "sky": "...", "body": "...", "numbers": { "recovery": 92, "rhr": 47,
                "hrv": 96, "sleep": "7:42" } },
  "corrections": { "body": "..." } | null,
  "trials": [ { "trial_id": "...", "body": "..." } ],
  "ad": { "headline": "EIGHT HOURS", "body": "..." },      // house ads, rotating
  "radio": { "chapters": [ { "title": "THE NIGHT", "lines": [
               { "speaker": "ORACLE" | "ALEXIOS", "text": "..." } ] } ] }
}
```

Every number in prose must also appear in a `facts` sidecar (see fact-checker).
Renderers are dumb: the React newspaper template and the TTS script builder both
consume IssueJSON and nothing else.

### 3.5 The Editorial Desk — LangGraph graph (worker/olympian/desk/)

State: `DeskState(TypedDict)` — facts, rundown, drafts{}, issue, violations, retries.

```
START
 └▶ gather            # facts.json from stats engine + MCP context calls
 └▶ rank              # deterministic newsworthiness ordering (no LLM)
 └▶ editor            # Gemini: chooses angle, assigns stories → rundown
 └▶ [parallel fan-out] lead_writer | findings_writer | watchtower_writer | forecast_writer
 └▶ assemble          # merge drafts → IssueJSON candidate
 └▶ fact_checker      # extract every numeral/claim from copy, diff vs facts
      ├─ violations & retries < 2 ──▶ rewrite (targeted, per-section) ──▶ assemble
      ├─ violations & retries = 2 ──▶ degrade (drop offending section, log)
      └─ clean ──▶ broadcast_writer   # Gemini: IssueJSON → two-voice radio script
 └▶ tts               # Gemini multi-speaker TTS → mp3 → Vercel Blob
 └▶ publish           # insert `issues` row; score yesterday's forecast
END

EXTRA path (sentinel.yml): breach ──▶ extra_writer ──▶ fact_checker ──▶ tts(bulletin)
──▶ publish(kind='extra') — a smaller subgraph reusing the same nodes.
```

Models: `gemini-2.5-flash` with `with_structured_output` (Pydantic) for editor
and writers; temperature low for copy discipline. The fact-checker is **pure
Python** (regex numeral extraction + tolerance matching against facts), not an LLM —
a deterministic gate, per quality rules.

**MCP in the loop:** `gather` and the writers' tool belt use the *existing* MCP
server through `langchain-mcp-adapters` (stdio transport; the GH runner has Node
and spawns `mcp-server`). New tools added for the pipeline are equally available
to Claude Desktop (§3.6). Direct psycopg is used only where MCP is the wrong
shape: bulk series for stats, and publishing writes.

### 3.6 MCP server additions (mcp-server/src/index.ts)

New tools (usable by both Claude Desktop and the pipeline):
`get_metric_series(metric, days)` · `get_daily_aggregates(days)` ·
`get_issue(date|number)` · `list_findings(status)` · `get_trial(id)` ·
`start_trial(name, intervention, outcome, length_days)` · `get_forecast_scorecard(days)`

The last four make Claude Desktop a *newsroom terminal*: "start a 14-day magnesium
trial", "how honest has the paper been this month?".

### 3.7 Audio (worker/olympian/audio/)

- **TTS:** `gemini-2.5-flash-preview-tts` multi-speaker mode — ORACLE (measured,
  e.g. voice "Charon") + ALEXIOS (gruff, e.g. "Puck") in a single request per
  chapter; chapters concatenated with 400ms gaps; loudness-normalized; encoded mp3
  (ffmpeg on the runner). Free tier is ~15 requests/day — an episode uses 3–5.
- **Storage:** Vercel Blob via REST with `BLOB_READ_WRITE_TOKEN`; URL stored on
  the issue row. Episodes are small (~2–3 MB).
- **Fallback:** if TTS quota/preview fails, publish the issue without audio and
  mark `audioUrl = null`; the player page shows "transmission failed — read this
  morning's paper instead." Never block the newspaper on the radio.

### 3.8 Next.js delivery (replaces current dashboard pages)

- `/` — today's issue, server-rendered from `issues.content` using the approved
  broadsheet design (React port of `issue2.html`). Yesterday's issues at `/issue/[n]`.
- `/archive` — the newsstand (port of `newsstand.html`), covers grid from issue rows;
  missed mornings = issues never opened (`openedAt` timestamp set on first view).
- `/station` — the radio player (port of `radio.html`): chaptered waveform seek,
  transcript from `content.radio`, THE SHELF from recent episodes.
- EXTRA issues render with the red EXTRA treatment automatically (`kind`).
- Old dashboard routes are removed; existing API routes (ingestion, auth, food)
  stay untouched.

### 3.9 GitHub Actions

- `nightly.yml` — `schedule: cron '0 23 * * *'` (≈04:30 IST; GH cron drifts
  minutes, acceptable) + `workflow_dispatch` for manual press runs.
  Steps: checkout → setup uv + node → install worker + mcp-server → `python -m
  olympian.run nightly` → failure notifies (GH issue comment or email).
  Secrets: `DATABASE_URL`, `GEMINI_API_KEY`, `OLYMPUS_USER_ID`, `BLOB_READ_WRITE_TOKEN`.
- `sentinel.yml` — hourly cron, `python -m olympian.run sentinel` (SQL + arithmetic
  only, a few seconds; spawns the EXTRA subgraph on breach).

### 3.10 Editorial voice (prompt contract, worker/olympian/desk/prompts/)

The Oracle: writes like a 1920s broadsheet correspondent about a body it respects
but will not flatter; cites n/p inline via statlines; refuses verdicts on
insufficient data; owns errors in Corrections without hedging. Alexios (radio
color): blunt, warm underneath, speaks only where the rundown gives him lines.
Prohibitions: no numbers absent from facts, no medical diagnosis, no praise
without a cited streak/record.

---

## 4. Testing & verification gates

- **Stats:** pytest with synthetic series of known structure (planted correlation
  recovered; null series produce no q<0.05 findings at >95% rate; sentinel fires on
  injected drift; trial d matches hand-computed value). These are the product's
  credibility — most rigorous tests in the repo.
- **Fact-checker:** table-driven tests (numbers matching/missing/mutated units).
- **Graph:** integration test with a `FakeListChatModel` — full run on fixture
  facts produces schema-valid IssueJSON; rewrite loop triggers on planted violation.
- **Renderers:** IssueJSON fixture → React snapshot; visual check against approved
  mockups (headless Chrome, per established workflow).
- **Pipeline dry-run:** `workflow_dispatch` against real DB with `--no-publish`
  prints the issue to the Action log before first real press run.

## 5. Privacy & ops

- No raw health rows in Action logs (log counts and issue numbers only).
- All secrets in GH encrypted secrets / Vercel env; nothing in the repo.
- BYOK future: `userKeys` table with per-user encrypted Gemini keys (AES-GCM,
  server secret), pipeline matrix over active users — **out of scope now**, schema
  designed so nothing needs migration later.

## 6. Build phases

1. **The Press** — migrations (§3.2), stats engine + tests, `run nightly
   --no-llm` producing a facts-only IssueJSON, newspaper page rendering it at `/`.
   *Milestone: a real (if dry) issue from your real Apple Health data.*
2. **The Desk** — LangGraph graph + Gemini writers + fact-checker + Corrections/
   forecast scoring. nightly.yml goes live. *Milestone: wake up to a real paper.*
3. **The Station** — broadcast writer, multi-speaker TTS, Blob upload, `/station`
   player, THE SHELF. *Milestone: the paper talks.*
4. **The Newsroom** — MCP tool additions (§3.6), trials via Claude Desktop,
   `/archive` newsstand, sentinel.yml + EXTRA path.

Each phase ends with the full verification gate (tests, lint, types, build,
visual check) and a pushed commit.

## 7. Out of scope (explicitly)

Web push notifications, Sunday edition, BYOK/multi-user execution, iOS widgets,
the Odds/Trainer/Saga concepts (parked, composable later), any 3D visuals (dead).
