import { ChakraProvider } from "@chakra-ui/react";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { describe, it, expect } from "vitest";
import type { ReactNode } from "react";
import { useFeeds } from "@/hooks/useFeeds";
import { FEED_STATE_POLL_INTERVAL } from "@/lib/constants";
import { queryKeys } from "@/lib/queryKeys";
import { mockFeeds } from "@/test/mocks/handlers/feeds";
import {
  createTestQueryClient,
  renderHook,
  waitFor,
} from "@/test/utils";
import { system } from "@/theme";

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

    renderHook(() => useFeeds(), {
      wrapper: createHookWrapper(queryClient),
    });

    await waitFor(() =>
      expect(
        queryClient.getQueryCache().find({ queryKey: queryKeys.feeds.all }),
      ).toBeDefined(),
    );

    expect(
      queryClient.getQueryCache().find({ queryKey: queryKeys.feeds.all })?.options
        .refetchInterval,
    ).toBe(FEED_STATE_POLL_INTERVAL);
  });
});
