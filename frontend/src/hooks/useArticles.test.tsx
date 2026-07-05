import { describe, expect, it } from "vitest";
import { useArticles } from "@/hooks/useArticles";
import { createWrapper, renderHook, waitFor } from "@/test/utils";
import { mockArticles } from "@/test/mocks/handlers/articles";

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
