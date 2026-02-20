"""Scoring status and trigger endpoints."""

import logging

from fastapi import APIRouter, Depends
from sqlmodel import Session, func, select

from backend.config import get_settings
from backend.deps import get_session
from backend.models import Article, UserPreferences
from backend.ollama_service import check_health, list_models

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/scoring", tags=["scoring"])


@router.post("")
def trigger_rescore(
    session: Session = Depends(get_session),
):
    """Trigger re-scoring of recent unread articles."""
    from backend.scheduler import scoring_queue

    queued = scoring_queue.enqueue_recent_for_rescoring(session)
    return {"ok": True, "rescore_queued": queued}


@router.get("/status")
async def get_scoring_status(
    session: Session = Depends(get_session),
):
    """Get counts of articles by scoring state, plus live activity and readiness."""
    from backend.scoring import get_scoring_activity

    settings = get_settings()

    # Single GROUP BY query replaces 5 separate COUNT queries
    state_rows = session.exec(
        select(Article.scoring_state, func.count(Article.id)).group_by(
            Article.scoring_state
        )
    ).all()

    counts: dict = {
        "unscored": 0,
        "queued": 0,
        "scoring": 0,
        "scored": 0,
        "failed": 0,
    }
    for state, count in state_rows:
        if state in counts:
            counts[state] = count

    # Separate query for blocked (scored articles with composite_score == 0)
    blocked_count = session.exec(
        select(func.count(Article.id))
        .where(Article.scoring_state == "scored")
        .where(Article.composite_score == 0)
    ).one()
    counts["blocked"] = blocked_count

    activity = get_scoring_activity()
    counts["current_article_id"] = activity["article_id"]
    counts["phase"] = activity["phase"]

    # Readiness check: Ollama connected + required models available
    scoring_ready = False
    scoring_ready_reason: str | None = None

    health = await check_health(settings.ollama.host)
    if not health["connected"]:
        scoring_ready_reason = "Scoring paused — Ollama is not running"
    else:
        try:
            models_resp = await list_models(settings.ollama.host)
            installed_names = {m["name"] for m in models_resp}

            # Resolve required model names
            prefs = session.exec(select(UserPreferences)).first()
            cat_model = (
                (prefs.ollama_categorization_model if prefs else None)
                or settings.ollama.categorization_model
            )
            if prefs and prefs.ollama_use_separate_models:
                score_model = (
                    prefs.ollama_scoring_model or settings.ollama.scoring_model
                )
            else:
                score_model = cat_model

            missing = [m for m in {cat_model, score_model} if m not in installed_names]
            if missing:
                names = ", ".join(missing)
                scoring_ready_reason = (
                    f"Scoring paused — model {names} is not downloaded"
                    if len(missing) == 1
                    else f"Scoring paused — models {names} are not downloaded"
                )
            else:
                scoring_ready = True
        except Exception:
            logger.exception("Scoring readiness check failed")
            scoring_ready_reason = "Scoring paused — could not check model availability"

    counts["scoring_ready"] = scoring_ready
    counts["scoring_ready_reason"] = scoring_ready_reason

    return counts
