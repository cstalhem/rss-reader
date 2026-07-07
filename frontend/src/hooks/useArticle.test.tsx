import { describe, expect, it } from "vitest";
import { useArticle } from "@/hooks/useArticle";
import { createWrapper, renderHook, waitFor } from "@/test/utils";
import { mockArticleDetail } from "@/test/mocks/handlers/articles";

describe("useArticle", () => {
  it("returns the article detail from the API", async () => {
    const { result } = renderHook(() => useArticle(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockArticleDetail);
  });

  it("does not fetch when id is null", () => {
    const { result } = renderHook(() => useArticle(null), {
      wrapper: createWrapper(),
    });

    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe("idle");
  });
});
