import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { useDeleteFolder } from "@/hooks/useDeleteFolder";
import { queryKeys } from "@/lib/queryKeys";
import {
  createTestQueryClient,
  createWrapper,
  renderHook,
  waitFor,
} from "@/test/utils";
import { server } from "@/test/mocks/server";

describe("useDeleteFolder", () => {
  it("DELETEs with delete_feeds and invalidates feeds, folders, and article queries", async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    let requestedUrl = "";
    server.use(
      http.delete("/api/feed-folders/:id", ({ request }) => {
        requestedUrl = request.url;
        return HttpResponse.json({ ok: true });
      }),
    );

    const { result } = renderHook(() => useDeleteFolder(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ id: 1, deleteFeeds: true });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requestedUrl).toContain("delete_feeds=true");

    const invalidatedKeys = invalidateSpy.mock.calls.map(
      (call) => call[0]?.queryKey,
    );
    expect(invalidatedKeys).toContainEqual(queryKeys.feeds.all);
    expect(invalidatedKeys).toContainEqual(queryKeys.feedFolders.all);
    // delete_feeds=true cascades member feeds' articles — the ["articles"]
    // prefix covers lists and counts alike.
    expect(invalidatedKeys).toContainEqual(queryKeys.articles.all);
  });

  it("defaults to ungrouping (delete_feeds=false)", async () => {
    let requestedUrl = "";
    server.use(
      http.delete("/api/feed-folders/:id", ({ request }) => {
        requestedUrl = request.url;
        return HttpResponse.json({ ok: true });
      }),
    );

    const { result } = renderHook(() => useDeleteFolder(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ id: 1 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requestedUrl).toContain("delete_feeds=false");
  });

  it("exposes an error when the backend rejects", async () => {
    server.use(
      http.delete(
        "/api/feed-folders/:id",
        () =>
          HttpResponse.json({ detail: "Folder not found" }, { status: 404 }),
        { once: true },
      ),
    );

    const { result } = renderHook(() => useDeleteFolder(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ id: 999 });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Folder not found");
  });
});
