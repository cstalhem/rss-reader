import { ChakraProvider } from "@chakra-ui/react";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { useFeedFolders } from "@/hooks/useFeedFolders";
import { FEED_STATE_POLL_INTERVAL } from "@/lib/constants";
import { queryKeys } from "@/lib/queryKeys";
import { mockFeedFolders } from "@/test/mocks/handlers/feeds";
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

    renderHook(() => useFeedFolders(), {
      wrapper: createHookWrapper(queryClient),
    });

    await waitFor(() =>
      expect(
        queryClient
          .getQueryCache()
          .find({ queryKey: queryKeys.feedFolders.all }),
      ).toBeDefined(),
    );

    expect(
      queryClient.getQueryCache().find({ queryKey: queryKeys.feedFolders.all })
        ?.options.refetchInterval,
    ).toBe(FEED_STATE_POLL_INTERVAL);
  });
});
