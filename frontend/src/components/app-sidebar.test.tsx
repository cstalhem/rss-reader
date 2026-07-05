import { http, HttpResponse } from "msw";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import type { Feed, FeedFolder } from "@/lib/types";
import { renderWithProviders, screen, waitFor, within } from "@/test/utils";
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

function renderSidebar() {
  return renderWithProviders(
    <SidebarProvider>
      <AppSidebar />
    </SidebarProvider>,
  );
}

describe("AppSidebar", () => {
  it("renders folders, nested feeds, root feeds, and badge counts from the API", async () => {
    server.use(
      http.get("/api/feeds", () => HttpResponse.json(feeds)),
      http.get("/api/feed-folders", () => HttpResponse.json(folders)),
    );

    renderSidebar();

    // Folder label with its server unread count.
    const folderButton = await screen.findByRole("button", { name: /Tech/ });
    expect(within(folderButton).getByText("Tech")).toBeInTheDocument();

    // Nested feed under the folder.
    const nestedFeed = await screen.findByText("Hacker News");
    expect(nestedFeed).toBeInTheDocument();

    // Root feed rendered outside any folder.
    expect(await screen.findByText("xkcd")).toBeInTheDocument();

    // Total unread (12 + 4) shown in the header.
    await waitFor(() =>
      expect(screen.getByText("All articles").closest("button")).toHaveTextContent(
        "16",
      ),
    );
  });
});
