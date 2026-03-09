import { ChakraProvider } from "@chakra-ui/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { useMarkAsRead } from "@/hooks/useArticles";
import { API_BASE_URL } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type { ArticleListItem, Feed, FeedFolder } from "@/lib/types";
import { server } from "@/test/mocks/server";
import {
  act,
  createTestQueryClient,
  renderHook,
  waitFor,
} from "@/test/utils";
import { system } from "@/theme";

const articleListKey = queryKeys.articles.list({
  is_read: true,
  limit: 50,
  feed_id: 1,
});

const readArticle: ArticleListItem = {
  id: 1,
  feed_id: 1,
  title: "Read Article",
  url: "https://example.com/article-1",
  author: null,
  published_at: "2026-03-09T10:00:00",
  is_read: true,
  categories: null,
  interest_score: null,
  quality_score: null,
  composite_score: null,
  score_reasoning: null,
  summary_preview: null,
  scoring_state: "scored",
  scored_at: "2026-03-09T10:05:00",
};

const feed: Feed = {
  id: 1,
  url: "https://example.com/feed.xml",
  title: "Example Feed",
  last_fetched_at: null,
  display_order: 1,
  unread_count: 0,
  folder_id: 7,
  folder_name: "Folder Seven",
};

const folder: FeedFolder = {
  id: 7,
  name: "Folder Seven",
  display_order: 1,
  created_at: "2026-03-09T00:00:00",
  unread_count: 0,
};

function createHookWrapper(queryClient: ReturnType<typeof createTestQueryClient>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ChakraProvider value={system}>{children}</ChakraProvider>
      </QueryClientProvider>
    );
  };
}

describe("useMarkAsRead", () => {
  it("updates feed and folder unread counts when an article becomes unread", async () => {
    server.use(
      http.patch(
        `${API_BASE_URL}/api/articles/:id`,
        async ({ request, params }) => {
          const body = (await request.json()) as { is_read: boolean };

          return HttpResponse.json({
            id: Number(params.id),
            feed_id: 1,
            title: "Read Article",
            url: "https://example.com/article-1",
            author: null,
            published_at: "2026-03-09T10:00:00",
            summary: null,
            content: null,
            is_read: body.is_read,
            categories: null,
            interest_score: null,
            quality_score: null,
            composite_score: null,
            score_reasoning: null,
            scoring_state: "scored",
            scored_at: "2026-03-09T10:05:00",
          });
        },
      ),
    );

    const queryClient = createTestQueryClient();
    queryClient.setQueryData(articleListKey, [readArticle]);
    queryClient.setQueryData(queryKeys.feeds.all, [feed]);
    queryClient.setQueryData(queryKeys.feedFolders.all, [folder]);

    const { result } = renderHook(() => useMarkAsRead(), {
      wrapper: createHookWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        articleId: readArticle.id,
        isRead: false,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(
      queryClient.getQueryData<ArticleListItem[]>(articleListKey)?.[0].is_read,
    ).toBe(false);
    expect(
      queryClient.getQueryData<Feed[]>(queryKeys.feeds.all)?.[0].unread_count,
    ).toBe(1);
    expect(
      queryClient.getQueryData<FeedFolder[]>(queryKeys.feedFolders.all)?.[0]
        .unread_count,
    ).toBe(1);
  });
});
