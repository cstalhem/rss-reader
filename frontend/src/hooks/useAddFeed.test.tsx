import { QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { useAddFeed } from "@/hooks/useAddFeed";
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

describe("useAddFeed", () => {
  it("POSTs the feed and invalidates feeds, folders, and article queries", async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useAddFeed(), {
      wrapper: wrapperWithClient(queryClient),
    });

    result.current.mutate({
      url: "https://example.com/new.xml",
      is_aggregator: true,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({
      url: "https://example.com/new.xml",
      is_aggregator: true,
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map(
      (call) => call[0]?.queryKey,
    );
    expect(invalidatedKeys).toContainEqual(queryKeys.feeds.all);
    expect(invalidatedKeys).toContainEqual(queryKeys.feedFolders.all);
    // Adding a feed saves its initial articles — lists and counts must refresh.
    expect(invalidatedKeys).toContainEqual(queryKeys.articles.all);
    expect(invalidatedKeys).toContainEqual(queryKeys.articles.counts);
  });

  it("exposes an error when the backend rejects the URL", async () => {
    server.use(
      http.post(
        "/api/feeds",
        () =>
          HttpResponse.json({ detail: "Invalid feed URL" }, { status: 400 }),
        { once: true },
      ),
    );

    const { result } = renderHook(() => useAddFeed(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ url: "not-a-url" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Invalid feed URL");
  });
});
