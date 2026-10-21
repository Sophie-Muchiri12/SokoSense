"""Admin market-data refresh — runs the KAMIS → CSV pipeline on demand.

POST /api/admin/market-refresh   start a full collection (background)
GET  /api/admin/market-refresh   job status + active CSV metadata

A full collection scrapes every KAMIS commodity, so it runs in a
background thread; the admin portal polls GET for progress. Only one run
at a time. When the run finishes, the rebuilt CSV has already been
atomically swapped in (old file removed from the serving path); if the
run fails, the old CSV keeps serving untouched.
"""

from __future__ import annotations

import logging
import threading
from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from auth.security import require_admin

from data import market_csv

logger = logging.getLogger(__name__)
router = APIRouter(tags=["admin"], dependencies=[Depends(require_admin)])

_lock = threading.Lock()
_job: dict = {
    "state": "idle",  # idle | running | succeeded | failed
    "started_at": None,
    "finished_at": None,
    "progress": None,
    "stats": None,
    "error": None,
}


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _run() -> None:
    from data.kamis_collect import run_pipeline

    def progress(info: dict) -> None:
        with _lock:
            _job["progress"] = info

    try:
        stats = run_pipeline(on_progress=progress)
        with _lock:
            _job.update(state="succeeded", stats=stats, error=None)
    except Exception as exc:  # old CSV stays in place — see kamis_collect
        logger.exception("Admin market refresh failed")
        with _lock:
            _job.update(state="failed", stats=None, error=str(exc))
    finally:
        with _lock:
            _job["finished_at"] = _now()
            _job["progress"] = None


@router.post("/api/admin/market-refresh")
def start_market_refresh() -> dict:
    with _lock:
        if _job["state"] == "running":
            return {"job": dict(_job), "csv": market_csv.status(), "already_running": True}
        _job.update(
            state="running",
            started_at=_now(),
            finished_at=None,
            progress=None,
            stats=None,
            error=None,
        )
    threading.Thread(target=_run, name="kamis-csv-refresh", daemon=True).start()
    return {"job": dict(_job), "csv": market_csv.status()}


@router.get("/api/admin/market-refresh")
def market_refresh_status() -> dict:
    with _lock:
        job = dict(_job)
    return {"job": job, "csv": market_csv.status()}
