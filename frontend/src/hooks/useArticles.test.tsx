import { describe, expect, it } from "vitest";
import { useArticles } from "@/hooks/useArticles";
import { useMarkRead } from "@/hooks/useMarkRead";
import { createWrapper, renderHook, waitFor } from "@/test/utils";
import { mockArticles } from "@/test/mocks/handlers/articles";
import { server } from "@/test/mocks/server";

describe("useArticles", () => {
  it("loads the first page and reports hasNextPage", async () => {
    const { result } = renderHook(() => useArticles({ type: "all" }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.articles).toHaveLength(25);
    expect(result.current.articles).toEqual(mockArticles.slice(0, 25));
    expect(result.current.hasNextPage).toBe(true);
  });

  it("appends the next page on fetchNextPage and reports no more pages at the end", async () => {
    const { result } = renderHook(() => useArticles({ type: "all" }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    result.current.fetchNextPage();

    await waitFor(() => expect(result.current.articles).toHaveLength(32));
    expect(result.current.articles).toEqual(mockArticles);
    expect(result.current.hasNextPage).toBe(false);
  });

  it("computes the next offset from cached unread items so marked-read rows don't shift the page window", async () => {
    // Regression: the server query is unread-only, so items marked read leave
    // the server's result set while staying in the cache. skip must count
    // cached UNREAD items (24 after one mark-read), not all cached items (25).
    const skips: string[] = [];
    const onRequest = ({ request }: { request: Request }) => {
      const url = new URL(request.url);
      if (url.pathname === "/api/articles") {
        skips.push(url.searchParams.get("skip") ?? "0");
      }
    };
    server.events.on("request:start", onRequest);

    try {
      const { result } = renderHook(
        () => ({ list: useArticles({ type: "all" }), mark: useMarkRead() }),
        { wrapper: createWrapper() },
      );
      await waitFor(() => expect(result.current.list.isSuccess).toBe(true));

      result.current.mark.mutate({ id: mockArticles[0].id, isRead: true });
      await waitFor(() => expect(result.current.mark.isSuccess).toBe(true));

      result.current.list.fetchNextPage();
      await waitFor(() => expect(skips).toContain("24"));
      expect(skips).not.toContain("25");
    } finally {
      server.events.removeListener("request:start", onRequest);
    }
  });

  it("filters by feed_id when the selection targets a feed", async () => {
    const { result } = renderHook(() => useArticles({ type: "feed", id: 1 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(
      result.current.articles.every((article) => article.feed_id === 1),
    ).toBe(true);
    expect(result.current.hasNextPage).toBe(false);
  });
});
