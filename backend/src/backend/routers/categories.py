"""Category CRUD, batch, and merge endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from slugify import slugify
from sqlmodel import Session, func, select

from backend.database import smart_case
from backend.deps import get_session
from backend.models import ArticleCategoryLink, Category
from backend.schemas import (
    CategoryAcknowledgeRequest,
    CategoryBatchAction,
    CategoryBatchMove,
    CategoryCreateRequest,
    CategoryMerge,
    CategoryResponse,
    CategoryUpdate,
)

VALID_WEIGHTS = {"block", "reduce", "normal", "boost", "max"}

router = APIRouter(prefix="/api/categories", tags=["categories"])


def _category_article_count(session: Session, category_id: int) -> int:
    """Get article count for a category via junction table."""
    return session.exec(
        select(func.count(ArticleCategoryLink.article_id))
        .where(ArticleCategoryLink.category_id == category_id)
    ).one()


def _category_to_response(session: Session, category: Category) -> CategoryResponse:
    """Convert a Category model to a CategoryResponse with article_count."""
    return CategoryResponse(
        id=category.id,
        display_name=category.display_name,
        slug=category.slug,
        weight=category.weight,
        parent_id=category.parent_id,
        is_hidden=category.is_hidden,
        is_seen=category.is_seen,
        is_manually_created=category.is_manually_created,
        article_count=_category_article_count(session, category.id),
    )


@router.get("", response_model=list[CategoryResponse])
def list_categories(
    session: Session = Depends(get_session),
):
    """Get flat list of all categories with article counts."""
    statement = (
        select(Category, func.count(ArticleCategoryLink.article_id).label("article_count"))
        .outerjoin(ArticleCategoryLink, Category.id == ArticleCategoryLink.category_id)
        .group_by(Category.id)
        .order_by(Category.display_name)
    )
    results = session.exec(statement).all()

    return [
        CategoryResponse(
            id=cat.id,
            display_name=cat.display_name,
            slug=cat.slug,
            weight=cat.weight,
            parent_id=cat.parent_id,
            is_hidden=cat.is_hidden,
            is_seen=cat.is_seen,
            is_manually_created=cat.is_manually_created,
            article_count=count,
        )
        for cat, count in results
    ]


@router.post("", response_model=CategoryResponse, status_code=201)
def create_category(
    body: CategoryCreateRequest,
    session: Session = Depends(get_session),
):
    """Create a new category with display_name and optional parent_id."""
    slug = slugify(body.display_name)
    if not slug:
        raise HTTPException(status_code=400, detail="Invalid category name")

    existing = session.exec(select(Category).where(Category.slug == slug)).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Category '{body.display_name}' already exists",
        )

    if body.parent_id is not None:
        parent = session.get(Category, body.parent_id)
        if not parent:
            raise HTTPException(status_code=404, detail="Parent category not found")

    category = Category(
        display_name=smart_case(body.display_name),
        slug=slug,
        parent_id=body.parent_id,
        is_manually_created=True,
        is_seen=True,
    )
    session.add(category)
    session.commit()
    session.refresh(category)

    return CategoryResponse(
        id=category.id,
        display_name=category.display_name,
        slug=category.slug,
        weight=category.weight,
        parent_id=category.parent_id,
        is_hidden=category.is_hidden,
        is_seen=category.is_seen,
        is_manually_created=category.is_manually_created,
        article_count=0,
    )


@router.get("/unseen-count")
def get_unseen_count(
    session: Session = Depends(get_session),
):
    """Get count of unseen, non-hidden categories (for badges)."""
    count = session.exec(
        select(func.count(Category.id))
        .where(Category.is_seen.is_(False))
        .where(Category.is_hidden.is_(False))
    ).one()

    return {"count": count}


@router.post("/mark-seen")
def mark_seen(
    body: CategoryAcknowledgeRequest,
    session: Session = Depends(get_session),
):
    """Mark categories as seen by ID."""
    for cat_id in body.category_ids:
        category = session.get(Category, cat_id)
        if category:
            category.is_seen = True
            session.add(category)

    session.commit()

    return {"ok": True}


@router.post("/merge")
def merge_categories(
    body: CategoryMerge,
    session: Session = Depends(get_session),
):
    """Merge source category into target. Moves article associations, reparents children, deletes source."""
    if body.source_id == body.target_id:
        raise HTTPException(status_code=400, detail="Source and target must be different")

    source = session.get(Category, body.source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Source category not found")

    target = session.get(Category, body.target_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target category not found")

    source_links = session.exec(
        select(ArticleCategoryLink).where(ArticleCategoryLink.category_id == body.source_id)
    ).all()

    articles_moved = 0
    for link in source_links:
        existing = session.exec(
            select(ArticleCategoryLink)
            .where(ArticleCategoryLink.article_id == link.article_id)
            .where(ArticleCategoryLink.category_id == body.target_id)
        ).first()
        if existing:
            session.delete(link)
        else:
            session.delete(link)
            new_link = ArticleCategoryLink(
                article_id=link.article_id,
                category_id=body.target_id,
            )
            session.add(new_link)
        articles_moved += 1

    source_children = session.exec(
        select(Category).where(Category.parent_id == body.source_id)
    ).all()
    for child in source_children:
        child.parent_id = body.target_id
        session.add(child)

    session.delete(source)
    session.commit()

    return {"ok": True, "articles_moved": articles_moved}


@router.post("/batch-move")
def batch_move_categories(
    body: CategoryBatchMove,
    session: Session = Depends(get_session),
):
    """Move multiple categories to a new parent, or ungroup them (target_parent_id=-1)."""
    updated = 0

    if body.target_parent_id == -1:
        for cat_id in body.category_ids:
            category = session.get(Category, cat_id)
            if not category:
                continue
            if category.weight is None and category.parent_id is not None:
                parent = session.get(Category, category.parent_id)
                if parent and parent.weight is not None:
                    category.weight = parent.weight
            category.parent_id = None
            session.add(category)
            updated += 1
    else:
        target = session.get(Category, body.target_parent_id)
        if not target:
            raise HTTPException(status_code=404, detail="Target parent not found")
        if target.parent_id is not None:
            raise HTTPException(
                status_code=400,
                detail="Target must be a root category (no parent)",
            )
        for cat_id in body.category_ids:
            category = session.get(Category, cat_id)
            if not category:
                continue
            children = session.exec(
                select(Category).where(Category.parent_id == cat_id)
            ).all()
            if children:
                raise HTTPException(
                    status_code=400,
                    detail=f"Category '{category.display_name}' has children and cannot be nested under another parent",
                )
            category.parent_id = body.target_parent_id
            session.add(category)
            updated += 1

    session.commit()
    return {"ok": True, "updated": updated}


@router.post("/batch-hide")
def batch_hide_categories(
    body: CategoryBatchAction,
    session: Session = Depends(get_session),
):
    """Hide multiple categories. Sets is_hidden=True and clears parent_id."""
    updated = 0
    for cat_id in body.category_ids:
        category = session.get(Category, cat_id)
        if not category:
            continue
        category.is_hidden = True
        category.parent_id = None
        session.add(category)
        updated += 1

    session.commit()
    return {"ok": True, "updated": updated}


@router.post("/batch-delete")
def batch_delete_categories(
    body: CategoryBatchAction,
    session: Session = Depends(get_session),
):
    """Delete multiple categories. Releases children to root, deletes article links."""
    from sqlalchemy import delete as sa_delete

    deleted = 0
    for cat_id in body.category_ids:
        category = session.get(Category, cat_id)
        if not category:
            continue
        children = session.exec(
            select(Category).where(Category.parent_id == cat_id)
        ).all()
        for child in children:
            if child.weight is None and category.weight is not None:
                child.weight = category.weight
            child.parent_id = None
            session.add(child)
        session.exec(
            sa_delete(ArticleCategoryLink).where(
                ArticleCategoryLink.category_id == cat_id
            )
        )
        session.delete(category)
        deleted += 1

    session.commit()
    return {"ok": True, "deleted": deleted}


@router.patch("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: int,
    body: CategoryUpdate,
    session: Session = Depends(get_session),
):
    """Update a category (rename, reparent, weight change, hide/unhide, etc.)."""
    category = session.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    if body.display_name is not None:
        new_slug = slugify(body.display_name)
        if not new_slug:
            raise HTTPException(status_code=400, detail="Invalid category name")
        existing = session.exec(
            select(Category).where(Category.slug == new_slug).where(Category.id != category_id)
        ).first()
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"Category '{body.display_name}' already exists",
            )
        category.display_name = smart_case(body.display_name)
        category.slug = new_slug

    if body.parent_id is not None:
        if body.parent_id == -1:
            category.parent_id = None
        else:
            if body.parent_id == category_id:
                raise HTTPException(status_code=400, detail="Category cannot be its own parent")
            child_ids = {c.id for c in (category.children or [])}
            if body.parent_id in child_ids:
                raise HTTPException(status_code=400, detail="Cannot parent to own child")
            parent = session.get(Category, body.parent_id)
            if not parent:
                raise HTTPException(status_code=404, detail="Parent category not found")
            category.parent_id = body.parent_id
    elif body.model_fields_set and "parent_id" in body.model_fields_set:
        category.parent_id = None

    if body.weight is not None:
        if body.weight == "inherit":
            category.weight = None
        elif body.weight not in VALID_WEIGHTS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid weight '{body.weight}'. Must be one of: {', '.join(VALID_WEIGHTS)} or 'inherit'",
            )
        else:
            category.weight = body.weight

    if body.is_hidden is not None:
        category.is_hidden = body.is_hidden
        if body.is_hidden:
            # Hide: leave group (clear parent_id)
            category.parent_id = None
        else:
            # Unhide: reset block weight to inherit
            if category.weight == "block":
                category.weight = None

    if body.is_seen is not None:
        category.is_seen = body.is_seen

    session.add(category)
    session.commit()
    session.refresh(category)

    return _category_to_response(session, category)


@router.delete("/{category_id}")
def delete_category(
    category_id: int,
    session: Session = Depends(get_session),
):
    """Delete a category. Children are released to root."""
    category = session.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    children = session.exec(
        select(Category).where(Category.parent_id == category_id)
    ).all()
    for child in children:
        child.parent_id = None
        session.add(child)

    from sqlalchemy import delete as sa_delete
    session.exec(sa_delete(ArticleCategoryLink).where(ArticleCategoryLink.category_id == category_id))

    session.delete(category)
    session.commit()

    return {"ok": True}


@router.post("/{category_id}/ungroup")
def ungroup_parent(
    category_id: int,
    session: Session = Depends(get_session),
):
    """Ungroup a parent category: release all children to root, preserving inherited weights."""
    parent = session.get(Category, category_id)
    if not parent:
        raise HTTPException(status_code=404, detail="Category not found")

    children = session.exec(
        select(Category).where(Category.parent_id == category_id)
    ).all()

    for child in children:
        if child.weight is None and parent.weight is not None:
            child.weight = parent.weight
        child.parent_id = None
        session.add(child)

    session.commit()
    return {"ok": True, "children_ungrouped": len(children)}
