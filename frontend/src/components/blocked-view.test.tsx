import { QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { BlockedView } from "@/components/blocked-view";
import { mockBlockedArticles } from "@/test/mocks/handlers/articles";
import { server } from "@/test/mocks/server";
import {
  createTestQueryClient,
  render,
  screen,
  userEvent,
  waitFor,
} from "@/test/utils";

function renderBlockedView() {
  const queryClient = createTestQueryClient();
  const onOpen = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <BlockedView onOpen={onOpen} />
    </QueryClientProvider>,
  );
  return { onOpen };
}

describe("BlockedView", () => {
  it("groups blocked articles by blocking category, showing counts and a shared article under both groups", async () => {
    renderBlockedView();

    const cryptoHeading = await screen.findByText("Crypto");
    expect(cryptoHeading.closest("h2")).toHaveTextContent("2 articles");

    const gossipHeading = screen.getByText("Celebrity Gossip");
    expect(gossipHeading.closest("h2")).toHaveTextContent("1 article");

    // The fallback group for a reweighted category.
    const fallbackHeading = screen.getByText("No longer blocked");
    expect(fallbackHeading.closest("h2")).toHaveTextContent("1 article");

    // The double-blocked article appears under both of its groups.
    const occurrences = screen.getAllByText(
      "Celebrity-backed NFT project collapses amid lawsuits",
    );
    expect(occurrences).toHaveLength(2);

    // ...and each occurrence notes the OTHER blocking category (not itself).
    expect(
      screen.getByText(/also blocked by Celebrity Gossip/),
    ).toBeInTheDocument();
    expect(screen.getByText(/also blocked by Crypto/)).toBeInTheDocument();
  });

  it("opens the article on row tap", async () => {
    const user = userEvent.setup();
    const { onOpen } = renderBlockedView();

    const title = await screen.findByText(
      "Bitcoin ETF inflows hit record highs",
    );
    await user.click(title);

    expect(onOpen).toHaveBeenCalledWith(
      expect.objectContaining({ id: mockBlockedArticles[0].id }),
    );
  });

  it("rescues an article via the rescue button and removes it from the view", async () => {
    const user = userEvent.setup();
    let rescuedId: number | null = null;
    let rescued = false;
    server.use(
      http.post("/api/articles/:id/rescue", ({ params }) => {
        rescuedId = Number(params.id);
        rescued = true;
        return HttpResponse.json({ ok: true });
      }),
      http.get("/api/articles", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("scoring_state") !== "blocked") {
          return HttpResponse.json({ items: [], has_more: false });
        }
        const items = rescued
          ? mockBlockedArticles.filter(
              (a) => a.id !== mockBlockedArticles[0].id,
            )
          : mockBlockedArticles;
        return HttpResponse.json({ items, has_more: false });
      }),
    );

    renderBlockedView();

    const rescueButton = await screen.findByRole("button", {
      name: `Rescue "${mockBlockedArticles[0].title}"`,
    });
    await user.click(rescueButton);

    await waitFor(() => expect(rescuedId).toBe(mockBlockedArticles[0].id));
    await waitFor(() =>
      expect(
        screen.queryByText(mockBlockedArticles[0].title),
      ).not.toBeInTheDocument(),
    );
  });
});
