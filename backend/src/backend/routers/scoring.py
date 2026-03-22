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
    from backend.scheduler import categorization_worker

    queued = categorization_worker.enqueue_recent_for_rescoring(
        session, score_only=False
    )
    return {"ok": True, "rescore_queued": queued}


@router.get("/status")
async def get_scoring_status(
    session: Session = Depends(get_session),
):
    """Get counts of articles by scoring state, plus live activity and readiness."""
    from backend.scoring import (
        get_categorization_activity,
        get_categorization_rate_limit_remaining,
        get_scoring_activity,
        get_scoring_rate_limit_remaining,
        is_categorization_rate_limited,
        is_scoring_rate_limited,
    )

    # GROUP BY scoring_state
    state_rows = session.exec(
        select(Article.scoring_state, func.count(Article.id)).group_by(  # pyright: ignore[reportArgumentType]
            Article.scoring_state
        )
    ).all()

    scoring_counts: dict[str, int] = {}
    for state, count in state_rows:
        scoring_counts[state] = count

    counts: dict = {
        "unscored": scoring_counts.get("unscored", 0),
        "queued": scoring_counts.get("queued", 0),
        "scoring": scoring_counts.get("scoring", 0),
        "scored": scoring_counts.get("scored", 0),
        "failed": scoring_counts.get("failed", 0),
    }

    # GROUP BY categorization_state
    cat_state_rows = session.exec(
        select(Article.categorization_state, func.count(Article.id)).group_by(  # pyright: ignore[reportArgumentType]
            Article.categorization_state
        )
    ).all()

    cat_counts: dict[str, int] = {}
    for state, count in cat_state_rows:
        cat_counts[state] = count

    # Failed combines both pipelines
    counts["failed"] = scoring_counts.get("failed", 0) + cat_counts.get("failed", 0)

    # Separate query for blocked (scored articles with composite_score == 0)
    blocked_count = session.exec(
        select(func.count(Article.id))  # pyright: ignore[reportArgumentType]
        .where(Article.scoring_state == "scored")
        .where(Article.composite_score == 0)
    ).one()
    counts["blocked"] = blocked_count

    # Top-level phase derivation (backward compat)
    cat_activity = get_categorization_activity()
    score_activity = get_scoring_activity()
    if cat_activity["phase"] != "idle":
        counts["phase"] = cat_activity["phase"]
        counts["current_article_id"] = cat_activity["article_id"]
    elif score_activity["phase"] != "idle":
        counts["phase"] = score_activity["phase"]
        counts["current_article_id"] = score_activity["article_id"]
    else:
        counts["phase"] = "idle"
        counts["current_article_id"] = None

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

    # Per-worker detail
    counts["categorization"] = {
        "uncategorized": cat_counts.get("uncategorized", 0),
        "queued": cat_counts.get("queued", 0),
        "categorizing": cat_counts.get("categorizing", 0),
        "categorized": cat_counts.get("categorized", 0),
        "failed": cat_counts.get("failed", 0),
        "ready": categorization_runtime.ready,
        "ready_reason": format_readiness_reason(categorization_runtime),
        "phase": cat_activity["phase"],
        "rate_limit_retry_after": round(get_categorization_rate_limit_remaining())
        if is_categorization_rate_limited()
        else None,
    }
    counts["scoring_worker"] = {
        "ready": scoring_runtime.ready,
        "ready_reason": format_readiness_reason(scoring_runtime),
        "phase": score_activity["phase"],
        "rate_limit_retry_after": round(get_scoring_rate_limit_remaining())
        if is_scoring_rate_limited()
        else None,
    }

    # Overlay rate-limit state — takes precedence when providers are otherwise ready
    if counts["scoring_ready"] and (
        is_categorization_rate_limited() or is_scoring_rate_limited()
    ):
        counts["scoring_ready"] = False
        counts["scoring_ready_reason"] = (
            "Scoring paused \u2014 API rate limit reached. Will retry automatically."
        )
        counts["rate_limit_retry_after"] = round(
            max(
                get_categorization_rate_limit_remaining(),
                get_scoring_rate_limit_remaining(),
            )
        )
    else:
        counts["rate_limit_retry_after"] = None

    return counts
