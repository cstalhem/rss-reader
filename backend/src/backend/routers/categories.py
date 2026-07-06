"""Category CRUD, batch, merge, and auto-group endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from slugify import slugify
from sqlalchemy.orm import selectinload
from sqlmodel import Session, func, select

from backend.database import smart_case
from backend.deps import TASK_GROUPING, get_session
from backend.llm_client import LLMError, llm_client
from backend.models import (
    Article,
    ArticleCategoryLink,
    Category,
    CategoryAlias,
    Feed,
)
from backend.prompts import GroupingResponse, build_grouping_prompt
from backend.schemas import (
    AutoGroupApplyRequest,
    AutoGroupApplyResponse,
    AutoGroupSuggestResponse,
    CategoryAliasResponse,
    CategoryBatchAction,
    CategoryBulkUpdate,
    CategoryBulkUpdateResponse,
    CategoryCreateRequest,
    CategoryGroupRequest,
    CategoryMerge,
    CategoryMergeResponse,
    CategoryResponse,
    CategoryUpdate,
    GroupSuggestionItem,
    MergeChildReleased,
    TriageSampleArticle,
)
from backend.scoring import (
    categories_for_scoring,
    compute_composite_score,
    should_block,
)
from backend.scoring_queue import CategorizationWorker

router = APIRouter(prefix="/api/categories", tags=["categories"])


def _upsert_alias(session: Session, alias_slug: str, target_id: int | None) -> None:
    """Create or repoint an alias (ADR-0007) without violating the slug UNIQUE."""
    alias = session.exec(
        select(CategoryAlias).where(CategoryAlias.alias_slug == alias_slug)
    ).first()
    if alias:
        alias.target_id = target_id
        session.add(alias)
    else:
        session.add(CategoryAlias(alias_slug=alias_slug, target_id=target_id))


def _delete_alias(session: Session, alias_slug: str) -> None:
    """Erase alias memory for a slug — explicit human act overrides it (ADR-0007)."""
    alias = session.exec(
        select(CategoryAlias).where(CategoryAlias.alias_slug == alias_slug)
    ).first()
    if alias:
        session.delete(alias)


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
        needs_triage=category.needs_triage,
        article_count=_category_article_count(session, category.id),  # pyright: ignore[reportArgumentType]
        created_at=category.created_at,
    )


def _triage_samples_map(
    session: Session, category_ids: list[int], limit: int = 3
) -> dict[int, list[TriageSampleArticle]]:
    """Fetch up to `limit` sample articles for each of the given categories.

    Used as triage evidence (issue #98) — most-recent first. One query for all
    category_ids (avoids the N+1 of a per-category query); grouped and
    truncated in Python. A stable `Article.id` tiebreak after published_at
    keeps ordering deterministic.
    """
    if not category_ids:
        return {}

    rows = session.exec(
        select(
            ArticleCategoryLink.category_id,  # pyright: ignore[reportArgumentType]
            Article.id,
            Article.title,
            Feed.title,
        )
        .join(ArticleCategoryLink, ArticleCategoryLink.article_id == Article.id)  # pyright: ignore[reportArgumentType]
        .join(Feed, Feed.id == Article.feed_id)  # pyright: ignore[reportArgumentType]
        .where(ArticleCategoryLink.category_id.in_(category_ids))  # pyright: ignore[reportAttributeAccessIssue]
        .order_by(
            Article.published_at.desc(),  # pyright: ignore[reportAttributeAccessIssue, reportOptionalMemberAccess]
            Article.id.desc(),  # pyright: ignore[reportAttributeAccessIssue, reportOptionalMemberAccess]
        )
    ).all()

    samples: dict[int, list[TriageSampleArticle]] = {cid: [] for cid in category_ids}
    for cat_id, aid, title, feed_title in rows:
        bucket = samples[cat_id]
        if len(bucket) < limit:
            bucket.append(
                TriageSampleArticle(id=aid, title=title, feed_title=feed_title)  # pyright: ignore[reportArgumentType]
            )
    return samples


def assign_to_parent(
    session: Session, category_ids: list[int], parent_id: int | None
) -> int:
    """Assign the given categories to a parent (or detach when parent_id is None).

    Enforces the ADR-0001 one-level invariant in a single place (shared by the
    grouping endpoint and auto-group/apply):
    - the target must be a root category (no parent),
    - a moved category that has children is rejected (would create two levels),
    - self-parenting is skipped, not an error.

    Returns the number of categories moved. Does not commit.
    """
    if parent_id is not None:
        target = session.get(Category, parent_id)
        if not target:
            raise HTTPException(status_code=404, detail="Target parent not found")
        if target.parent_id is not None:
            raise HTTPException(
                status_code=400,
                detail="Target must be a root category (no parent)",
            )

    moved = 0
    for cat_id in category_ids:
        if parent_id is not None and cat_id == parent_id:
            continue  # skip self-parenting
        category = session.get(Category, cat_id)
        if not category:
            continue
        if parent_id is not None:
            children = session.exec(
                select(Category).where(Category.parent_id == cat_id)
            ).all()
            if children:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Category '{category.display_name}' has children and "
                        "cannot be nested under another parent"
                    ),
                )
        category.parent_id = parent_id
        session.add(category)
        moved += 1
    return moved


def _recompute_for_categories(session: Session, category_ids: list[int]) -> None:
    """Recompute composite_score + scoring_state for already-scored articles
    linked to the given categories, over their STORED interest/quality (ADR-0010).

    No LLM call. interest/quality are preserved (never zeroed). Blocked articles
    that were worker-blocked (interest == quality == 0) are re-queued through the
    normal pipeline on un-block; everything else takes the cheap recompute.
    Reuses the rescue-aware path so rescued articles are never re-blocked.
    """
    if not category_ids:
        return

    article_ids = set(
        session.exec(
            select(ArticleCategoryLink.article_id).where(
                ArticleCategoryLink.category_id.in_(category_ids)  # pyright: ignore[reportAttributeAccessIssue]
            )
        ).all()
    )
    if not article_ids:
        return

    # Batch-fetch the articles and eager-load their categories so the loop
    # below issues no per-article SELECTs (N+1). The whole recompute must stay
    # one transaction: enqueue_single_for_rescoring is called with commit=False
    # so the enclosing endpoint's single commit is the only one.
    articles = session.exec(
        select(Article)
        .where(Article.id.in_(article_ids))  # pyright: ignore[reportAttributeAccessIssue, reportOptionalMemberAccess]
        .options(selectinload(Article.categories_rel))  # pyright: ignore[reportArgumentType]
    ).all()

    worker = CategorizationWorker()
    for article in articles:
        # Only articles that have completed scoring participate — pending/failed
        # ones will be (re)scored by the worker anyway.
        if article.scoring_state not in ("scored", "blocked"):
            continue

        # Worker-blocked (0/0) articles carry no real scores to recompute from —
        # re-enter the normal pipeline (categories already assigned, so score-only).
        if (
            article.scoring_state == "blocked"
            and article.interest_score == 0
            and article.quality_score == 0
        ):
            worker.enqueue_single_for_rescoring(
                session, article, score_only=True, commit=False
            )
            continue

        categories = list(article.categories_rel)
        if should_block(article, categories):
            article.composite_score = 0.0
            article.scoring_state = "blocked"
        else:
            scoring_cats = categories_for_scoring(article, categories)
            article.composite_score = compute_composite_score(
                article.interest_score or 0,
                article.quality_score or 0,
                scoring_cats,
            )
            article.scoring_state = "scored"
        session.add(article)


@router.get("", response_model=list[CategoryResponse])
def list_categories(
    needs_triage: bool | None = None,
    session: Session = Depends(get_session),
):
    """Get flat list of all categories with article counts.

    Optionally filter by triage state (needs_triage=true → the triage list).
    """
    statement = (
        select(
            Category,
            func.count(ArticleCategoryLink.article_id).label("article_count"),  # pyright: ignore[reportArgumentType]
        )
        .outerjoin(ArticleCategoryLink, Category.id == ArticleCategoryLink.category_id)  # pyright: ignore[reportArgumentType]
        .group_by(Category.id)  # pyright: ignore[reportArgumentType]
        .order_by(Category.display_name)
    )
    if needs_triage is not None:
        statement = statement.where(Category.needs_triage == needs_triage)  # pyright: ignore[reportArgumentType]
    results = session.exec(statement).all()

    # The triage list embeds sample articles as evidence (issue #98). Only the
    # triage view pays for the sample query, and it's a single batched query
    # for all triage categories (not one per category).
    embed_samples = needs_triage is True
    samples_by_cat: dict[int, list[TriageSampleArticle]] = (
        _triage_samples_map(session, [cat.id for cat, _ in results])  # pyright: ignore[reportArgumentType]
        if embed_samples
        else {}
    )

    return [
        CategoryResponse(
            id=cat.id,  # pyright: ignore[reportArgumentType]
            display_name=cat.display_name,
            slug=cat.slug,
            weight=cat.weight,
            parent_id=cat.parent_id,
            needs_triage=cat.needs_triage,
            article_count=count,
            created_at=cat.created_at,
            sample_articles=samples_by_cat.get(cat.id, []),  # pyright: ignore[reportArgumentType, reportCallIssue]
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
        if parent.parent_id is not None:
            raise HTTPException(
                status_code=400,
                detail="Target must be a root category (no parent)",
            )

    # Explicit creation overrides remembered discard/redirect (ADR-0007)
    _delete_alias(session, slug)

    # User-created categories never need triage
    category = Category(
        display_name=smart_case(body.display_name),
        slug=slug,
        parent_id=body.parent_id,
    )
    session.add(category)
    session.commit()
    session.refresh(category)

    return _category_to_response(session, category)


@router.patch("", response_model=CategoryBulkUpdateResponse)
def bulk_update_categories(
    body: CategoryBulkUpdate,
    session: Session = Depends(get_session),
):
    """Apply weight and/or triage state to many categories in one transaction.

    Triage gestures compose from this: keep = {needs_triage: false},
    batch-block = {weight: "block", needs_triage: false}. Missing ids are
    skipped and reported, never a failure.
    """
    categories = session.exec(
        select(Category).where(Category.id.in_(body.category_ids))  # pyright: ignore[reportOptionalMemberAccess, reportAttributeAccessIssue]
    ).all()
    missing_ids = sorted(set(body.category_ids) - {c.id for c in categories})

    weight_changed_ids: list[int] = []
    for category in categories:
        if body.weight is not None and category.weight != body.weight.value:
            category.weight = body.weight.value
            weight_changed_ids.append(category.id)  # pyright: ignore[reportArgumentType]
        if body.needs_triage is not None:
            category.needs_triage = body.needs_triage
        session.add(category)
    updated = len(categories)

    # A weight change retroactively rescores already-scored linked articles
    # over their stored interest/quality — no LLM call (ADR-0010).
    session.flush()
    _recompute_for_categories(session, weight_changed_ids)

    session.commit()
    return CategoryBulkUpdateResponse(ok=True, updated=updated, missing_ids=missing_ids)


# Literal path — declared before the /{category_id} routes so it can never
# be shadowed by the path-param match.
@router.get("/aliases", response_model=list[CategoryAliasResponse])
def list_aliases(
    session: Session = Depends(get_session),
):
    """List all alias rows (ADR-0007). NULL target = remembered discard."""
    aliases = session.exec(
        select(CategoryAlias).order_by(CategoryAlias.alias_slug)
    ).all()
    names_by_id = {c.id: c.display_name for c in session.exec(select(Category)).all()}
    return [
        CategoryAliasResponse(
            id=alias.id,  # pyright: ignore[reportArgumentType]
            alias_slug=alias.alias_slug,
            target_id=alias.target_id,
            target_display_name=names_by_id.get(alias.target_id)
            if alias.target_id is not None
            else None,
            created_at=alias.created_at,
        )
        for alias in aliases
    ]


@router.get("/unseen-count")
def get_unseen_count(
    session: Session = Depends(get_session),
):
    """Get count of categories awaiting triage (for badges)."""
    count = session.exec(
        select(func.count(Category.id)).where(  # pyright: ignore[reportArgumentType]
            Category.needs_triage.is_(True)  # pyright: ignore[reportAttributeAccessIssue]
        )
    ).one()

    return {"count": count}


@router.post("/group")
def group_categories(
    body: CategoryGroupRequest,
    session: Session = Depends(get_session),
):
    """Assign categories to a group shelf, or ungroup them (ADR-0009).

    Exactly one mode (schema-enforced): assign to an existing parent, create a
    new parent and assign atomically, or ungroup to root. Groups are
    display-only (ADR-0001) — this endpoint has zero article side-effects.
    """
    if body.ungroup:
        moved = assign_to_parent(session, body.category_ids, None)
    elif body.new_parent_name is not None:
        slug = slugify(body.new_parent_name)
        if not slug:
            raise HTTPException(status_code=400, detail="Invalid category name")
        existing = session.exec(select(Category).where(Category.slug == slug)).first()
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"Category '{body.new_parent_name}' already exists",
            )
        # Explicit creation overrides remembered discard/redirect (ADR-0007)
        _delete_alias(session, slug)
        parent = Category(display_name=smart_case(body.new_parent_name), slug=slug)
        session.add(parent)
        session.flush()  # assign parent.id within the same transaction
        moved = assign_to_parent(session, body.category_ids, parent.id)
    else:
        moved = assign_to_parent(session, body.category_ids, body.target_parent_id)

    session.commit()
    return {"ok": True, "updated": moved}


@router.post("/merge", response_model=CategoryMergeResponse)
def merge_categories(
    body: CategoryMerge,
    session: Session = Depends(get_session),
):
    """Merge source into target: move articles, release children to root, alias the source name."""
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

    # Release children to root — groups are display-only shelves (ADR-0001);
    # the merge survivor's shelf is not the children's shelf.
    source_children = session.exec(
        select(Category).where(Category.parent_id == body.source_id)
    ).all()
    children_released = [
        MergeChildReleased(id=child.id, display_name=child.display_name)  # pyright: ignore[reportArgumentType]
        for child in source_children
    ]
    for child in source_children:
        child.parent_id = None
        session.add(child)

    # Repoint the source's aliases explicitly — relying on ON DELETE SET NULL
    # would silently turn redirects into discards (ADR-0007).
    source_aliases = session.exec(
        select(CategoryAlias).where(CategoryAlias.target_id == body.source_id)
    ).all()
    for alias in source_aliases:
        alias.target_id = body.target_id
        session.add(alias)

    _upsert_alias(session, source.slug, body.target_id)

    session.delete(source)
    session.commit()

    return CategoryMergeResponse(
        ok=True,
        articles_moved=articles_moved,
        children_released=children_released,
        aliases_repointed=len(source_aliases),
    )


@router.post("/auto-group/suggest", response_model=AutoGroupSuggestResponse)
async def auto_group_suggest(
    session: Session = Depends(get_session),
):
    """Ask LLM to suggest category groupings. No DB writes."""
    from backend.scoring import get_active_categories, get_category_hierarchy

    display_names = get_active_categories(session)
    hierarchy = get_category_hierarchy(session)

    if len(display_names) < 2:
        raise HTTPException(
            status_code=400,
            detail="Need at least 2 categories to suggest groupings",
        )

    system_prompt, user_message = build_grouping_prompt(
        all_categories=display_names,
        existing_groups=hierarchy or {},
    )

    try:
        response = await llm_client.complete(
            TASK_GROUPING, system_prompt, user_message, GroupingResponse
        )
    except LLMError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e

    # Build slug lookup for validation
    all_categories = session.exec(select(Category)).all()
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
        child.parent_id = None
        session.add(child)
    session.flush()

    # Step 2: Build slug->category lookup
    all_categories = session.exec(select(Category)).all()
    slug_map: dict[str, Category] = {c.slug: c for c in all_categories}

    # Step 3: Apply new groups (first assignment wins for duplicate children,
    # and for parent-vs-child conflicts — the hierarchy stays one level deep)
    groups_applied = 0
    categories_moved = 0
    assigned_slugs: set[str] = set()
    parent_slugs: set[str] = set()
    for group in body.groups:
        parent_slug = slugify(group.parent)
        parent_cat = slug_map.get(parent_slug)
        if not parent_cat:
            continue
        # A slug already assigned as a child cannot also be a parent
        if parent_slug in assigned_slugs:
            continue

        moved_in_group = 0
        for child_name in group.children:
            child_slug = slugify(child_name)
            if child_slug in assigned_slugs:
                continue
            # A slug already used as a parent keeps its children
            if child_slug in parent_slugs:
                continue
            child_cat = slug_map.get(child_slug)
            if not child_cat:
                continue
            # Skip self-references
            if child_cat.id == parent_cat.id:
                continue
            # Route through the shared helper so the one-level invariant lives
            # in one place. Flatten (step 1) guarantees no grandchildren, so
            # this never rejects.
            moved_in_group += assign_to_parent(
                session,
                [child_cat.id],  # pyright: ignore[reportArgumentType]
                parent_cat.id,
            )
            assigned_slugs.add(child_slug)

        if moved_in_group > 0:
            groups_applied += 1
            categories_moved += moved_in_group
            parent_slugs.add(parent_slug)

    session.commit()
    return AutoGroupApplyResponse(
        ok=True,
        groups_applied=groups_applied,
        categories_moved=categories_moved,
    )


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
            child.parent_id = None
            session.add(child)
        session.exec(
            sa_delete(ArticleCategoryLink).where(
                ArticleCategoryLink.category_id == cat_id  # pyright: ignore[reportArgumentType]
            )
        )
        session.delete(category)
        # Discard alias: removed junk stays dead (ADR-0007)
        _upsert_alias(session, category.slug, None)
        deleted += 1

    session.commit()
    return {"ok": True, "deleted": deleted}


@router.patch("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: int,
    body: CategoryUpdate,
    session: Session = Depends(get_session),
):
    """Update a category (rename, reparent, weight change, triage, etc.)."""
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
                detail=f"Category '{body.display_name}' already exists — use merge instead",
            )
        old_slug = category.slug
        category.display_name = smart_case(body.display_name)
        category.slug = new_slug
        if new_slug != old_slug:
            # The new name is live again — erase remembered alias; leave one
            # for the vacated name (ADR-0007).
            _delete_alias(session, new_slug)
            _upsert_alias(session, old_slug, category_id)

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
            if parent.parent_id is not None:
                raise HTTPException(
                    status_code=400,
                    detail="Target must be a root category (no parent)",
                )
            children = session.exec(
                select(Category).where(Category.parent_id == category_id)
            ).all()
            if children:
                raise HTTPException(
                    status_code=400,
                    detail=f"Category '{category.display_name}' has children and cannot be nested under another parent",
                )
            category.parent_id = body.parent_id
    elif body.model_fields_set and "parent_id" in body.model_fields_set:
        category.parent_id = None

    weight_changed = False
    if body.weight is not None and category.weight != body.weight.value:
        category.weight = body.weight.value
        weight_changed = True

    if body.needs_triage is not None:
        category.needs_triage = body.needs_triage

    session.add(category)

    # A weight change retroactively rescores already-scored linked articles
    # over their stored interest/quality — no LLM call (ADR-0010).
    if weight_changed:
        session.flush()
        _recompute_for_categories(session, [category_id])

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
    # Discard alias: removed junk stays dead (ADR-0007)
    _upsert_alias(session, category.slug, None)
    session.commit()

    return {"ok": True}
