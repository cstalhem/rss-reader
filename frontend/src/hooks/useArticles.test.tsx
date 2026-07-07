import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { useArticles } from "@/hooks/useArticles";
import { useMarkRead } from "@/hooks/useMarkRead";
import { queryKeys } from "@/lib/queryKeys";
import type { ArticleListResponse } from "@/lib/types";
import {
  createTestQueryClient,
  createWrapper,
  renderHook,
  waitFor,
} from "@/test/utils";
import { mockArticles } from "@/test/mocks/handlers/articles";
import { server } from "@/test/mocks/server";

describe("useArticles", () => {
  it("loads the first page and reports hasNextPage", async () => {
    const { result } = renderHook(
      () => useArticles({ type: "all" }, "unread"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.articles).toHaveLength(25);
    expect(result.current.articles).toEqual(mockArticles.slice(0, 25));
    expect(result.current.hasNextPage).toBe(true);
  });

  it("appends the next page on fetchNextPage and reports no more pages at the end", async () => {
    const { result } = renderHook(
      () => useArticles({ type: "all" }, "unread"),
      { wrapper: createWrapper() },
    );

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
        () => ({
          list: useArticles({ type: "all" }, "unread"),
          mark: useMarkRead(),
        }),
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

  it("computes the next offset from cached read items so marked-unread rows don't shift the page window", async () => {
    // Mirror of the unread regression above: in the read view, items marked
    // unread leave the server's result set while staying in the cache. skip
    // must count cached READ items (24 after one mark-unread), not all cached
    // items (25). The fixture pool is unread-only, so serve a synthetic
    // all-read page for this test.
    const readArticles = mockArticles.map((a) => ({ ...a, is_read: true }));
    server.use(
      http.get("/api/articles", ({ request }) => {
        const url = new URL(request.url);
        const skip = Number(url.searchParams.get("skip") ?? "0");
        const limit = Number(url.searchParams.get("limit") ?? "25");
        return HttpResponse.json({
          items: readArticles.slice(skip, skip + limit),
          has_more: skip + limit < readArticles.length,
        });
      }),
    );

    const skips: string[] = [];
    const onRequest = ({ request }: { request: Request }) => {
      const url = new URL(request.url);
      if (url.pathname === "/api/articles") {
        skips.push(url.searchParams.get("skip") ?? "0");
      }
    };
    server.events.on("request:start", onRequest);

    try {
      const queryClient = createTestQueryClient();
      const wrapper = createWrapper(queryClient);

      const { result } = renderHook(
        () => useArticles({ type: "all" }, "read"),
        { wrapper },
      );
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Simulate a mark-unread surgically editing the cache, the same way
      // useMarkRead does — flip one cached item's is_read to false so it no
      // longer matches the "read" filter while staying in the cache.
      queryClient.setQueryData<{
        pages: ArticleListResponse[];
        pageParams: unknown[];
      }>(queryKeys.articles.list({ type: "all" }, "read"), (data) => {
        if (!data) return data;
        return {
          ...data,
          pages: data.pages.map((page, i) => ({
            ...page,
            items:
              i === 0
                ? page.items.map((item, j) =>
                    j === 0 ? { ...item, is_read: false } : item,
                  )
                : page.items,
          })),
        };
      });

      result.current.fetchNextPage();
      await waitFor(() => expect(skips).toContain("24"));
      expect(skips).not.toContain("25");
    } finally {
      server.events.removeListener("request:start", onRequest);
    }
  });

  it("requests read articles with is_read=true and recency sort", async () => {
    const requests: URL[] = [];
    const onRequest = ({ request }: { request: Request }) => {
      const url = new URL(request.url);
      if (url.pathname === "/api/articles") requests.push(url);
    };
    server.events.on("request:start", onRequest);

    try {
      const { result } = renderHook(
        () => useArticles({ type: "all" }, "read"),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(requests.length).toBeGreaterThan(0);
      const params = requests[0].searchParams;
      expect(params.get("is_read")).toBe("true");
      expect(params.get("sort_by")).toBe("published_at");
      expect(params.get("order")).toBe("desc");
    } finally {
      server.events.removeListener("request:start", onRequest);
    }
  });

  it("filters by feed_id when the selection targets a feed", async () => {
    const { result } = renderHook(
      () => useArticles({ type: "feed", id: 1 }, "unread"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(
      result.current.articles.every((article) => article.feed_id === 1),
    ).toBe(true);
    expect(result.current.hasNextPage).toBe(false);
  });
});
