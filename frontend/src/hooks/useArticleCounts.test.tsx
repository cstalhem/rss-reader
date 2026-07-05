import { describe, expect, it } from "vitest";
import { useArticleCounts } from "@/hooks/useArticleCounts";
import { createWrapper, renderHook, waitFor } from "@/test/utils";
import { mockArticleCounts } from "@/test/mocks/handlers/articles";

describe("useArticleCounts", () => {
  it("returns the four counts from the API", async () => {
    const { result } = renderHook(() => useArticleCounts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockArticleCounts);
  });
});
