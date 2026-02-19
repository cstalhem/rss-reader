"""Scoring status and trigger endpoints."""

from fastapi import APIRouter, Depends
from sqlmodel import Session, func, select

from backend.deps import get_session
from backend.models import Article

router = APIRouter(prefix="/api/scoring", tags=["scoring"])


@router.post("")
async def trigger_rescore(
    session: Session = Depends(get_session),
):
    """Manually trigger re-scoring of recent unread articles."""
    from backend.scheduler import scoring_queue

    queued = scoring_queue.enqueue_recent_for_rescoring(session)
    return {"queued": queued}


@router.get("/status")
def get_scoring_status(
    session: Session = Depends(get_session),
):
    """Get counts of articles by scoring state, plus live activity phase."""
    from backend.scoring import get_scoring_activity

    states = ["unscored", "queued", "scoring", "scored", "failed"]
    counts = {}

    for state in states:
        count = session.exec(
            select(func.count(Article.id)).where(Article.scoring_state == state)
        ).one()
        counts[state] = count

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
