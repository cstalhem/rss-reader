import { QueryClientProvider } from "@tanstack/react-query";
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

function wrapperWithClient(
  queryClient: ReturnType<typeof createTestQueryClient>,
) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("useDeleteFeed", () => {
  it("DELETEs the feed and invalidates feeds, folders, and article queries", async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteFeed(), {
      wrapper: wrapperWithClient(queryClient),
    });

    result.current.mutate(1);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidatedKeys = invalidateSpy.mock.calls.map(
      (call) => call[0]?.queryKey,
    );
    expect(invalidatedKeys).toContainEqual(queryKeys.feeds.all);
    expect(invalidatedKeys).toContainEqual(queryKeys.feedFolders.all);
    // Deleting a feed cascades its articles server-side — lists and counts must refresh.
    expect(invalidatedKeys).toContainEqual(queryKeys.articles.all);
    expect(invalidatedKeys).toContainEqual(queryKeys.articles.counts);
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
