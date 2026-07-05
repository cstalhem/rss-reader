"""Alias lifecycle side effects on category verbs (ADR-0007).

Rename leaves an alias from the old slug; merge repoints the source's
aliases and leaves one for its own name; delete (single and batch)
leaves a discard alias; explicit create/rename onto an aliased name
erases that alias. Also covers the one-level shelf enforcement gap in
PATCH parent_id.
"""

from sqlmodel import select

from backend.models import ArticleCategoryLink, Category, CategoryAlias
from backend.scoring import resolve_proposal


def _aliases(session) -> list[CategoryAlias]:
    return session.exec(select(CategoryAlias)).all()


def _alias_for(session, slug: str) -> CategoryAlias | None:
    return session.exec(
        select(CategoryAlias).where(CategoryAlias.alias_slug == slug)
    ).first()


# ---------------------------------------------------------------------------
# Rename
# ---------------------------------------------------------------------------


class TestRenameAliases:
    def test_rename_creates_alias_and_old_name_resolves(
        self, test_client, test_session, make_category
    ):
        cat = make_category(display_name="Machine Learning", slug="machine-learning")

        resp = test_client.patch(
            f"/api/categories/{cat.id}", json={"display_name": "AI"}
        )
        assert resp.status_code == 200
        test_session.expire_all()

        alias = _alias_for(test_session, "machine-learning")
        assert alias is not None
        assert alias.target_id == cat.id

        # Alias round-trip: proposing the old name returns the renamed
        # category without creating a new row.
        before = len(test_session.exec(select(Category)).all())
        resolved = resolve_proposal(test_session, "Machine Learning")
        assert resolved is not None
        assert resolved.id == cat.id
        assert resolved.slug == "ai"
        assert len(test_session.exec(select(Category)).all()) == before

    def test_rename_onto_live_name_409_points_at_merge(
        self, test_client, make_category
    ):
        make_category(display_name="AI", slug="ai")
        cat = make_category(display_name="Crypto", slug="crypto")

        resp = test_client.patch(
            f"/api/categories/{cat.id}", json={"display_name": "AI"}
        )
        assert resp.status_code == 409
        assert "merge" in resp.json()["detail"]

    def test_rename_onto_aliased_name_deletes_alias_round_trip(
        self, test_client, test_session, make_category
    ):
        cat = make_category(display_name="AI", slug="ai")

        # A -> B leaves alias ai -> cat
        resp = test_client.patch(
            f"/api/categories/{cat.id}",
            json={"display_name": "Artificial Intelligence"},
        )
        assert resp.status_code == 200
        test_session.expire_all()
        assert _alias_for(test_session, "ai") is not None

        # B -> A: the alias for "ai" is erased (name is live again), a new
        # alias for the vacated slug appears — no UNIQUE violation.
        resp = test_client.patch(
            f"/api/categories/{cat.id}", json={"display_name": "AI"}
        )
        assert resp.status_code == 200
        test_session.expire_all()

        assert _alias_for(test_session, "ai") is None
        back_alias = _alias_for(test_session, "artificial-intelligence")
        assert back_alias is not None
        assert back_alias.target_id == cat.id
        assert len(_aliases(test_session)) == 1

    def test_same_slug_rename_creates_no_alias(
        self, test_client, test_session, make_category
    ):
        cat = make_category(display_name="machine learning", slug="machine-learning")

        resp = test_client.patch(
            f"/api/categories/{cat.id}", json={"display_name": "Machine Learning"}
        )
        assert resp.status_code == 200
        test_session.expire_all()

        assert _aliases(test_session) == []

    def test_rename_old_slug_already_aliased_upserts(
        self, test_client, test_session, make_category
    ):
        # Alias for "crypto" already exists (e.g. old junk pointing nowhere),
        # then a category is renamed *off* the name "Crypto" — the existing
        # alias row is repointed, not duplicated.
        other = make_category(display_name="Finance", slug="finance")
        test_session.add(CategoryAlias(alias_slug="crypto", target_id=other.id))
        test_session.commit()

        cat = make_category(display_name="Crypto", slug="crypto")
        resp = test_client.patch(
            f"/api/categories/{cat.id}", json={"display_name": "Blockchain"}
        )
        assert resp.status_code == 200
        test_session.expire_all()

        alias = _alias_for(test_session, "crypto")
        assert alias is not None
        assert alias.target_id == cat.id
        assert len(_aliases(test_session)) == 1


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------


class TestCreateErasesAlias:
    def test_create_with_previously_aliased_name(self, test_client, test_session):
        test_session.add(CategoryAlias(alias_slug="crypto", target_id=None))
        test_session.commit()

        resp = test_client.post("/api/categories", json={"display_name": "Crypto"})
        assert resp.status_code == 201
        test_session.expire_all()

        assert _alias_for(test_session, "crypto") is None
        created = test_session.exec(
            select(Category).where(Category.slug == "crypto")
        ).first()
        assert created is not None


# ---------------------------------------------------------------------------
# Merge
# ---------------------------------------------------------------------------


