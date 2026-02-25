"""Integration tests for feed folder endpoints and folder-aware feed/article behavior."""

from datetime import datetime

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from backend.models import Article, Feed, FeedFolder


def _create_feed(
    session: Session,
    *,
    title: str,
    url: str,
    display_order: int,
    folder_id: int | None = None,
) -> Feed:
    feed = Feed(
        title=title,
        url=url,
        display_order=display_order,
        last_fetched_at=datetime.now(),
        folder_id=folder_id,
    )
    session.add(feed)
    session.commit()
    session.refresh(feed)
    return feed


def _create_article(
    session: Session,
    *,
    feed_id: int,
    title: str,
    url: str,
    is_read: bool = False,
    scoring_state: str = "scored",
    composite_score: float = 1.0,
) -> Article:
    article = Article(
        feed_id=feed_id,
        title=title,
        url=url,
        is_read=is_read,
        scoring_state=scoring_state,
        composite_score=composite_score,
        published_at=datetime.now(),
    )
    session.add(article)
    session.commit()
    session.refresh(article)
    return article


def test_create_folder_enforces_case_insensitive_name_uniqueness(
    test_client: TestClient,
):
    response = test_client.post(
        "/api/feed-folders",
        json={"name": "Programming", "feed_ids": []},
    )
    assert response.status_code == 201

    duplicate_response = test_client.post(
        "/api/feed-folders",
        json={"name": "programming", "feed_ids": []},
    )
    assert duplicate_response.status_code == 409


