import { useState } from "react";
import { http, HttpResponse } from "msw";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import {
  ALL_ARTICLES_SELECTION,
  type Feed,
  type FeedFolder,
  type FeedSelection,
} from "@/lib/types";
import {
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
  within,
} from "@/test/utils";
import { server } from "@/test/mocks/server";

// next-themes reads matchMedia/localStorage; stub the hook the theme toggle uses.
vi.mock("next-themes", () => ({
  useTheme: () => ({ setTheme: vi.fn(), theme: "dark" }),
}));

// SidebarProvider's useIsMobile calls window.matchMedia, which jsdom lacks.
beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

const folders: FeedFolder[] = [
  {
    id: 1,
    name: "Tech",
    display_order: 1,
    created_at: "2026-02-20T00:00:00",
    unread_count: 12,
  },
];

const feeds: Feed[] = [
  {
    id: 10,
    url: "https://hn.example/feed.xml",
    title: "Hacker News",
    display_order: 1,
    last_fetched_at: null,
    unread_count: 12,
    folder_id: 1,
    folder_name: "Tech",
  },
  {
    id: 20,
    url: "https://xkcd.example/feed.xml",
    title: "xkcd",
    display_order: 1,
    last_fetched_at: null,
    unread_count: 4,
    folder_id: null,
    folder_name: null,
  },
];

/**
 * Renders the sidebar with real selection state (like HomeShell does), plus a
 * heading that echoes the current selection so tests can assert what's active.
 */
function ControlledSidebar() {
  const [selection, setSelection] = useState<FeedSelection>(
    ALL_ARTICLES_SELECTION,
  );
  return (
    <SidebarProvider>
      <div data-testid="selection">{JSON.stringify(selection)}</div>
      <AppSidebar selection={selection} onSelect={setSelection} />
    </SidebarProvider>
  );
}

function renderSidebar() {
  server.use(
    http.get("/api/feeds", () => HttpResponse.json(feeds)),
    http.get("/api/feed-folders", () => HttpResponse.json(folders)),
  );
  return renderWithProviders(<ControlledSidebar />);
}

describe("AppSidebar", () => {
  it("renders folders, nested feeds, root feeds, and badge counts from the API", async () => {
    renderSidebar();

    // Folder label with its server unread count.
    const folderButton = await screen.findByRole("button", { name: /^Tech/ });
    expect(within(folderButton).getByText("Tech")).toBeInTheDocument();
    expect(folderButton).toHaveTextContent("12");

    // Nested feed under the folder.
    const nestedFeed = await screen.findByText("Hacker News");
    expect(nestedFeed).toBeInTheDocument();

    // Root feed rendered outside any folder.
    expect(await screen.findByText("xkcd")).toBeInTheDocument();

    // Total unread (12 + 4) shown in the header.
    await waitFor(() =>
      expect(
        screen.getByText("All articles").closest("button"),
      ).toHaveTextContent("16"),
    );
  });

  it("defaults to All articles selected", async () => {
    renderSidebar();

    await screen.findByText("xkcd"); // wait for data
    const allButton = screen.getByText("All articles").closest("button");
    expect(allButton).toHaveAttribute("data-active", "true");
    expect(screen.getByTestId("selection")).toHaveTextContent(
      JSON.stringify({ type: "all" }),
    );
  });

  it("selects a feed on click and updates the active state", async () => {
    const user = userEvent.setup();
    renderSidebar();

    const rootFeed = await screen.findByText("xkcd");
    await user.click(rootFeed);

    await waitFor(() =>
      expect(screen.getByTestId("selection")).toHaveTextContent(
        JSON.stringify({ type: "feed", id: 20 }),
      ),
    );

    // The clicked feed is now active; All articles no longer is.
    expect(rootFeed.closest("a, button")).toHaveAttribute(
      "data-active",
      "true",
    );
    expect(screen.getByText("All articles").closest("button")).toHaveAttribute(
      "data-active",
      "false",
    );
  });

  it("selects the folder on name click without collapsing it", async () => {
    const user = userEvent.setup();
    renderSidebar();

    // Feeds are visible (folder open by default).
    await screen.findByText("Hacker News");

    // Click the folder name button (not the chevron toggle).
    const folderButton = screen.getByRole("button", { name: /^Tech/ });
    await user.click(folderButton);

    // Folder is now selected...
    await waitFor(() =>
      expect(screen.getByTestId("selection")).toHaveTextContent(
        JSON.stringify({ type: "folder", id: 1 }),
      ),
    );
    expect(folderButton).toHaveAttribute("data-active", "true");

    // ...and the folder stayed open — nested feed is still visible.
    expect(screen.getByText("Hacker News")).toBeInTheDocument();
  });

  it("toggles the folder on chevron click without changing selection", async () => {
    const user = userEvent.setup();
    renderSidebar();

    await screen.findByText("Hacker News");

    // Baseline: All articles selected, folder open.
    expect(screen.getByTestId("selection")).toHaveTextContent(
      JSON.stringify({ type: "all" }),
    );

    const toggle = screen.getByRole("button", { name: "Toggle Tech" });
    await user.click(toggle);

    // Collapsing hides the nested feed...
    await waitFor(() =>
      expect(screen.queryByText("Hacker News")).not.toBeInTheDocument(),
    );

    // ...but selection is unchanged.
    expect(screen.getByTestId("selection")).toHaveTextContent(
      JSON.stringify({ type: "all" }),
    );

    // Expanding again brings the feed back.
    await user.click(toggle);
    await waitFor(() =>
      expect(screen.getByText("Hacker News")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("selection")).toHaveTextContent(
      JSON.stringify({ type: "all" }),
    );
  });
});
