import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { useFeedFolders } from "@/hooks/useFeedFolders";
import { createWrapper, renderHook, waitFor } from "@/test/utils";
import { mockFeedFolders } from "@/test/mocks/handlers/feeds";
import { server } from "@/test/mocks/server";

describe("useFeedFolders", () => {
  it("returns feed folders from the API", async () => {
    const { result } = renderHook(() => useFeedFolders(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockFeedFolders);
  });

  it("exposes an error when the request fails", async () => {
    server.use(
      http.get("/api/feed-folders", () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );

    const { result } = renderHook(() => useFeedFolders(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("boom");
  });
});
