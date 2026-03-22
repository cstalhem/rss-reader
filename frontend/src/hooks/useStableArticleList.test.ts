import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@/test/utils";
import { useStableArticleList } from "@/hooks/useStableArticleList";
import type { ArticleListItem } from "@/lib/types";

function makeArticle(
  id: number,
  overrides?: Partial<ArticleListItem>,
): ArticleListItem {
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
    ...overrides,
  };
}

type HookProps = {
  articles: ArticleListItem[] | undefined;
  enabled: boolean;
  additions: "buffer" | "immediate";
  removals: "retain" | { animate: number } | "drop";
  resetKey: unknown;
  limit: number;
  onExiting?: (
    id: number,
    updateEntry: (article: ArticleListItem) => void,
  ) => void;
};

function renderStableList(initial: HookProps) {
  return renderHook(
    ({
      articles,
      enabled,
      additions,
      removals,
      resetKey,
      limit,
      onExiting,
    }: HookProps) =>
      useStableArticleList(
        articles,
        enabled,
        additions,
        removals,
        resetKey,
        limit,
        onExiting,
      ),
    { initialProps: initial },
  );
}

// ---------------------------------------------------------------------------
// passthrough (disabled)
// ---------------------------------------------------------------------------

describe("passthrough (disabled)", () => {
  it("passes articles through unchanged when not enabled", () => {
    const articles = [makeArticle(1), makeArticle(2)];
    const { result } = renderStableList({
      articles,
      enabled: false,
      additions: "buffer",
      removals: "drop",
      resetKey: 0,
      limit: 50,
    });

    expect(result.current.displayArticles).toEqual(articles);
    expect(result.current.pendingCount).toBe(0);
    expect(result.current.exitingIds.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buffering additions
// ---------------------------------------------------------------------------

describe("buffering additions", () => {
  it("snapshots current articles when enabled activates", () => {
    const articles = [makeArticle(1), makeArticle(2)];
    const { result, rerender } = renderStableList({
      articles,
      enabled: false,
      additions: "buffer",
      removals: "drop",
      resetKey: 0,
      limit: 50,
    });

    rerender({
      articles,
      enabled: true,
      additions: "buffer",
      removals: "drop",
      resetKey: 0,
      limit: 50,
    });

    expect(result.current.displayArticles).toEqual(articles);
    expect(result.current.pendingCount).toBe(0);
  });

  it("counts pending articles and excludes them from display (additions: buffer)", () => {
    const initial = [makeArticle(1), makeArticle(2)];
    const { result, rerender } = renderStableList({
      articles: initial,
      enabled: false,
      additions: "buffer",
      removals: "drop",
      resetKey: 0,
      limit: 50,
    });

    // activate
    rerender({
      articles: initial,
      enabled: true,
      additions: "buffer",
      removals: "drop",
      resetKey: 0,
      limit: 50,
    });

    // new article arrives from server
    const updated = [makeArticle(3), makeArticle(1), makeArticle(2)];
    rerender({
      articles: updated,
      enabled: true,
      additions: "buffer",
      removals: "drop",
      resetKey: 0,
      limit: 50,
    });

    expect(result.current.pendingCount).toBe(1);
    expect(result.current.displayArticles?.map((a) => a.id)).toEqual([1, 2]);
  });

  it("preserves stored order for active articles (not server re-sort order)", () => {
    const initial = [makeArticle(1), makeArticle(2), makeArticle(3)];
    const { result, rerender } = renderStableList({
      articles: initial,
      enabled: false,
      additions: "buffer",
      removals: "drop",
      resetKey: 0,
      limit: 50,
    });

    rerender({
      articles: initial,
      enabled: true,
      additions: "buffer",
      removals: "drop",
      resetKey: 0,
      limit: 50,
    });

    // server reorders existing articles and adds a new one
    const reordered = [
      makeArticle(4),
      makeArticle(3),
      makeArticle(1),
      makeArticle(2),
    ];
    rerender({
      articles: reordered,
      enabled: true,
      additions: "buffer",
      removals: "drop",
      resetKey: 0,
      limit: 50,
    });

    // stored order should be preserved: 1, 2, 3 (snapshot order, not server order)
    expect(result.current.displayArticles?.map((a) => a.id)).toEqual([
      1, 2, 3,
    ]);
  });

  it("shows all articles and resets pendingCount after flush", () => {
    const initial = [makeArticle(1)];
    const { result, rerender } = renderStableList({
      articles: initial,
      enabled: false,
      additions: "buffer",
      removals: "drop",
      resetKey: 0,
      limit: 50,
    });

    rerender({
      articles: initial,
      enabled: true,
      additions: "buffer",
      removals: "drop",
      resetKey: 0,
      limit: 50,
    });

    // new articles arrive
    const updated = [makeArticle(2), makeArticle(1)];
    rerender({
      articles: updated,
      enabled: true,
      additions: "buffer",
      removals: "drop",
      resetKey: 0,
      limit: 50,
    });

    expect(result.current.pendingCount).toBe(1);

    act(() => {
      result.current.flush();
    });

    expect(result.current.pendingCount).toBe(0);
    // After flush, all articles should be visible (including previously pending ones)
    expect(result.current.displayArticles?.map((a) => a.id)).toContain(2);
    expect(result.current.displayArticles?.map((a) => a.id)).toContain(1);
  });

  it("deferred snapshot: enabled before articles load", () => {
    // Scoring status arrives before article query resolves
    const { result, rerender } = renderStableList({
      articles: undefined,
      enabled: true,
      additions: "buffer",
      removals: "drop",
      resetKey: 0,
      limit: 50,
    });

    // Articles load — should be treated as initial snapshot, not additions
    const articles = [makeArticle(1), makeArticle(2)];
    rerender({
      articles,
      enabled: true,
      additions: "buffer",
      removals: "drop",
      resetKey: 0,
      limit: 50,
    });

    expect(result.current.displayArticles).toEqual(articles);
    expect(result.current.pendingCount).toBe(0);

    // Subsequent poll adds a new article — should now buffer correctly
    const updated = [makeArticle(3), makeArticle(1), makeArticle(2)];
    rerender({
      articles: updated,
      enabled: true,
      additions: "buffer",
      removals: "drop",
      resetKey: 0,
      limit: 50,
    });

    expect(result.current.pendingCount).toBe(1);
    expect(result.current.displayArticles?.map((a) => a.id)).toEqual([1, 2]);
  });

  it("handles undefined articles gracefully", () => {
    const { result } = renderStableList({
      articles: undefined,
      enabled: true,
      additions: "buffer",
      removals: "drop",
      resetKey: 0,
      limit: 50,
    });

    expect(result.current.displayArticles).toBeUndefined();
    expect(result.current.pendingCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// retaining removals
// ---------------------------------------------------------------------------

describe("retaining removals", () => {
  it("retains articles that disappear from server response", () => {
    const initial = [makeArticle(1), makeArticle(2), makeArticle(3)];
    const { result, rerender } = renderStableList({
      articles: initial,
      enabled: false,
      additions: "buffer",
      removals: "retain",
      resetKey: 0,
      limit: 50,
    });

    // activate
    rerender({
      articles: initial,
      enabled: true,
      additions: "buffer",
      removals: "retain",
      resetKey: 0,
      limit: 50,
    });

    // article 2 removed from server response (e.g. marked read, filtered out)
    const reduced = [makeArticle(1), makeArticle(3)];
    rerender({
      articles: reduced,
      enabled: true,
      additions: "buffer",
      removals: "retain",
      resetKey: 0,
      limit: 50,
    });

    // article 2 should still be in displayArticles (retained)
    expect(result.current.displayArticles?.map((a) => a.id)).toContain(2);
    expect(result.current.displayArticles?.length).toBe(3);
  });

  it("retained article stays at its original position in the order", () => {
    const initial = [makeArticle(1), makeArticle(2), makeArticle(3)];
    const { result, rerender } = renderStableList({
      articles: initial,
      enabled: false,
      additions: "buffer",
      removals: "retain",
      resetKey: 0,
      limit: 50,
    });

    rerender({
      articles: initial,
      enabled: true,
      additions: "buffer",
      removals: "retain",
      resetKey: 0,
      limit: 50,
    });

    // article 2 disappears
    const reduced = [makeArticle(1), makeArticle(3)];
    rerender({
      articles: reduced,
      enabled: true,
      additions: "buffer",
      removals: "retain",
      resetKey: 0,
      limit: 50,
    });

    // article 2 must be at index 1 (its original position), not appended
    const ids = result.current.displayArticles?.map((a) => a.id);
    expect(ids).toEqual([1, 2, 3]);
  });
});

// ---------------------------------------------------------------------------
// animating removals
// ---------------------------------------------------------------------------

describe("animating removals", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("immediately retains disappeared articles with cached data", () => {
    const initial = [makeArticle(1), makeArticle(2), makeArticle(3)];
    const { result, rerender } = renderStableList({
      articles: initial,
      enabled: false,
      additions: "immediate",
      removals: { animate: 3000 },
      resetKey: 0,
      limit: 50,
    });

    rerender({
      articles: initial,
      enabled: true,
      additions: "immediate",
      removals: { animate: 3000 },
      resetKey: 0,
      limit: 50,
    });

    // article 2 disappears from server
    const reduced = [makeArticle(1), makeArticle(3)];
    rerender({
      articles: reduced,
      enabled: true,
      additions: "immediate",
      removals: { animate: 3000 },
      resetKey: 0,
      limit: 50,
    });

    // article 2 should still be in the list (retained for animation)
    expect(result.current.displayArticles?.map((a) => a.id)).toContain(2);
    expect(result.current.displayArticles?.length).toBe(3);
  });

  it("removes exiting articles after animation duration", () => {
    const initial = [makeArticle(1), makeArticle(2), makeArticle(3)];
    const { result, rerender } = renderStableList({
      articles: initial,
      enabled: false,
      additions: "immediate",
      removals: { animate: 3000 },
      resetKey: 0,
      limit: 50,
    });

    rerender({
      articles: initial,
      enabled: true,
      additions: "immediate",
      removals: { animate: 3000 },
      resetKey: 0,
      limit: 50,
    });

    // article 2 disappears
    const reduced = [makeArticle(1), makeArticle(3)];
    rerender({
      articles: reduced,
      enabled: true,
      additions: "immediate",
      removals: { animate: 3000 },
      resetKey: 0,
      limit: 50,
    });

    // still present before timer fires
    expect(result.current.displayArticles?.map((a) => a.id)).toContain(2);

    // advance past animation duration
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // article 2 should now be removed
    expect(result.current.displayArticles?.map((a) => a.id)).toEqual([1, 3]);
  });

  it("reports exitingIds for animation CSS", () => {
    const initial = [makeArticle(1), makeArticle(2), makeArticle(3)];
    const { result, rerender } = renderStableList({
      articles: initial,
      enabled: false,
      additions: "immediate",
      removals: { animate: 3000 },
      resetKey: 0,
      limit: 50,
    });

    rerender({
      articles: initial,
      enabled: true,
      additions: "immediate",
      removals: { animate: 3000 },
      resetKey: 0,
      limit: 50,
    });

    // article 2 disappears
    const reduced = [makeArticle(1), makeArticle(3)];
    rerender({
      articles: reduced,
      enabled: true,
      additions: "immediate",
      removals: { animate: 3000 },
      resetKey: 0,
      limit: 50,
    });

    expect(result.current.exitingIds.has(2)).toBe(true);
    expect(result.current.exitingIds.size).toBe(1);
  });

  it("calls onExiting callback when article enters exiting state", () => {
    const onExiting = vi.fn();
    const initial = [makeArticle(1), makeArticle(2)];
    const { rerender } = renderStableList({
      articles: initial,
      enabled: false,
      additions: "immediate",
      removals: { animate: 3000 },
      resetKey: 0,
      limit: 50,
      onExiting,
    });

    rerender({
      articles: initial,
      enabled: true,
      additions: "immediate",
      removals: { animate: 3000 },
      resetKey: 0,
      limit: 50,
      onExiting,
    });

    // article 2 disappears
    rerender({
      articles: [makeArticle(1)],
      enabled: true,
      additions: "immediate",
      removals: { animate: 3000 },
      resetKey: 0,
      limit: 50,
      onExiting,
    });

    expect(onExiting).toHaveBeenCalledTimes(1);
    expect(onExiting).toHaveBeenCalledWith(2, expect.any(Function));
  });

  it("updates exiting article data when onExiting callback fires updateEntry", () => {
    let capturedUpdateEntry: ((article: ArticleListItem) => void) | null = null;
    const onExiting = vi.fn(
      (
        _id: number,
        updateEntry: (article: ArticleListItem) => void,
      ) => {
        capturedUpdateEntry = updateEntry;
      },
    );

    const initial = [makeArticle(1), makeArticle(2)];
    const { result, rerender } = renderStableList({
      articles: initial,
      enabled: false,
      additions: "immediate",
      removals: { animate: 3000 },
      resetKey: 0,
      limit: 50,
      onExiting,
    });

    rerender({
      articles: initial,
      enabled: true,
      additions: "immediate",
      removals: { animate: 3000 },
      resetKey: 0,
      limit: 50,
      onExiting,
    });

    // article 2 disappears
    rerender({
      articles: [makeArticle(1)],
      enabled: true,
      additions: "immediate",
      removals: { animate: 3000 },
      resetKey: 0,
      limit: 50,
      onExiting,
    });

    expect(capturedUpdateEntry).toBeTruthy();

    // Simulate fetch completing with updated data
    const updatedArticle = makeArticle(2, {
      scoring_state: "scored",
      composite_score: 85,
    });
    act(() => {
      capturedUpdateEntry!(updatedArticle);
    });

    // The exiting article should now have the updated data
    const article2 = result.current.displayArticles?.find((a) => a.id === 2);
    expect(article2).toBeDefined();
    expect(article2!.scoring_state).toBe("scored");
    expect(article2!.composite_score).toBe(85);
  });
});

// ---------------------------------------------------------------------------
// pagination
// ---------------------------------------------------------------------------

describe("pagination", () => {
  it("expands snapshot on pagination (limit increase) without inflating pendingCount", () => {
    const initial = [makeArticle(1), makeArticle(2)];
    const { result, rerender } = renderStableList({
      articles: initial,
      enabled: false,
      additions: "buffer",
      removals: "drop",
      resetKey: 0,
      limit: 50,
    });

    rerender({
      articles: initial,
      enabled: true,
      additions: "buffer",
      removals: "drop",
      resetKey: 0,
      limit: 50,
    });

    // 1 new scored article arrives via poll
    const withScored = [makeArticle(3), makeArticle(1), makeArticle(2)];
    rerender({
      articles: withScored,
      enabled: true,
      additions: "buffer",
      removals: "drop",
      resetKey: 0,
      limit: 50,
    });
    expect(result.current.pendingCount).toBe(1);
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
    rerender({
      articles: withPaginated,
      enabled: true,
      additions: "buffer",
      removals: "drop",
      resetKey: 0,
      limit: 100,
    });

    // Paginated articles (10, 11, 12) should be visible; pendingCount stays 1
    expect(result.current.pendingCount).toBe(1);
    expect(result.current.displayArticles?.map((a) => a.id)).toEqual([
      1, 2, 10, 11, 12,
    ]);
  });
});

// ---------------------------------------------------------------------------
// reset and deactivation
// ---------------------------------------------------------------------------

describe("reset and deactivation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resets state when resetKey changes", () => {
    const initial = [makeArticle(1)];
    const { result, rerender } = renderStableList({
      articles: initial,
      enabled: false,
      additions: "buffer",
      removals: "drop",
      resetKey: "feed-1",
      limit: 50,
    });

    rerender({
      articles: initial,
      enabled: true,
      additions: "buffer",
      removals: "drop",
      resetKey: "feed-1",
      limit: 50,
    });

    // new article arrives
    const updated = [makeArticle(2), makeArticle(1)];
    rerender({
      articles: updated,
      enabled: true,
      additions: "buffer",
      removals: "drop",
      resetKey: "feed-1",
      limit: 50,
    });
    expect(result.current.pendingCount).toBe(1);

    // resetKey changes (e.g. user switched feed)
    rerender({
      articles: updated,
      enabled: true,
      additions: "buffer",
      removals: "drop",
      resetKey: "feed-2",
      limit: 50,
    });

    // snapshot should have been rebuilt from current articles
    expect(result.current.displayArticles?.map((a) => a.id)).toEqual([2, 1]);
    expect(result.current.pendingCount).toBe(0);
  });

  it("resumes passthrough when enabled deactivates", () => {
    const initial = [makeArticle(1)];
    const { result, rerender } = renderStableList({
      articles: initial,
      enabled: false,
      additions: "buffer",
      removals: "drop",
      resetKey: 0,
      limit: 50,
    });

    rerender({
      articles: initial,
      enabled: true,
      additions: "buffer",
      removals: "drop",
      resetKey: 0,
      limit: 50,
    });

    // new articles arrive while enabled
    const updated = [makeArticle(2), makeArticle(1)];
    rerender({
      articles: updated,
      enabled: true,
      additions: "buffer",
      removals: "drop",
      resetKey: 0,
      limit: 50,
    });
    expect(result.current.pendingCount).toBe(1);

    // deactivate
    rerender({
      articles: updated,
      enabled: false,
      additions: "buffer",
      removals: "drop",
      resetKey: 0,
      limit: 50,
    });

    expect(result.current.displayArticles).toEqual(updated);
    expect(result.current.pendingCount).toBe(0);
  });

  it("cancels timers on unmount (no leaked setTimeout)", () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

    const initial = [makeArticle(1), makeArticle(2)];
    const { rerender, unmount } = renderStableList({
      articles: initial,
      enabled: false,
      additions: "immediate",
      removals: { animate: 3000 },
      resetKey: 0,
      limit: 50,
    });

    rerender({
      articles: initial,
      enabled: true,
      additions: "immediate",
      removals: { animate: 3000 },
      resetKey: 0,
      limit: 50,
    });

    // article 2 disappears — timer scheduled
    rerender({
      articles: [makeArticle(1)],
      enabled: true,
      additions: "immediate",
      removals: { animate: 3000 },
      resetKey: 0,
      limit: 50,
    });

    const callsBefore = clearTimeoutSpy.mock.calls.length;
    unmount();

    // clearTimeout should have been called for the pending timer
    expect(clearTimeoutSpy.mock.calls.length).toBeGreaterThan(callsBefore);
    clearTimeoutSpy.mockRestore();
  });

  it("cancels timers when enabled goes false", () => {
    const initial = [makeArticle(1), makeArticle(2)];
    const { result, rerender } = renderStableList({
      articles: initial,
      enabled: false,
      additions: "immediate",
      removals: { animate: 3000 },
      resetKey: 0,
      limit: 50,
    });

    rerender({
      articles: initial,
      enabled: true,
      additions: "immediate",
      removals: { animate: 3000 },
      resetKey: 0,
      limit: 50,
    });

    // article 2 disappears — timer scheduled
    rerender({
      articles: [makeArticle(1)],
      enabled: true,
      additions: "immediate",
      removals: { animate: 3000 },
      resetKey: 0,
      limit: 50,
    });

    // article 2 should be in exiting state before we disable
    expect(result.current.exitingIds.has(2)).toBe(true);

    // disable before timer fires
    rerender({
      articles: [makeArticle(1)],
      enabled: false,
      additions: "immediate",
      removals: { animate: 3000 },
      resetKey: 0,
      limit: 50,
    });

    // advance timers — exiting article should NOT reappear or cause errors
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // passthrough mode — only article 1
    expect(result.current.displayArticles?.map((a) => a.id)).toEqual([1]);
    expect(result.current.exitingIds.size).toBe(0);
  });

  it("cancels timers when resetKey changes", () => {
    const initial = [makeArticle(1), makeArticle(2)];
    const { result, rerender } = renderStableList({
      articles: initial,
      enabled: false,
      additions: "immediate",
      removals: { animate: 3000 },
      resetKey: "tab-1",
      limit: 50,
    });

    rerender({
      articles: initial,
      enabled: true,
      additions: "immediate",
      removals: { animate: 3000 },
      resetKey: "tab-1",
      limit: 50,
    });

    // article 2 disappears — timer scheduled
    rerender({
      articles: [makeArticle(1)],
      enabled: true,
      additions: "immediate",
      removals: { animate: 3000 },
      resetKey: "tab-1",
      limit: 50,
    });

    // article 2 should be in exiting state before we reset
    expect(result.current.exitingIds.has(2)).toBe(true);

    // reset key changes before timer fires
    const newArticles = [makeArticle(5), makeArticle(6)];
    rerender({
      articles: newArticles,
      enabled: true,
      additions: "immediate",
      removals: { animate: 3000 },
      resetKey: "tab-2",
      limit: 50,
    });

    // advance timers — old timer should have been cancelled
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // should show new tab's articles, no ghost from old tab
    expect(result.current.displayArticles?.map((a) => a.id)).toEqual([5, 6]);
    expect(result.current.exitingIds.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// data refresh while retained
// ---------------------------------------------------------------------------

describe("data refresh while retained", () => {
  it("refreshes cached data for retained articles (is_read update propagates)", () => {
    const initial = [makeArticle(1), makeArticle(2), makeArticle(3)];
    const { result, rerender } = renderStableList({
      articles: initial,
      enabled: false,
      additions: "buffer",
      removals: "retain",
      resetKey: 0,
      limit: 50,
    });

    // activate
    rerender({
      articles: initial,
      enabled: true,
      additions: "buffer",
      removals: "retain",
      resetKey: 0,
      limit: 50,
    });

    // article 2 updated with is_read: true, still in server response
    const withReadArticle = [
      makeArticle(1),
      makeArticle(2, { is_read: true }),
      makeArticle(3),
    ];
    rerender({
      articles: withReadArticle,
      enabled: true,
      additions: "buffer",
      removals: "retain",
      resetKey: 0,
      limit: 50,
    });

    // step 6 should refresh cached data
    const article2 = result.current.displayArticles?.find((a) => a.id === 2);
    expect(article2).toBeDefined();
    expect(article2!.is_read).toBe(true);

    // Now article 2 disappears from server response (next poll with is_read=false filter)
    const withoutArticle2 = [makeArticle(1), makeArticle(3)];
    rerender({
      articles: withoutArticle2,
      enabled: true,
      additions: "buffer",
      removals: "retain",
      resetKey: 0,
      limit: 50,
    });

    // retained article 2 should still have is_read: true from prior refresh
    const retained2 = result.current.displayArticles?.find((a) => a.id === 2);
    expect(retained2).toBeDefined();
    expect(retained2!.is_read).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// regression: issue #63
// ---------------------------------------------------------------------------

describe("regression: issue #63", () => {
  it("article marked read during buffering stays in displayArticles with is_read: true and at original position", () => {
    const initial = [makeArticle(1), makeArticle(2), makeArticle(3)];
    const { result, rerender } = renderStableList({
      articles: initial,
      enabled: false,
      additions: "buffer",
      removals: "retain",
      resetKey: 0,
      limit: 50,
    });

    // activate (simulates scoring becoming active)
    rerender({
      articles: initial,
      enabled: true,
      additions: "buffer",
      removals: "retain",
      resetKey: 0,
      limit: 50,
    });

    // TanStack optimistic update: article 2 is now is_read: true
    const withRead = [
      makeArticle(1),
      makeArticle(2, { is_read: true }),
      makeArticle(3),
    ];
    rerender({
      articles: withRead,
      enabled: true,
      additions: "buffer",
      removals: "retain",
      resetKey: 0,
      limit: 50,
    });

    // Next poll with is_read=false filter — article 2 gone from server response
    const withoutRead = [makeArticle(1), makeArticle(3)];
    rerender({
      articles: withoutRead,
      enabled: true,
      additions: "buffer",
      removals: "retain",
      resetKey: 0,
      limit: 50,
    });

    // Article 2 must remain in displayArticles
    const ids = result.current.displayArticles?.map((a) => a.id);
    expect(ids).toContain(2);

    // Article 2 must have is_read: true (from the cached data refresh in step 6)
    const article2 = result.current.displayArticles?.find((a) => a.id === 2);
    expect(article2).toBeDefined();
    expect(article2!.is_read).toBe(true);

    // Article 2 must be at its original position (index 1)
    expect(ids).toEqual([1, 2, 3]);
  });
});

describe("flush during exit animation", () => {
  it("cancels exiting timers and removes exiting articles on flush", () => {
    vi.useFakeTimers();

    const initial = [makeArticle(1), makeArticle(2), makeArticle(3)];
    const { result, rerender } = renderStableList({
      articles: initial,
      enabled: false,
      additions: "immediate",
      removals: { animate: 3000 },
      resetKey: 0,
      limit: 50,
    });

    // Enable
    rerender({
      articles: initial,
      enabled: true,
      additions: "immediate",
      removals: { animate: 3000 },
      resetKey: 0,
      limit: 50,
    });

    // Article 2 disappears — enters exiting state
    rerender({
      articles: [makeArticle(1), makeArticle(3)],
      enabled: true,
      additions: "immediate",
      removals: { animate: 3000 },
      resetKey: 0,
      limit: 50,
    });

    expect(result.current.exitingIds.has(2)).toBe(true);

    // Flush before timer fires
    act(() => {
      result.current.flush();
    });

    // Exiting article should be removed by flush, not lingering
    expect(result.current.displayArticles?.map((a) => a.id)).toEqual([1, 3]);
    expect(result.current.exitingIds.size).toBe(0);

    // Advance timers — should not cause errors (timer was cancelled)
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.displayArticles?.map((a) => a.id)).toEqual([1, 3]);

    vi.useRealTimers();
  });
});

describe("re-enable after disable", () => {
  it("re-initializes from fresh articles after disable and re-enable", () => {
    const initial = [makeArticle(1), makeArticle(2)];
    const { result, rerender } = renderStableList({
      articles: initial,
      enabled: true,
      additions: "buffer",
      removals: "retain",
      resetKey: 0,
      limit: 50,
    });

    // New article arrives while enabled — buffered
    const withNew = [makeArticle(3), makeArticle(1), makeArticle(2)];
    rerender({
      articles: withNew,
      enabled: true,
      additions: "buffer",
      removals: "retain",
      resetKey: 0,
      limit: 50,
    });

    expect(result.current.pendingCount).toBe(1);

    // Disable — passthrough
    rerender({
      articles: withNew,
      enabled: false,
      additions: "buffer",
      removals: "retain",
      resetKey: 0,
      limit: 50,
    });

    expect(result.current.pendingCount).toBe(0);
    expect(result.current.displayArticles?.map((a) => a.id)).toEqual([3, 1, 2]);

    // Re-enable — should re-initialize snapshot from current articles, no pending
    rerender({
      articles: withNew,
      enabled: true,
      additions: "buffer",
      removals: "retain",
      resetKey: 0,
      limit: 50,
    });

    expect(result.current.pendingCount).toBe(0);
    expect(result.current.displayArticles?.map((a) => a.id)).toEqual([3, 1, 2]);

    // Now a new article arrives — should be buffered against the new snapshot
    const withAnother = [makeArticle(4), makeArticle(3), makeArticle(1), makeArticle(2)];
    rerender({
      articles: withAnother,
      enabled: true,
      additions: "buffer",
      removals: "retain",
      resetKey: 0,
      limit: 50,
    });

    expect(result.current.pendingCount).toBe(1);
    expect(result.current.displayArticles?.map((a) => a.id)).toEqual([3, 1, 2]);
  });
});
