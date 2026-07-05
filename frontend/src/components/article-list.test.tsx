import { QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { ArticleList } from "@/components/article-list";
import { mockArticles } from "@/test/mocks/handlers/articles";
import { server } from "@/test/mocks/server";
import {
  createTestQueryClient,
  render,
  screen,
  userEvent,
  waitFor,
} from "@/test/utils";

/**
 * Render ArticleList directly (no sidebar tree) with its own QueryClient so we
 * keep the tree small and avoid the matchMedia stub the sidebar would need.
 */
function renderList({ readerOpen = false }: { readerOpen?: boolean } = {}) {
  const queryClient = createTestQueryClient();
  const onOpen = vi.fn();
  const { rerender } = render(
    <QueryClientProvider client={queryClient}>
      <ArticleList
        selection={{ type: "all" }}
        onOpen={onOpen}
        readerOpen={readerOpen}
      />
    </QueryClientProvider>,
  );
  const setReaderOpen = (open: boolean) =>
    rerender(
      <QueryClientProvider client={queryClient}>
        <ArticleList
          selection={{ type: "all" }}
          onOpen={onOpen}
          readerOpen={open}
        />
      </QueryClientProvider>,
    );
  return { queryClient, onOpen, setReaderOpen };
}

describe("ArticleList", () => {
  it("renders article rows from the API grouped by date", async () => {
    renderList();

    // All 32 fixtures share published_at 2026-07-01, which is "Earlier".
    expect(await screen.findByText("Article 2")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Earlier" }),
    ).toBeInTheDocument();
    // First page is 25 items — Article 25 is present, Article 26 is not yet.
    expect(screen.getByText("Article 25")).toBeInTheDocument();
    expect(screen.queryByText("Article 26")).not.toBeInTheDocument();
  });

  it("appends the next page when Load more is clicked", async () => {
    const user = userEvent.setup();
    renderList();

    await screen.findByText("Article 2");
    const loadMore = screen.getByRole("button", { name: "Load more" });
    await user.click(loadMore);

    // Page 2 brings in the remaining 7 fixtures (26–32).
    await waitFor(() =>
      expect(screen.getByText("Article 32")).toBeInTheDocument(),
    );
    // Page 1 rows are still mounted (appended, not replaced).
    expect(screen.getByText("Article 2")).toBeInTheDocument();
    // No more pages — the button is gone.
    expect(
      screen.queryByRole("button", { name: /load more/i }),
    ).not.toBeInTheDocument();
  });

  it("switches row density when the reader opens and reverts on close", async () => {
    const { setReaderOpen } = renderList();

    // Rest density by default.
    const list = (await screen.findByText("Article 2")).closest(
      "[data-density]",
    );
    expect(list).toHaveAttribute("data-density", "rest");

    // Opening the reader signals the list into dense mode...
    setReaderOpen(true);
    await waitFor(() =>
      expect(
        screen.getByText("Article 2").closest("[data-density]"),
      ).toHaveAttribute("data-density", "dense"),
    );

    // ...and closing reverts it.
    setReaderOpen(false);
    await waitFor(() =>
      expect(
        screen.getByText("Article 2").closest("[data-density]"),
      ).toHaveAttribute("data-density", "rest"),
    );
  });

  it("marks a row read via the dot toggle and dims the row", async () => {
    const user = userEvent.setup();
    let patchedRead: boolean | null = null;
    server.use(
      http.patch("/api/articles/:id", async ({ params, request }) => {
        const body = (await request.json()) as { is_read: boolean };
        patchedRead = body.is_read;
        return HttpResponse.json({
          ...mockArticles[0],
          id: Number(params.id),
          is_read: body.is_read,
          summary: null,
          content: null,
        });
      }),
    );

    renderList();

    // All fixtures are unread — each row's dot button offers "Mark as read".
    const markButtons = await screen.findAllByRole("button", {
      name: "Mark as read",
    });
    const firstRow = markButtons[0].closest("article");
    expect(firstRow).not.toHaveClass("opacity-60");

    await user.click(markButtons[0]);

    // The PATCH fired with is_read: true...
    await waitFor(() => expect(patchedRead).toBe(true));
    // ...and exactly one row now offers "Mark as unread" and is dimmed.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Mark as unread" }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: "Mark as unread" }).closest("article"),
    ).toHaveClass("opacity-60");
  });
});