class TestMergeAliases:
    def test_merge_full_lifecycle(
        self, test_client, test_session, make_category, make_feed, make_article
    ):
        source = make_category(display_name="Crypto", slug="crypto")
        target = make_category(
            display_name="Finance", slug="finance", weight="boost", needs_triage=False
        )
        child = make_category(
            display_name="Bitcoin", slug="bitcoin", parent_id=source.id
        )
        source_id, target_id, child_id = source.id, target.id, child.id

        # Pre-existing alias pointing at the source must be repointed, not
        # degraded to a discard by ON DELETE SET NULL.
        test_session.add(CategoryAlias(alias_slug="web3", target_id=source.id))
        test_session.commit()

        feed = make_feed()
        a1 = make_article(feed.id)  # only in source -> moved
        a2 = make_article(feed.id)  # in both -> deduped
        test_session.add(ArticleCategoryLink(article_id=a1.id, category_id=source.id))
        test_session.add(ArticleCategoryLink(article_id=a2.id, category_id=source.id))
        test_session.add(ArticleCategoryLink(article_id=a2.id, category_id=target.id))
        test_session.commit()

        resp = test_client.post(
            "/api/categories/merge",
            json={"source_id": source_id, "target_id": target_id},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["ok"] is True
        # a1 moved (link created on target); a2 already on target -> deduped
        assert body["articles_moved"] == 1
        assert body["aliases_repointed"] == 1
        assert body["children_released"] == [
            {"id": child_id, "display_name": "Bitcoin"}
        ]
        test_session.expire_all()

        # Source gone, alias for its name points at the target.
        assert test_session.get(Category, source_id) is None
        source_alias = _alias_for(test_session, "crypto")
        assert source_alias is not None
        assert source_alias.target_id == target_id

        # Pre-existing alias repointed to target (not a discard).
        web3_alias = _alias_for(test_session, "web3")
        assert web3_alias is not None
        assert web3_alias.target_id == target_id

        # Proposal ladder: both old names resolve to the target.
        assert resolve_proposal(test_session, "Crypto").id == target_id
        assert resolve_proposal(test_session, "Web3").id == target_id

        # Children released to root — NOT reparented under the target.
        assert test_session.get(Category, child_id).parent_id is None

        # Articles moved with dedup.
        target_links = test_session.exec(
            select(ArticleCategoryLink).where(
                ArticleCategoryLink.category_id == target_id
            )
        ).all()
        assert sorted(link.article_id for link in target_links) == sorted(
            [a1.id, a2.id]
        )

        # Target itself is never edited.
        refreshed_target = test_session.get(Category, target_id)
        assert refreshed_target.weight == "boost"
        assert refreshed_target.needs_triage is False
        assert refreshed_target.parent_id is None

    def test_merge_upserts_when_source_slug_already_aliased(
        self, test_client, test_session, make_category
    ):
        source = make_category(display_name="Crypto", slug="crypto")
        target = make_category(display_name="Finance", slug="finance")
        test_session.add(CategoryAlias(alias_slug="crypto", target_id=source.id))
        test_session.commit()

        resp = test_client.post(
            "/api/categories/merge",
            json={"source_id": source.id, "target_id": target.id},
        )
        assert resp.status_code == 200
        test_session.expire_all()

        aliases = _aliases(test_session)
        assert len(aliases) == 1
        assert aliases[0].alias_slug == "crypto"
        assert aliases[0].target_id == target.id


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------


class TestDeleteDiscardAliases:
    def test_delete_leaves_discard_alias(
        self, test_client, test_session, make_category
    ):
        cat = make_category(display_name="Junk", slug="junk")

        resp = test_client.delete(f"/api/categories/{cat.id}")
        assert resp.status_code == 200
        test_session.expire_all()

        alias = _alias_for(test_session, "junk")
        assert alias is not None
        assert alias.target_id is None

        # Proposal of the deleted name is discarded — no row created.
        before = len(test_session.exec(select(Category)).all())
        assert resolve_proposal(test_session, "Junk") is None
        assert len(test_session.exec(select(Category)).all()) == before

    def test_batch_delete_leaves_discard_aliases(
        self, test_client, test_session, make_category
    ):
        a = make_category(display_name="Junk A", slug="junk-a")
        b = make_category(display_name="Junk B", slug="junk-b")

        resp = test_client.post(
            "/api/categories/batch-delete", json={"category_ids": [a.id, b.id]}
        )
        assert resp.status_code == 200
        test_session.expire_all()

        for slug in ("junk-a", "junk-b"):
            alias = _alias_for(test_session, slug)
            assert alias is not None
            assert alias.target_id is None


# ---------------------------------------------------------------------------
# PATCH parent_id one-level enforcement
# ---------------------------------------------------------------------------


class TestPatchParentOneLevel:
    def test_parenting_under_non_root_400(self, test_client, make_category):
        root = make_category(display_name="Root", slug="root")
        shelf = make_category(display_name="Shelf", slug="shelf", parent_id=root.id)
        cat = make_category(display_name="Leaf", slug="leaf")

        resp = test_client.patch(
            f"/api/categories/{cat.id}", json={"parent_id": shelf.id}
        )
        assert resp.status_code == 400
        assert "root" in resp.json()["detail"].lower()

    def test_parenting_category_with_children_400(self, test_client, make_category):
        parent = make_category(display_name="Parent", slug="parent")
        make_category(display_name="Kid", slug="kid", parent_id=parent.id)
        new_root = make_category(display_name="New Root", slug="new-root")

        resp = test_client.patch(
            f"/api/categories/{parent.id}", json={"parent_id": new_root.id}
        )
        assert resp.status_code == 400
        assert "children" in resp.json()["detail"]
