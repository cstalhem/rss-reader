import { ChakraProvider } from "@chakra-ui/react";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { API_BASE_URL } from "@/lib/api";
import { useFeeds } from "@/hooks/useFeeds";
import { FEED_STATE_POLL_INTERVAL } from "@/lib/constants";
import { server } from "@/test/mocks/server";
import { mockFeeds } from "@/test/mocks/handlers/feeds";
import {
  createTestQueryClient,
  renderHook,
  waitFor,
} from "@/test/utils";
import { system } from "@/theme";

vi.mock("@/lib/constants", async () => {
  const actual = await vi.importActual<typeof import("@/lib/constants")>(
    "@/lib/constants",
  );

  return {
    ...actual,
    FEED_STATE_POLL_INTERVAL: 20,
  };
});

function createHookWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ChakraProvider value={system}>{children}</ChakraProvider>
      </QueryClientProvider>
    );
  };
}

describe("useFeeds", () => {
  it("fetches and returns feeds", async () => {
    const queryClient = createTestQueryClient();
    const { result } = renderHook(() => useFeeds(), {
      wrapper: createHookWrapper(queryClient),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(mockFeeds.length);
    expect(result.current.data![0].title).toBe(mockFeeds[0].title);
  });

  it("polls feed state on an interval", async () => {
    const queryClient = createTestQueryClient();
    let requestCount = 0;

    server.use(
      http.get(`${API_BASE_URL}/api/feeds`, () => {
        requestCount += 1;
        return HttpResponse.json(mockFeeds);
      }),
    );

    renderHook(() => useFeeds(), {
      wrapper: createHookWrapper(queryClient),
    });

    await waitFor(() => expect(requestCount).toBeGreaterThanOrEqual(2), {
      timeout: FEED_STATE_POLL_INTERVAL * 10,
    });
  });
});
