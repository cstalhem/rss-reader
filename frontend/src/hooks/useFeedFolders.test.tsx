import { ChakraProvider } from "@chakra-ui/react";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { API_BASE_URL } from "@/lib/api";
import { useFeedFolders } from "@/hooks/useFeedFolders";
import { FEED_STATE_POLL_INTERVAL } from "@/lib/constants";
import { server } from "@/test/mocks/server";
import { mockFeedFolders } from "@/test/mocks/handlers/feeds";
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

describe("useFeedFolders", () => {
  it("fetches and returns feed folders", async () => {
    const queryClient = createTestQueryClient();
    const { result } = renderHook(() => useFeedFolders(), {
      wrapper: createHookWrapper(queryClient),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(mockFeedFolders.length);
    expect(result.current.data![0].name).toBe(mockFeedFolders[0].name);
  });

  it("polls folder unread counts on an interval", async () => {
    const queryClient = createTestQueryClient();
    let requestCount = 0;

    server.use(
      http.get(`${API_BASE_URL}/api/feed-folders`, () => {
        requestCount += 1;
        return HttpResponse.json(mockFeedFolders);
      }),
    );

    renderHook(() => useFeedFolders(), {
      wrapper: createHookWrapper(queryClient),
    });

    await waitFor(() => expect(requestCount).toBeGreaterThanOrEqual(2), {
      timeout: FEED_STATE_POLL_INTERVAL * 10,
    });
  });
});