def test_create_folder_assigns_selected_ungrouped_feeds(
    test_client: TestClient,
    test_session: Session,
):
    feed_one = _create_feed(
        test_session,
        title="Feed One",
        url="https://example.com/feed-one.xml",
        display_order=5,
    )
    feed_two = _create_feed(
        test_session,
        title="Feed Two",
        url="https://example.com/feed-two.xml",
        display_order=2,
    )

    response = test_client.post(
        "/api/feed-folders",
        json={"name": "Engineering", "feed_ids": [feed_one.id, feed_two.id]},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Engineering"
    folder_id = data["id"]

    test_session.expire_all()
    refreshed_one = test_session.get(Feed, feed_one.id)
    refreshed_two = test_session.get(Feed, feed_two.id)
    assert refreshed_one.folder_id == folder_id
    assert refreshed_two.folder_id == folder_id

    # Assigned feeds are normalized to contiguous order in the target folder.
    assert {refreshed_one.display_order, refreshed_two.display_order} == {0, 1}


def test_create_folder_with_grouped_feed_fails_atomically(
    test_client: TestClient,
    test_session: Session,
):
    existing_folder = FeedFolder(name="Existing", display_order=0)
    test_session.add(existing_folder)
    test_session.commit()
    test_session.refresh(existing_folder)

    already_grouped = _create_feed(
        test_session,
        title="Grouped",
        url="https://example.com/grouped.xml",
        display_order=0,
        folder_id=existing_folder.id,
    )
    still_ungrouped = _create_feed(
        test_session,
        title="Ungrouped",
        url="https://example.com/ungrouped.xml",
        display_order=1,
    )

    response = test_client.post(
        "/api/feed-folders",
        json={
            "name": "New Folder",
            "feed_ids": [already_grouped.id, still_ungrouped.id],
        },
    )

    assert response.status_code == 409

    maybe_created = test_session.exec(
        select(FeedFolder).where(FeedFolder.name == "New Folder")
    ).first()
    assert maybe_created is None

    refreshed_ungrouped = test_session.get(Feed, still_ungrouped.id)
    assert refreshed_ungrouped.folder_id is None


def test_delete_folder_defaults_to_ungrouping_feeds(
    test_client: TestClient,
    test_session: Session,
):
    folder = FeedFolder(name="Tech", display_order=0)
    test_session.add(folder)
    test_session.commit()
    test_session.refresh(folder)

    root_feed = _create_feed(
        test_session,
        title="Root",
        url="https://example.com/root.xml",
        display_order=3,
    )
    folder_feed_one = _create_feed(
        test_session,
        title="Folder A",
        url="https://example.com/folder-a.xml",
        display_order=0,
        folder_id=folder.id,
    )
    folder_feed_two = _create_feed(
        test_session,
        title="Folder B",
        url="https://example.com/folder-b.xml",
        display_order=1,
        folder_id=folder.id,
    )

    response = test_client.delete(f"/api/feed-folders/{folder.id}")
    assert response.status_code == 200

    folder_id = folder.id
    test_session.expire_all()
    assert test_session.get(FeedFolder, folder_id) is None

    refreshed_root = test_session.get(Feed, root_feed.id)
    refreshed_one = test_session.get(Feed, folder_feed_one.id)
    refreshed_two = test_session.get(Feed, folder_feed_two.id)

    assert refreshed_root.folder_id is None
    assert refreshed_one.folder_id is None
    assert refreshed_two.folder_id is None
    assert refreshed_one.display_order > refreshed_root.display_order
    assert refreshed_two.display_order > refreshed_root.display_order


def test_delete_folder_with_delete_feeds_removes_feeds_and_articles(
    test_client: TestClient,
    test_session: Session,
):
    folder = FeedFolder(name="Delete Me", display_order=0)
    test_session.add(folder)
    test_session.commit()
    test_session.refresh(folder)

    feed = _create_feed(
        test_session,
        title="Delete Feed",
        url="https://example.com/delete-feed.xml",
        display_order=0,
        folder_id=folder.id,
    )
    article = _create_article(
        test_session,
        feed_id=feed.id,
        title="Delete Article",
        url="https://example.com/delete-article",
    )
    folder_id = folder.id
    feed_id = feed.id
    article_id = article.id

    response = test_client.delete(f"/api/feed-folders/{folder.id}?delete_feeds=true")
    assert response.status_code == 200

    test_session.expire_all()
    assert test_session.get(FeedFolder, folder_id) is None
    assert test_session.get(Feed, feed_id) is None
    assert test_session.get(Article, article_id) is None


def test_reorder_feeds_rejects_mixed_folder_payload(
    test_client: TestClient,
    test_session: Session,
):
    folder = FeedFolder(name="Scoped", display_order=0)
    test_session.add(folder)
    test_session.commit()
    test_session.refresh(folder)

    folder_feed = _create_feed(
        test_session,
        title="Folder Feed",
        url="https://example.com/folder-scope.xml",
        display_order=0,
        folder_id=folder.id,
    )
    root_feed = _create_feed(
        test_session,
        title="Root Feed",
        url="https://example.com/root-scope.xml",
        display_order=0,
    )

    response = test_client.put(
        "/api/feeds/order",
        json={"feed_ids": [folder_feed.id, root_feed.id], "folder_id": folder.id},
    )
    assert response.status_code == 400


def test_articles_can_be_filtered_by_folder(
    test_client: TestClient,
    test_session: Session,
):
    folder = FeedFolder(name="Filter Folder", display_order=0)
    test_session.add(folder)
    test_session.commit()
    test_session.refresh(folder)

    folder_feed = _create_feed(
        test_session,
        title="Folder Feed",
        url="https://example.com/filter-folder.xml",
        display_order=0,
        folder_id=folder.id,
    )
    root_feed = _create_feed(
        test_session,
        title="Root Feed",
        url="https://example.com/filter-root.xml",
        display_order=0,
    )

    folder_article = _create_article(
        test_session,
        feed_id=folder_feed.id,
        title="Folder Article",
        url="https://example.com/folder-article",
    )
    _create_article(
        test_session,
        feed_id=root_feed.id,
        title="Root Article",
        url="https://example.com/root-article",
    )

    response = test_client.get(
        f"/api/articles?folder_id={folder.id}&exclude_blocked=false"
    )
    assert response.status_code == 200

    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == folder_article.id
    assert data[0]["feed_id"] == folder_feed.id
