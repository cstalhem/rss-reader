import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils";
import { useFeeds } from "@/hooks/useFeeds";
import { mockFeeds } from "@/test/mocks/handlers/feeds";

describe("useFeeds", () => {
  it("fetches and returns feeds", async () => {
    const { result } = renderHook(() => useFeeds(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(mockFeeds.length);
    expect(result.current.data![0].title).toBe(mockFeeds[0].title);
  });
});
