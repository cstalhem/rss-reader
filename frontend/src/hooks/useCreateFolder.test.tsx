import { QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { useCreateFolder } from "@/hooks/useCreateFolder";
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

describe("useCreateFolder", () => {
  it("POSTs the folder and invalidates feeds and folders", async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateFolder(), {
      wrapper: wrapperWithClient(queryClient),
    });

    result.current.mutate({ name: "News", feed_ids: [1] });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ name: "News" });

    const invalidatedKeys = invalidateSpy.mock.calls.map(
      (call) => call[0]?.queryKey,
    );
    expect(invalidatedKeys).toContainEqual(queryKeys.feeds.all);
    expect(invalidatedKeys).toContainEqual(queryKeys.feedFolders.all);
  });

  it("exposes an error when the name already exists", async () => {
    server.use(
      http.post(
        "/api/feed-folders",
        () =>
          HttpResponse.json(
            { detail: "Folder name already exists" },
            { status: 409 },
          ),
        { once: true },
      ),
    );

    const { result } = renderHook(() => useCreateFolder(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ name: "Tech" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Folder name already exists");
  });
});
