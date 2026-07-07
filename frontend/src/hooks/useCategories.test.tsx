import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { useCategories } from "@/hooks/useCategories";
import { queryKeys } from "@/lib/queryKeys";
import {
  createTestQueryClient,
  createWrapper,
  renderHook,
  waitFor,
} from "@/test/utils";
import { mockCategories } from "@/test/mocks/handlers/categories";
import { server } from "@/test/mocks/server";

describe("useCategories", () => {
  it("returns categories from the API and populates the cache under the list key", async () => {
    const queryClient = createTestQueryClient();
    const { result } = renderHook(() => useCategories(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Assert via the cache rather than `result.current` — TanStack Query can
    // settle the cache before the hook's returned object re-renders.
    expect(queryClient.getQueryData(queryKeys.categories.list())).toEqual(
      mockCategories,
    );
  });

  it("filters by needs_triage when passed", async () => {
    const { result } = renderHook(() => useCategories(true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(
      mockCategories.filter((c) => c.needs_triage),
    );
  });

  it("exposes an error when the request fails", async () => {
    server.use(
      http.get("/api/categories", () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );

    const { result } = renderHook(() => useCategories(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("boom");
  });
});
