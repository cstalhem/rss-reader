import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { useDeleteFeed } from "@/hooks/useDeleteFeed";
import { queryKeys } from "@/lib/queryKeys";
import {
  createTestQueryClient,
  createWrapper,
  renderHook,
  waitFor,
} from "@/test/utils";
import { server } from "@/test/mocks/server";

describe("useDeleteFeed", () => {
  it("DELETEs the feed and invalidates feeds, folders, and article queries", async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteFeed(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate(1);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidatedKeys = invalidateSpy.mock.calls.map(
      (call) => call[0]?.queryKey,
    );
    expect(invalidatedKeys).toContainEqual(queryKeys.feeds.all);
    expect(invalidatedKeys).toContainEqual(queryKeys.feedFolders.all);
    // Deleting a feed cascades its articles server-side — the ["articles"]
    // prefix covers lists and counts alike.
    expect(invalidatedKeys).toContainEqual(queryKeys.articles.all);
  });

  it("exposes an error when the backend rejects", async () => {
    server.use(
      http.delete(
        "/api/feeds/:id",
        () => HttpResponse.json({ detail: "Feed not found" }, { status: 404 }),
        { once: true },
      ),
    );

    const { result } = renderHook(() => useDeleteFeed(), {
      wrapper: createWrapper(),
    });

    result.current.mutate(999);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Feed not found");
  });
});
