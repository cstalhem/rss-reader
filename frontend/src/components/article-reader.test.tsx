import { QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { ArticleReader } from "@/components/article-reader";
import { mockArticleDetail } from "@/test/mocks/handlers/articles";
import { server } from "@/test/mocks/server";
import type { ArticleListItem } from "@/lib/types";
import {
  createTestQueryClient,
  render,
  screen,
  userEvent,
  waitFor,
} from "@/test/utils";

/** A list item carrying the meta/score fields the reader renders from props. */
function listItem(overrides: Partial<ArticleListItem> = {}): ArticleListItem {
  return {
    id: 1,
    feed_id: 2,
    feed_title: "Feed B",
    title: "Article 1",
    url: "https://example.com/articles/1",
    author: null,
    published_at: "2026-07-01T00:00:00",
    is_read: false,
    categories: [
      {
        id: 5,
        display_name: "Machine Learning",
        slug: "ml",
        effective_weight: "normal",
        parent_display_name: null,
      },
    ],
    interest_score: null,
    quality_score: 8,
    composite_score: 17.4,
    score_reasoning: "Directly relevant to your interests.",
    summary_preview: null,
    scoring_state: "scored",
    scored_at: null,
    re_evaluating: false,
    ...overrides,
  };
}

function renderReader(
  article: ArticleListItem,
  { dwellMs }: { dwellMs?: number } = {},
) {
  const queryClient = createTestQueryClient();
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <ArticleReader article={article} onClose={onClose} dwellMs={dwellMs} />
    </QueryClientProvider>,
  );
  return { queryClient, onClose };
}

describe("ArticleReader", () => {
  it("renders title, meta, scores, reasoning, and the sanitized body", async () => {
    renderReader(listItem());

    expect(
      screen.getByRole("heading", { name: "Article 1" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Feed B/)).toBeInTheDocument();
    expect(screen.getByText("relevance 17.4")).toBeInTheDocument();
    expect(screen.getByText("quality 8/10")).toBeInTheDocument();
    expect(
      screen.getByText("Directly relevant to your interests."),
    ).toBeInTheDocument();
    expect(screen.getByText("Machine Learning")).toBeInTheDocument();

    // Body arrives from the detail query (content = "<p>Full article content</p>").
    expect(await screen.findByText("Full article content")).toBeInTheDocument();
  });

  it("strips dangerous markup from the body before rendering", async () => {
    server.use(
      http.get("/api/articles/:id", ({ params }) =>
        HttpResponse.json({
          ...mockArticleDetail,
          id: Number(params.id),
          content: '<p>Safe text</p><img src=x onerror="alert(1)">',
        }),
      ),
    );

    renderReader(listItem());

    expect(await screen.findByText("Safe text")).toBeInTheDocument();
    // DOMPurify keeps the img but drops the onerror handler.
    const img = document.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("onerror")).toBeNull();
  });

  it("calls onClose on the Done button and on Escape", async () => {
    const user = userEvent.setup();
    const { onClose } = renderReader(listItem());

    await user.click(screen.getByRole("button", { name: /done/i }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("auto-marks the article read after the dwell window", async () => {
    let patchedRead: boolean | null = null;
    server.use(
      http.patch("/api/articles/:id", async ({ params, request }) => {
        const body = (await request.json()) as { is_read: boolean };
        patchedRead = body.is_read;
        return HttpResponse.json({
          ...mockArticleDetail,
          id: Number(params.id),
          is_read: body.is_read,
        });
      }),
    );

    // Short real dwell to stay reliable alongside MSW/TanStack async.
    renderReader(listItem({ is_read: false }), { dwellMs: 20 });

    await waitFor(() => expect(patchedRead).toBe(true));
  });

  it("does not auto-mark an already-read article", async () => {
    let patched = false;
    server.use(
      http.patch("/api/articles/:id", async ({ params, request }) => {
        patched = true;
        const body = (await request.json()) as { is_read: boolean };
        return HttpResponse.json({
          ...mockArticleDetail,
          id: Number(params.id),
          is_read: body.is_read,
        });
      }),
    );

    renderReader(listItem({ is_read: true }), { dwellMs: 20 });

    // Wait past the dwell window; no PATCH should have fired.
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(patched).toBe(false);
  });
});
