import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { useFeeds } from "@/hooks/useFeeds";
import { createWrapper, renderHook, waitFor } from "@/test/utils";
import { mockFeeds } from "@/test/mocks/handlers/feeds";
import { server } from "@/test/mocks/server";

describe("useFeeds", () => {
  it("returns feeds from the API", async () => {
    const { result } = renderHook(() => useFeeds(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockFeeds);
  });

  it("exposes an error when the request fails", async () => {
    server.use(
      http.get("/api/feeds", () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );

    const { result } = renderHook(() => useFeeds(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("boom");
  });
});
