import { describe, it, expect } from "vitest";
import { renderHook, act } from "@/test/utils";
import { useBufferedArticles } from "@/hooks/useBufferedArticles";
import type { ArticleListItem } from "@/lib/types";

function makeArticle(id: number): ArticleListItem {
  return {
    id,
    feed_id: 1,
    title: `Article ${id}`,
    url: `https://example.com/${id}`,
    author: null,
    published_at: null,
    is_read: false,
    categories: null,
    interest_score: null,
    quality_score: null,
    composite_score: null,
    score_reasoning: null,
    summary_preview: null,
    scoring_state: "pending",
    scored_at: null,
  };
}

type HookProps = {
  articles: ArticleListItem[] | undefined;
  isBuffering: boolean;
  resetKey: unknown;
  limit: number;
};

function renderBufferedArticles(initial: HookProps) {
  return renderHook(
    ({ articles, isBuffering, resetKey, limit }: HookProps) =>
      useBufferedArticles(articles, isBuffering, resetKey, limit),
    { initialProps: initial },
  );
}

describe("useBufferedArticles", () => {
  it("passes articles through unchanged when not buffering", () => {
    const articles = [makeArticle(1), makeArticle(2)];
    const { result } = renderBufferedArticles({
      articles,
      isBuffering: false,
      resetKey: 0,
      limit: 50,
    });

    expect(result.current.displayArticles).toEqual(articles);
    expect(result.current.newCount).toBe(0);
  });

  it("snapshots current articles when buffering activates", () => {
    const articles = [makeArticle(1), makeArticle(2)];
    const { result, rerender } = renderBufferedArticles({
      articles,
      isBuffering: false,
      resetKey: 0,
      limit: 50,
    });

    rerender({ articles, isBuffering: true, resetKey: 0, limit: 50 });

    expect(result.current.displayArticles).toEqual(articles);
    expect(result.current.newCount).toBe(0);
  });

  it("counts new articles and excludes them from display while buffering", () => {
    const initial = [makeArticle(1), makeArticle(2)];
    const { result, rerender } = renderBufferedArticles({
      articles: initial,
      isBuffering: false,
      resetKey: 0,
      limit: 50,
    });

    // activate buffering
    rerender({ articles: initial, isBuffering: true, resetKey: 0, limit: 50 });

    // new articles arrive from the server
    const updated = [makeArticle(3), makeArticle(1), makeArticle(2)];
    rerender({ articles: updated, isBuffering: true, resetKey: 0, limit: 50 });

    expect(result.current.newCount).toBe(1);
    expect(result.current.displayArticles?.map((a) => a.id)).toEqual([1, 2]);
  });

  it("preserves server order for buffered articles", () => {
    const initial = [makeArticle(1), makeArticle(2), makeArticle(3)];
    const { result, rerender } = renderBufferedArticles({
      articles: initial,
      isBuffering: false,
      resetKey: 0,
      limit: 50,
    });

    rerender({ articles: initial, isBuffering: true, resetKey: 0, limit: 50 });

    // server reorders existing articles and adds a new one
    const reordered = [
      makeArticle(4),
      makeArticle(3),
      makeArticle(1),
      makeArticle(2),
    ];
    rerender({ articles: reordered, isBuffering: true, resetKey: 0, limit: 50 });

    // display should follow server order (3, 1, 2), not snapshot order (1, 2, 3)
    expect(result.current.displayArticles?.map((a) => a.id)).toEqual([3, 1, 2]);
  });

  it("drops articles that disappear from input while buffering", () => {
    const initial = [makeArticle(1), makeArticle(2), makeArticle(3)];
    const { result, rerender } = renderBufferedArticles({
      articles: initial,
      isBuffering: false,
      resetKey: 0,
      limit: 50,
    });

    rerender({ articles: initial, isBuffering: true, resetKey: 0, limit: 50 });

    // article 2 removed (e.g. marked read and filtered out)
    const reduced = [makeArticle(1), makeArticle(3)];
    rerender({ articles: reduced, isBuffering: true, resetKey: 0, limit: 50 });

    expect(result.current.displayArticles?.map((a) => a.id)).toEqual([1, 3]);
  });

  it("shows all articles and resets newCount after flush", () => {
    const initial = [makeArticle(1)];
    const { result, rerender } = renderBufferedArticles({
      articles: initial,
      isBuffering: false,
      resetKey: 0,
      limit: 50,
    });

    rerender({ articles: initial, isBuffering: true, resetKey: 0, limit: 50 });

    // new articles arrive
    const updated = [makeArticle(2), makeArticle(1)];
    rerender({ articles: updated, isBuffering: true, resetKey: 0, limit: 50 });

    expect(result.current.newCount).toBe(1);

    act(() => {
      result.current.flush();
    });

    expect(result.current.displayArticles?.map((a) => a.id)).toEqual([2, 1]);
    expect(result.current.newCount).toBe(0);
  });

  it("resets snapshot when resetKey changes while buffering", () => {
    const initial = [makeArticle(1)];
    const { result, rerender } = renderBufferedArticles({
      articles: initial,
      isBuffering: false,
      resetKey: "feed-1",
      limit: 50,
    });

    rerender({ articles: initial, isBuffering: true, resetKey: "feed-1", limit: 50 });

    // new article arrives
    const updated = [makeArticle(2), makeArticle(1)];
    rerender({ articles: updated, isBuffering: true, resetKey: "feed-1", limit: 50 });
    expect(result.current.newCount).toBe(1);

    // resetKey changes (e.g. user switched feed)
    rerender({ articles: updated, isBuffering: true, resetKey: "feed-2", limit: 50 });

    // snapshot should have been rebuilt from current articles
    expect(result.current.displayArticles?.map((a) => a.id)).toEqual([2, 1]);
    expect(result.current.newCount).toBe(0);
  });

  it("handles undefined articles gracefully", () => {
    const { result } = renderBufferedArticles({
      articles: undefined,
      isBuffering: true,
      resetKey: 0,
      limit: 50,
    });

    expect(result.current.displayArticles).toBeUndefined();
    expect(result.current.newCount).toBe(0);
  });

  it("does not treat first load as all-new when buffering activates before articles load", () => {
    // Scoring status arrives before article query resolves
    const { result, rerender } = renderBufferedArticles({
      articles: undefined,
      isBuffering: true,
      resetKey: 0,
      limit: 50,
    });

    // Articles load — should pass through, not be counted as new
    const articles = [makeArticle(1), makeArticle(2)];
    rerender({ articles, isBuffering: true, resetKey: 0, limit: 50 });

    expect(result.current.displayArticles).toEqual(articles);
    expect(result.current.newCount).toBe(0);

    // Subsequent poll adds a new article — should now buffer correctly
    const updated = [makeArticle(3), makeArticle(1), makeArticle(2)];
    rerender({ articles: updated, isBuffering: true, resetKey: 0, limit: 50 });

    expect(result.current.newCount).toBe(1);
    expect(result.current.displayArticles?.map((a) => a.id)).toEqual([1, 2]);
  });

  it("expands snapshot on pagination (limit increase) without inflating newCount", () => {
    // Start with 2 articles, buffering active
    const initial = [makeArticle(1), makeArticle(2)];
    const { result, rerender } = renderBufferedArticles({
      articles: initial,
      isBuffering: false,
      resetKey: 0,
      limit: 50,
    });

    rerender({ articles: initial, isBuffering: true, resetKey: 0, limit: 50 });

    // 1 new scored article arrives via poll
    const withScored = [makeArticle(3), makeArticle(1), makeArticle(2)];
    rerender({ articles: withScored, isBuffering: true, resetKey: 0, limit: 50 });
    expect(result.current.newCount).toBe(1);
    expect(result.current.displayArticles?.map((a) => a.id)).toEqual([1, 2]);

    // User clicks "Load more" — limit increases, paginated articles appended
    const withPaginated = [
      makeArticle(3),
      makeArticle(1),
      makeArticle(2),
      makeArticle(10),
      makeArticle(11),
      makeArticle(12),
    ];
    rerender({ articles: withPaginated, isBuffering: true, resetKey: 0, limit: 100 });

    // Paginated articles (10, 11, 12) should be visible; newCount stays 1 (only article 3)
    expect(result.current.newCount).toBe(1);
    expect(result.current.displayArticles?.map((a) => a.id)).toEqual([1, 2, 10, 11, 12]);

    // Next poll adds another scored article — newCount goes to 2
    const withSecondScored = [
      makeArticle(4),
      makeArticle(3),
      makeArticle(1),
      makeArticle(2),
      makeArticle(10),
      makeArticle(11),
      makeArticle(12),
    ];
    rerender({ articles: withSecondScored, isBuffering: true, resetKey: 0, limit: 100 });
    expect(result.current.newCount).toBe(2);
    expect(result.current.displayArticles?.map((a) => a.id)).toEqual([1, 2, 10, 11, 12]);
  });

  it("resumes passthrough and resets newCount when buffering deactivates", () => {
    const initial = [makeArticle(1)];
    const { result, rerender } = renderBufferedArticles({
      articles: initial,
      isBuffering: false,
      resetKey: 0,
      limit: 50,
    });

    rerender({ articles: initial, isBuffering: true, resetKey: 0, limit: 50 });

    // new articles arrive while buffering
    const updated = [makeArticle(2), makeArticle(1)];
    rerender({ articles: updated, isBuffering: true, resetKey: 0, limit: 50 });
    expect(result.current.newCount).toBe(1);

    // deactivate buffering
    rerender({ articles: updated, isBuffering: false, resetKey: 0, limit: 50 });

    expect(result.current.displayArticles).toEqual(updated);
    expect(result.current.newCount).toBe(0);
  });
});
