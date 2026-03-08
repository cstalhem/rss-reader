"""Category CRUD, batch, merge, and auto-group endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from slugify import slugify
from sqlmodel import Session, func, select

from backend.database import smart_case
from backend.deps import get_session, resolve_task_runtime
from backend.llm_providers.registry import get_provider
from backend.models import ArticleCategoryLink, Category
from backend.schemas import (
    AutoGroupApplyRequest,
    AutoGroupApplyResponse,
    AutoGroupRequest,
    AutoGroupSuggestResponse,
    CategoryAcknowledgeRequest,
    CategoryBatchAction,
    CategoryBatchMove,
    CategoryCreateRequest,
    CategoryMerge,
    CategoryResponse,
    CategoryUpdate,
    GroupSuggestionItem,
)

VALID_WEIGHTS = {"block", "reduce", "normal", "boost", "max"}

router = APIRouter(prefix="/api/categories", tags=["categories"])


def _category_article_count(session: Session, category_id: int) -> int:
    """Get article count for a category via junction table."""
    return session.exec(
        select(func.count(ArticleCategoryLink.article_id)).where(  # pyright: ignore[reportArgumentType]
            ArticleCategoryLink.category_id == category_id
        )
    ).one()


def _category_to_response(session: Session, category: Category) -> CategoryResponse:
    """Convert a Category model to a CategoryResponse with article_count."""
    return CategoryResponse(
        id=category.id,  # pyright: ignore[reportArgumentType]
        display_name=category.display_name,
        slug=category.slug,
        weight=category.weight,
        parent_id=category.parent_id,
        is_hidden=category.is_hidden,
        is_seen=category.is_seen,
        is_manually_created=category.is_manually_created,
        article_count=_category_article_count(session, category.id),  # pyright: ignore[reportArgumentType]
    )


@router.get("", response_model=list[CategoryResponse])
def list_categories(
    session: Session = Depends(get_session),
):
    """Get flat list of all categories with article counts."""
    statement = (
        select(
            Category,
            func.count(ArticleCategoryLink.article_id).label("article_count"),  # pyright: ignore[reportArgumentType]
        )
        .outerjoin(ArticleCategoryLink, Category.id == ArticleCategoryLink.category_id)  # pyright: ignore[reportArgumentType]
        .group_by(Category.id)  # pyright: ignore[reportArgumentType]
        .order_by(Category.display_name)
    )
    results = session.exec(statement).all()

    return [
        CategoryResponse(
            id=cat.id,  # pyright: ignore[reportArgumentType]
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
        id=category.id,  # pyright: ignore[reportArgumentType]
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
        select(func.count(Category.id))  # pyright: ignore[reportArgumentType]
        .where(Category.is_seen.is_(False))  # pyright: ignore[reportAttributeAccessIssue]
        .where(Category.is_hidden.is_(False))  # pyright: ignore[reportAttributeAccessIssue]
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
        raise HTTPException(
            status_code=400, detail="Source and target must be different"
        )

    source = session.get(Category, body.source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Source category not found")

    target = session.get(Category, body.target_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target category not found")

    source_links = session.exec(
        select(ArticleCategoryLink).where(
            ArticleCategoryLink.category_id == body.source_id
        )
    ).all()

    articles_moved = 0
    for link in source_links:
        existing = session.exec(
            select(ArticleCategoryLink)
            .where(ArticleCategoryLink.article_id == link.article_id)
            .where(ArticleCategoryLink.category_id == body.target_id)
        ).first()
        session.delete(link)
        if not existing:
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
            if cat_id == body.target_parent_id:
                continue
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


@router.post("/auto-group/suggest", response_model=AutoGroupSuggestResponse)
async def auto_group_suggest(
    body: AutoGroupRequest,
    session: Session = Depends(get_session),
):
    """Ask LLM to suggest category groupings. No DB writes."""
    from backend.scoring import get_active_categories

    display_names, hierarchy, _hidden = get_active_categories(session)

    if len(display_names) < 2:
        raise HTTPException(
            status_code=400,
            detail="Need at least 2 non-hidden categories to suggest groupings",
        )

    # Resolve provider/model for categorization task
    runtime = resolve_task_runtime(session, "categorization")
    provider_name = body.provider or runtime.provider
    model_name = body.model or runtime.model

    if not model_name:
        raise HTTPException(status_code=400, detail="No model configured")

    provider = get_provider(provider_name)

    # Determine endpoint — for Ollama we need the endpoint from runtime
    endpoint = runtime.endpoint or ""

    response = await provider.suggest_groups(
        all_categories=display_names,
        existing_groups=hierarchy or {},
        endpoint=endpoint,
        model=model_name,
    )

    # Build slug lookup for validation
    all_categories = session.exec(
        select(Category).where(Category.is_hidden == False)  # noqa: E712
    ).all()
    slug_to_name = {slugify(c.display_name): c.display_name for c in all_categories}
    valid_slugs = set(slug_to_name.keys())

    # Filter groups: drop unknown parent/children, keep groups with ≥1 valid child.
    # Resolve names back to canonical DB display_name via slug_to_name.
    valid_groups = []
    for group in response.groups:
        parent_slug = slugify(group.parent)
        if parent_slug not in valid_slugs:
            continue
        valid_children = [
            slug_to_name[slugify(c)]
            for c in group.children
            if slugify(c) in valid_slugs and slugify(c) != parent_slug
        ]
        if valid_children:
            valid_groups.append(
                GroupSuggestionItem(
                    parent=slug_to_name[parent_slug],
                    children=valid_children,
                )
            )

    return AutoGroupSuggestResponse(groups=valid_groups)


@router.post("/auto-group/apply", response_model=AutoGroupApplyResponse)
def auto_group_apply(
    body: AutoGroupApplyRequest,
    session: Session = Depends(get_session),
):
    """Apply confirmed groupings: flatten existing groups, then apply new ones."""
    # Step 1: Flatten all existing parent-child relationships
    children_with_parents = session.exec(
        select(Category).where(Category.parent_id.isnot(None))  # type: ignore[union-attr]
    ).all()
    for child in children_with_parents:
        # Inherit parent weight if child has no explicit weight
        if child.weight is None and child.parent_id is not None:
            parent = session.get(Category, child.parent_id)
            if parent and parent.weight is not None:
                child.weight = parent.weight
        child.parent_id = None
        session.add(child)
    session.flush()

    # Step 2: Build slug->category lookup
    all_categories = session.exec(select(Category)).all()
    slug_map: dict[str, Category] = {c.slug: c for c in all_categories}

    # Step 3: Apply new groups (first assignment wins for duplicate children)
    groups_applied = 0
    categories_moved = 0
    assigned_slugs: set[str] = set()
    for group in body.groups:
        parent_slug = slugify(group.parent)
        parent_cat = slug_map.get(parent_slug)
        if not parent_cat:
            continue

        moved_in_group = 0
        for child_name in group.children:
            child_slug = slugify(child_name)
            if child_slug in assigned_slugs:
                continue
            child_cat = slug_map.get(child_slug)
            if not child_cat:
                continue
            # Skip self-references
            if child_cat.id == parent_cat.id:
                continue
            child_cat.parent_id = parent_cat.id
            session.add(child_cat)
            assigned_slugs.add(child_slug)
            moved_in_group += 1

        if moved_in_group > 0:
            groups_applied += 1
            categories_moved += moved_in_group

    session.commit()
    return AutoGroupApplyResponse(
        ok=True,
        groups_applied=groups_applied,
        categories_moved=categories_moved,
    )


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
                ArticleCategoryLink.category_id == cat_id  # pyright: ignore[reportArgumentType]
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
            select(Category)
            .where(Category.slug == new_slug)
            .where(Category.id != category_id)
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
                raise HTTPException(
                    status_code=400, detail="Category cannot be its own parent"
                )
            child_ids = {c.id for c in (category.children or [])}
            if body.parent_id in child_ids:
                raise HTTPException(
                    status_code=400, detail="Cannot parent to own child"
                )
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

    session.exec(
        sa_delete(ArticleCategoryLink).where(
            ArticleCategoryLink.category_id == category_id  # pyright: ignore[reportArgumentType]
        )
    )

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
