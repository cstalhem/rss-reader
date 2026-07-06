import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { useUpdateFeed } from "@/hooks/useUpdateFeed";
import { queryKeys } from "@/lib/queryKeys";
import {
  createTestQueryClient,
  createWrapper,
  renderHook,
  waitFor,
} from "@/test/utils";
import { server } from "@/test/mocks/server";

describe("useUpdateFeed", () => {
  it("PATCHes the feed and invalidates feeds, folders, and article queries", async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateFeed(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ id: 1, data: { title: "Renamed", folder_id: 2 } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({
      id: 1,
      title: "Renamed",
      folder_id: 2,
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map(
      (call) => call[0]?.queryKey,
    );
    expect(invalidatedKeys).toContainEqual(queryKeys.feeds.all);
    expect(invalidatedKeys).toContainEqual(queryKeys.feedFolders.all);
    // A rename changes feed_title on article rows; a folder move changes
    // folder-scoped lists and counts — article queries must refresh too.
    expect(invalidatedKeys).toContainEqual(queryKeys.articles.all);
  });

  it("exposes an error when the backend rejects", async () => {
    server.use(
      http.patch(
        "/api/feeds/:id",
        () => HttpResponse.json({ detail: "Feed not found" }, { status: 404 }),
        { once: true },
      ),
    );

    const { result } = renderHook(() => useUpdateFeed(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ id: 999, data: { title: "Nope" } });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Feed not found");
  });
});
