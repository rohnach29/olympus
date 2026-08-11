# Session State — 2026-08-10 (updated after round-two pitch)

## Where things stand
- **Direction chosen: THE DAILY OLYMPIAN.** Olympus has no dashboard — it prints a newspaper about your body every morning. User's words: "these are all crap. maybe the newspaper is the only good idea."
- **Rejected, do not re-pitch:** constellation 3D body, MEMENTO (weeks ledger), TERRA CORPORIS (living map), CORPUS METROPOLIS (body-as-city), THE PANTHEON (gods dashboard).

## Approved-in-principle screens (mocked, rendered, verified)
Mockups in session scratchpad `pitch2/`: `issue2.html` (morning front page), `extra.html` (Sentinel alarm as EXTRA edition), `newsstand.html` (Archive). Screenshots delivered; durable copy at https://claude.ai/code/artifact/53c35aad-665a-40a2-a6d6-cbc7d8f1b298

## Design language that landed
- Fonts: UnifrakturMaguntia (masthead), Playfair Display 900 (headlines), Old Standard TT (body), IBM Plex Mono (labels/stats)
- Colors: paper #efe7d2→#e4dabc gradient, ink #1a1712, overprint red #a02214, column rules #b3a888
- Conventions map: morning briefing = front page · sentinel = EXTRA · weekly review = Sunday edition · model honesty = corrections box · trials = page B3 · history = the Archive · forecast = weather box
- Charts as "staff engravings": canvas line charts with cross-hatching, italic captions

## Architecture (agreed shape, not yet specced)
Nightly Vercel cron → SQL over health data → stats layer (lagged correlations w/ FDR, sentinel z vs 28-day baselines, N=1 trial effect sizes) → LLM writes copy from verified findings only → typeset template renders the issue. No WebGL/3D anywhere.

## Next steps
1. User reacts to the three screens; iterate if needed.
2. Then: design doc via brainstorming skill flow (spec to docs/superpowers/specs/), then writing-plans for implementation.

## User working-style notes
- Show, don't tell: rendered screenshots only, verified with close-up crops before claiming.
- Blunt feedback loop; kill ideas fast, don't defend rejected ones.
