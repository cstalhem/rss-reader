"""Scoring status and trigger endpoints."""

from fastapi import APIRouter, Depends
from sqlmodel import Session, func, select

from backend.deps import get_session
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
def get_scoring_status(
    session: Session = Depends(get_session),
):
    """Get counts of articles by scoring state, plus live activity phase."""
    from backend.scoring import get_scoring_activity

    # Single GROUP BY query replaces 5 separate COUNT queries
    state_rows = session.exec(
        select(Article.scoring_state, func.count(Article.id))
        .group_by(Article.scoring_state)
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

    return counts
