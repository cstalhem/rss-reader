"""Feed folder CRUD and ordering endpoints."""

import unicodedata

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, func, select

from backend.deps import get_session
from backend.models import Article, Feed, FeedFolder
from backend.schemas import (
    FeedFolderCreate,
    FeedFolderReorder,
    FeedFolderResponse,
    FeedFolderUpdate,
)

router = APIRouter(prefix="/api/feed-folders", tags=["feed-folders"])


def _normalize_folder_name(name: str) -> tuple[str, str]:
    cleaned = unicodedata.normalize("NFKC", name).strip()
    return cleaned, cleaned.casefold()


def _folder_to_response(folder: FeedFolder, unread_count: int) -> FeedFolderResponse:
    return FeedFolderResponse(
        id=folder.id,
        name=folder.name,
        display_order=folder.display_order,
        created_at=folder.created_at,
        unread_count=unread_count,
    )


def _folder_unread_count(session: Session, folder_id: int) -> int:
    return session.exec(
        select(func.count(Article.id))
        .join(Feed, Feed.id == Article.feed_id)
        .where(Feed.folder_id == folder_id)
        .where(Article.is_read.is_(False))
        .where(Article.scoring_state == "scored")
        .where(Article.composite_score > 0)
    ).one()


@router.get("", response_model=list[FeedFolderResponse])
def list_feed_folders(
    session: Session = Depends(get_session),
):
    """List all feed folders with aggregate unread counts."""
    statement = (
        select(
            FeedFolder,
            func.count(Article.id).label("unread_count"),
        )
        .outerjoin(Feed, Feed.folder_id == FeedFolder.id)
        .outerjoin(
            Article,
            (Article.feed_id == Feed.id)
            & (Article.is_read.is_(False))
            & (Article.scoring_state == "scored")
            & (Article.composite_score > 0),
        )
        .group_by(FeedFolder.id)
        .order_by(FeedFolder.display_order, FeedFolder.id)
    )
    results = session.exec(statement).all()

    return [
        _folder_to_response(folder, unread_count) for folder, unread_count in results
    ]


@router.post("", response_model=FeedFolderResponse, status_code=201)
def create_feed_folder(
    payload: FeedFolderCreate,
    session: Session = Depends(get_session),
):
    """Create a folder and optionally assign ungrouped feeds in one transaction."""
    cleaned_name, normalized_name = _normalize_folder_name(payload.name)
    if not cleaned_name:
        raise HTTPException(status_code=400, detail="Folder name is required")

    existing_folder = session.exec(
        select(FeedFolder).where(func.lower(FeedFolder.name) == normalized_name)
    ).first()
    if existing_folder:
        raise HTTPException(status_code=409, detail="Folder name already exists")

    feed_ids = list(dict.fromkeys(payload.feed_ids))

    selected_feeds: list[Feed] = []
    if feed_ids:
        selected_feeds = session.exec(select(Feed).where(Feed.id.in_(feed_ids))).all()
        if len(selected_feeds) != len(feed_ids):
            raise HTTPException(
                status_code=404, detail="One or more feeds were not found"
            )

        grouped_ids = [feed.id for feed in selected_feeds if feed.folder_id is not None]
        if grouped_ids:
            raise HTTPException(
                status_code=409,
                detail="Selected feeds must be ungrouped before folder creation",
            )

    max_order = session.exec(select(func.max(FeedFolder.display_order))).one()
    next_order = (max_order or 0) + 1

    folder = FeedFolder(name=cleaned_name, display_order=next_order)
    session.add(folder)

    try:
        session.flush()

        if selected_feeds:
            selected_by_order = sorted(
                selected_feeds,
                key=lambda feed: (feed.display_order, feed.id),
            )
            for index, feed in enumerate(selected_by_order):
                feed.folder_id = folder.id
                feed.display_order = index
                session.add(feed)

        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(
            status_code=409, detail="Folder name already exists"
        ) from exc

    session.refresh(folder)

    return _folder_to_response(folder, _folder_unread_count(session, folder.id))


@router.patch("/{folder_id}", response_model=FeedFolderResponse)
def update_feed_folder(
    folder_id: int,
    payload: FeedFolderUpdate,
    session: Session = Depends(get_session),
):
    """Rename and/or reorder a folder."""
    folder = session.get(FeedFolder, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    if "name" in payload.model_fields_set and payload.name is not None:
        cleaned_name, normalized_name = _normalize_folder_name(payload.name)
        if not cleaned_name:
            raise HTTPException(status_code=400, detail="Folder name is required")

        existing_folder = session.exec(
            select(FeedFolder).where(
                func.lower(FeedFolder.name) == normalized_name,
                FeedFolder.id != folder_id,
            )
        ).first()
        if existing_folder:
            raise HTTPException(status_code=409, detail="Folder name already exists")

        folder.name = cleaned_name

    if payload.display_order is not None:
        folder.display_order = payload.display_order

    session.add(folder)

    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(
            status_code=409, detail="Folder name already exists"
        ) from exc

    session.refresh(folder)
    return _folder_to_response(folder, _folder_unread_count(session, folder.id))


@router.put("/order")
def reorder_feed_folders(
    payload: FeedFolderReorder,
    session: Session = Depends(get_session),
):
    """Reorder folders by display order."""
    if len(payload.folder_ids) != len(set(payload.folder_ids)):
        raise HTTPException(
            status_code=400, detail="Duplicate folder IDs are not allowed"
        )

    existing_folder_ids = set(session.exec(select(FeedFolder.id)).all())
    requested_folder_ids = set(payload.folder_ids)

    if requested_folder_ids != existing_folder_ids:
        raise HTTPException(
            status_code=400,
            detail="Folder reorder must include all folders exactly once",
        )

    for index, folder_id in enumerate(payload.folder_ids):
        folder = session.get(FeedFolder, folder_id)
        if folder is not None:
            folder.display_order = index
            session.add(folder)

    session.commit()
    return {"ok": True}


@router.delete("/{folder_id}")
def delete_feed_folder(
    folder_id: int,
    delete_feeds: bool = Query(default=False),
    session: Session = Depends(get_session),
):
    """Delete a folder and either ungroup or delete member feeds."""
    folder = session.get(FeedFolder, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    feeds_in_folder = session.exec(
        select(Feed)
        .where(Feed.folder_id == folder_id)
        .order_by(Feed.display_order, Feed.id)
    ).all()

    if delete_feeds:
        feed_ids = [feed.id for feed in feeds_in_folder]
        if feed_ids:
            session.exec(delete(Article).where(Article.feed_id.in_(feed_ids)))
        for feed in feeds_in_folder:
            session.delete(feed)
    else:
        max_root_order = session.exec(
            select(func.max(Feed.display_order)).where(Feed.folder_id.is_(None))
        ).one()
        next_root_order = (max_root_order or 0) + 1

        for feed in feeds_in_folder:
            feed.folder_id = None
            feed.display_order = next_root_order
            next_root_order += 1
            session.add(feed)

    session.delete(folder)
    session.commit()

    return {
        "ok": True,
        "feeds_affected": len(feeds_in_folder),
        "feeds_deleted": delete_feeds,
    }
