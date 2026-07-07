import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { useUpdateFolder } from "@/hooks/useUpdateFolder";
import { queryKeys } from "@/lib/queryKeys";
import {
  createTestQueryClient,
  createWrapper,
  renderHook,
  waitFor,
} from "@/test/utils";
import { server } from "@/test/mocks/server";

describe("useUpdateFolder", () => {
  it("PATCHes the folder and invalidates feeds and folders", async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateFolder(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ id: 1, data: { name: "Technology" } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ id: 1, name: "Technology" });

    const invalidatedKeys = invalidateSpy.mock.calls.map(
      (call) => call[0]?.queryKey,
    );
    expect(invalidatedKeys).toContainEqual(queryKeys.feeds.all);
    expect(invalidatedKeys).toContainEqual(queryKeys.feedFolders.all);
  });

  it("exposes an error when the rename collides", async () => {
    server.use(
      http.patch(
        "/api/feed-folders/:id",
        () =>
          HttpResponse.json(
            { detail: "Folder name already exists" },
            { status: 409 },
          ),
        { once: true },
      ),
    );

    const { result } = renderHook(() => useUpdateFolder(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ id: 1, data: { name: "Tech" } });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Folder name already exists");
  });
});
