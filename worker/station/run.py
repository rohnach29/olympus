"""
The press run.

    python -m station.run                     # this morning, for real
    python -m station.run --date 2026-08-16   # a specific morning
    python -m station.run --no-audio          # write and publish, no synthesis
    python -m station.run --dry-run           # print the show, air nothing

Resuming: state is checkpointed after every node under the thread id
"station-<date>", so re-running a date that failed part-way picks up where it
stopped instead of paying for the writing again. Pass --fresh to ignore any
saved progress and start the morning over.
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

from . import config
from .graph import build_graph
from .state import initial_state


def today_local() -> str:
    return datetime.now(ZoneInfo(config.STATION_TZ)).strftime("%Y-%m-%d")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="station.run", description="Produce a morning show.")
    parser.add_argument("--date", default=None, help="Morning to produce (YYYY-MM-DD)")
    parser.add_argument("--no-audio", action="store_true", help="Write the show but do not synthesize")
    parser.add_argument("--dry-run", action="store_true", help="Produce but do not publish")
    parser.add_argument("--fresh", action="store_true", help="Ignore any checkpointed progress")
    return parser.parse_args(argv)


def run(args: argparse.Namespace) -> int:
    date = args.date or today_local()
    print(f"Station Olympus — press run for {date}")

    graph_kwargs = {"with_audio": not args.no_audio, "dry_run": args.dry_run}
    thread = f"station-{date}" + ("-fresh" if args.fresh else "")
    invoke_config = {"configurable": {"thread_id": thread}}

    dsn = config.checkpoint_dsn()
    if dsn:
        # Postgres, not SQLite: the Actions runner is destroyed after every
        # run, so a checkpoint file would take the resume point with it.
        from langgraph.checkpoint.postgres import PostgresSaver

        with PostgresSaver.from_conn_string(dsn) as checkpointer:
            checkpointer.setup()  # no-op after the first run
            graph = build_graph(checkpointer=checkpointer, **graph_kwargs)
            final = graph.invoke(initial_state(date), config=invoke_config)
    else:
        print("  (no database url — running without checkpoints)")
        graph = build_graph(**graph_kwargs)
        final = graph.invoke(initial_state(date))

    script = final.get("script") or ""
    print("\n" + "─" * 72)
    print(script)
    print("─" * 72)

    if final.get("violations"):
        print(f"\nAired with {len(final['violations'])} unresolved violation(s).")
    if not final.get("published"):
        print("\nNothing was published.")
        return 1

    print(f"\nDone: {final['published']}")
    return 0


def main() -> int:
    try:
        return run(parse_args())
    except Exception as err:  # noqa: BLE001 — the runner wants one clear line
        print(f"\nPress run failed: {err}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
