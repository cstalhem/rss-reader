import { QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { RatingControl } from "@/components/rating-control";
import { mockArticleDetail } from "@/test/mocks/handlers/articles";
import { server } from "@/test/mocks/server";
import { queryKeys } from "@/lib/queryKeys";
import type { ArticleListResponse } from "@/lib/types";
import {
  createTestQueryClient,
  render,
  screen,
  userEvent,
  waitFor,
} from "@/test/utils";

const ARTICLE_ID = 1;

/** Capture the last `PUT /api/articles/:id/rating` body across the test. */
function stubRating() {
  let lastBody: { value: 1 | -1 | null } | null = null;
  server.use(
    http.put("/api/articles/:id/rating", async ({ params, request }) => {
      lastBody = (await request.json()) as { value: 1 | -1 | null };
      return HttpResponse.json({
        ...mockArticleDetail,
        id: Number(params.id),
        rating: lastBody.value,
      });
    }),
  );
  return () => lastBody;
}

function renderControl(rating: number | null) {
  const queryClient = createTestQueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <RatingControl articleId={ARTICLE_ID} rating={rating} />
    </QueryClientProvider>,
  );
  return { queryClient };
}

describe("RatingControl", () => {
  it("reflects the current rating as the selected toggle", () => {
    renderControl(1);
    expect(screen.getByRole("radio", { name: "Thumbs up" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: "Thumbs down" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("tapping up sends value:1", async () => {
    const getBody = stubRating();
    const user = userEvent.setup();
    renderControl(null);

    await user.click(screen.getByRole("radio", { name: "Thumbs up" }));
    await waitFor(() => expect(getBody()).toEqual({ value: 1 }));
  });

  it("tapping the active up item clears (value:null)", async () => {
    const getBody = stubRating();
    const user = userEvent.setup();
    renderControl(1);

    await user.click(screen.getByRole("radio", { name: "Thumbs up" }));
    await waitFor(() => expect(getBody()).toEqual({ value: null }));
  });

  it("tapping down switches (value:-1)", async () => {
    const getBody = stubRating();
    const user = userEvent.setup();
    renderControl(1);

    await user.click(screen.getByRole("radio", { name: "Thumbs down" }));
    await waitFor(() => expect(getBody()).toEqual({ value: -1 }));
  });

  it("patches the article list cache with the new rating", async () => {
    stubRating();
    const user = userEvent.setup();
    const { queryClient } = renderControl(null);

    const listKey = queryKeys.articles.list({ type: "all" });
    queryClient.setQueryData(listKey, {
      pages: [
        {
          items: [{ ...mockArticleDetail, id: ARTICLE_ID, rating: null }],
          has_more: false,
        },
      ],
      pageParams: [0],
    });

    await user.click(screen.getByRole("radio", { name: "Thumbs up" }));

    await waitFor(() => {
      const data = queryClient.getQueryData<{
        pages: ArticleListResponse[];
      }>(listKey);
      expect(data?.pages[0].items[0].rating).toBe(1);
    });
  });
});
