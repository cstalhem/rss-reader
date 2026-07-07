import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { useArticle } from "@/hooks/useArticle";
import { useArticles } from "@/hooks/useArticles";
import { useMarkRead } from "@/hooks/useMarkRead";
import { queryKeys } from "@/lib/queryKeys";
import {
  createTestQueryClient,
  createWrapper,
  renderHook,
  waitFor,
} from "@/test/utils";
import { mockArticles } from "@/test/mocks/handlers/articles";
import { server } from "@/test/mocks/server";

describe("useMarkRead", () => {
  it("PATCHes the article and flips is_read in the cached list without a refetch", async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createWrapper(queryClient);

    const { result: listResult } = renderHook(
      () => useArticles({ type: "all" }, "unread"),
      { wrapper },
    );
    await waitFor(() => expect(listResult.current.isSuccess).toBe(true));

    let fetchCount = 0;
    server.use(
      http.get("/api/articles", () => {
        fetchCount += 1;
        return HttpResponse.json({
          items: mockArticles.slice(0, 25),
          has_more: true,
        });
      }),
    );

    const { result: mutationResult } = renderHook(() => useMarkRead(), {
      wrapper,
    });

    mutationResult.current.mutate({ id: 1, isRead: true });

    await waitFor(() => expect(mutationResult.current.isSuccess).toBe(true));

    // Assert against the cache directly (list pages), the source of truth the
    // component reads from — sidesteps renderHook's effect-timing lag on
    // externally-triggered cache writes and stays faithful to "no refetch".
    const cached = queryClient.getQueryData<{
      pages: { items: { id: number; is_read: boolean }[] }[];
    }>(queryKeys.articles.list({ type: "all" }, "unread"));
    const items = cached?.pages.flatMap((page) => page.items) ?? [];
    const updated = items.find((a) => a.id === 1);
    expect(updated?.is_read).toBe(true);
    // The row must remain in the list (dim in place), not vanish.
    expect(items).toHaveLength(25);
    expect(fetchCount).toBe(0);
  });

  it("updates the cached detail when present", async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createWrapper(queryClient);

    const { result: detailResult } = renderHook(() => useArticle(1), {
      wrapper,
    });
    await waitFor(() => expect(detailResult.current.isSuccess).toBe(true));

    const { result: mutationResult } = renderHook(() => useMarkRead(), {
      wrapper,
    });

    mutationResult.current.mutate({ id: 1, isRead: true });

    await waitFor(() => expect(mutationResult.current.isSuccess).toBe(true));

    const cached = queryClient.getQueryData<{ is_read: boolean }>(
      queryKeys.articles.detail(1),
    );
    expect(cached?.is_read).toBe(true);
  });

  it("invalidates feeds, feed folders, and counts queries on success", async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createWrapper(queryClient);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result: mutationResult } = renderHook(() => useMarkRead(), {
      wrapper,
    });

    mutationResult.current.mutate({ id: 1, isRead: true });

    await waitFor(() => expect(mutationResult.current.isSuccess).toBe(true));

    const invalidatedKeys = invalidateSpy.mock.calls.map(
      (call) => call[0]?.queryKey,
    );
    expect(invalidatedKeys).toContainEqual(queryKeys.feeds.all);
    expect(invalidatedKeys).toContainEqual(queryKeys.feedFolders.all);
    expect(invalidatedKeys).toContainEqual(queryKeys.articles.counts);
  });
});
