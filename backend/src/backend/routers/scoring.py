"""Scoring status and trigger endpoints."""

from fastapi import APIRouter, Depends
from sqlmodel import Session, func, select

from backend.deps import TASK_CATEGORIZATION, TASK_SCORING, get_session
from backend.llm_client import LLMNotConfigured, llm_client
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


def _task_readiness(task: str) -> tuple[bool, str | None]:
    """Task readiness from Azure credentials + config routing."""
    if not llm_client.is_configured():
        return False, (
            "Scoring paused — Azure OpenAI is not configured "
            "(set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY)"
        )
    try:
        llm_client.task_config(task)
    except LLMNotConfigured:
        return False, f"Scoring paused — no deployment configured for task '{task}'"
    return True, None


@router.get("/status")
async def get_scoring_status(
    session: Session = Depends(get_session),
):
    """Get counts of articles by scoring state, plus live activity and readiness."""
    from backend.scoring_queue import get_activity

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
        "blocked": scoring_counts.get("blocked", 0),
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

    # Top-level phase derivation
    cat_activity = get_activity(TASK_CATEGORIZATION)
    score_activity = get_activity(TASK_SCORING)
    if cat_activity.phase != "idle":
        counts["phase"] = cat_activity.phase
        counts["current_article_id"] = cat_activity.article_id
    elif score_activity.phase != "idle":
        counts["phase"] = score_activity.phase
        counts["current_article_id"] = score_activity.article_id
    else:
        counts["phase"] = "idle"
        counts["current_article_id"] = None

    cat_ready, cat_reason = _task_readiness(TASK_CATEGORIZATION)
    score_ready, score_reason = _task_readiness(TASK_SCORING)

    counts["categorization_ready"] = cat_ready
    counts["categorization_ready_reason"] = cat_reason
    counts["score_ready"] = score_ready
    counts["score_ready_reason"] = score_reason

    counts["scoring_ready"] = cat_ready and score_ready
    counts["scoring_ready_reason"] = (
        None if counts["scoring_ready"] else (cat_reason or score_reason)
    )

    # Pause state comes from the wrapper, keyed by deployment (ADR-0004)
    cat_pause = llm_client.pause_remaining_for_task(TASK_CATEGORIZATION)
    score_pause = llm_client.pause_remaining_for_task(TASK_SCORING)

    # Per-worker detail
    counts["categorization"] = {
        "uncategorized": cat_counts.get("uncategorized", 0),
        "queued": cat_counts.get("queued", 0),
        "categorizing": cat_counts.get("categorizing", 0),
        "categorized": cat_counts.get("categorized", 0),
        "failed": cat_counts.get("failed", 0),
        "ready": cat_ready,
        "ready_reason": cat_reason,
        "phase": cat_activity.phase,
        "rate_limit_retry_after": round(cat_pause) if cat_pause > 0 else None,
    }
    counts["scoring_worker"] = {
        "ready": score_ready,
        "ready_reason": score_reason,
        "phase": score_activity.phase,
        "rate_limit_retry_after": round(score_pause) if score_pause > 0 else None,
    }

    # Overlay rate-limit state — takes precedence when tasks are otherwise ready
    if counts["scoring_ready"] and (cat_pause > 0 or score_pause > 0):
        counts["scoring_ready"] = False
        counts["scoring_ready_reason"] = (
            "Scoring paused — API rate limit reached. Will retry automatically."
        )
        counts["rate_limit_retry_after"] = round(max(cat_pause, score_pause))
    else:
        counts["rate_limit_retry_after"] = None

    return counts
