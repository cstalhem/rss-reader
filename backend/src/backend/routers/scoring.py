"""Scoring status and trigger endpoints."""

from fastapi import APIRouter, Depends
from sqlmodel import Session, func, select

from backend.deps import (
    TASK_CATEGORIZATION,
    TASK_SCORING,
    evaluate_task_readiness,
    format_readiness_reason,
    get_session,
)
from backend.models import Article

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
    from backend.scoring import get_rate_limit_remaining, get_scoring_activity, is_rate_limited

    # Single GROUP BY query replaces 5 separate COUNT queries
    state_rows = session.exec(
        select(Article.scoring_state, func.count(Article.id)).group_by(  # pyright: ignore[reportArgumentType]
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
        select(func.count(Article.id))  # pyright: ignore[reportArgumentType]
        .where(Article.scoring_state == "scored")
        .where(Article.composite_score == 0)
    ).one()
    counts["blocked"] = blocked_count

    activity = get_scoring_activity()
    counts["current_article_id"] = activity["article_id"]
    counts["phase"] = activity["phase"]

    categorization_runtime = await evaluate_task_readiness(session, TASK_CATEGORIZATION)
    scoring_runtime = await evaluate_task_readiness(session, TASK_SCORING)

    counts["categorization_ready"] = categorization_runtime.ready
    counts["categorization_ready_reason"] = format_readiness_reason(
        categorization_runtime
    )
    counts["score_ready"] = scoring_runtime.ready
    counts["score_ready_reason"] = format_readiness_reason(scoring_runtime)

    counts["scoring_ready"] = categorization_runtime.ready and scoring_runtime.ready
    counts["scoring_ready_reason"] = (
        None
        if counts["scoring_ready"]
        else (counts["categorization_ready_reason"] or counts["score_ready_reason"])
    )

    # Overlay rate-limit state — takes precedence when providers are otherwise ready
    if counts["scoring_ready"] and is_rate_limited():
        counts["scoring_ready"] = False
        counts["scoring_ready_reason"] = (
            "Scoring paused \u2014 API rate limit reached. Will retry automatically."
        )
        counts["rate_limit_retry_after"] = round(get_rate_limit_remaining())
    else:
        counts["rate_limit_retry_after"] = None

    return counts
