import { QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { ManageTab } from "@/components/categories/manage-tab";
import type { Category, CategoryBulkUpdatePayload } from "@/lib/types";
import {
  createTestQueryClient,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from "@/test/utils";
import { server } from "@/test/mocks/server";

vi.mock("next-themes", () => ({
  useTheme: () => ({ setTheme: vi.fn(), theme: "light" }),
}));

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
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver ??=
    ResizeObserverStub as unknown as typeof ResizeObserver;
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.HTMLElement.prototype.hasPointerCapture = vi
    .fn()
    .mockReturnValue(false);
  window.HTMLElement.prototype.releasePointerCapture = vi.fn();
});

const categories: Category[] = [
  {
    id: 1,
    display_name: "Crypto",
    slug: "crypto",
    weight: "normal",
    parent_id: null,
    needs_triage: false,
    article_count: 4,
    created_at: "2026-07-01T00:00:00",
    sample_articles: [],
  },
  {
    id: 2,
    display_name: "Finance",
    slug: "finance",
    weight: "boost",
    parent_id: null,
    needs_triage: false,
    article_count: 10,
    created_at: "2026-06-15T00:00:00",
    sample_articles: [],
  },
];

function renderManage() {
  server.use(http.get("/api/categories", () => HttpResponse.json(categories)));
  const queryClient = createTestQueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <ManageTab />
    </QueryClientProvider>,
  );
  return { queryClient };
}

describe("ManageTab batch weight", () => {
  it("selecting multiple and applying a weight sends a bulk PATCH with the selected ids and weight", async () => {
    let bulkBody: CategoryBulkUpdatePayload | null = null;
    server.use(
      http.patch("/api/categories", async ({ request }) => {
        bulkBody = (await request.json()) as CategoryBulkUpdatePayload;
        return HttpResponse.json({ ok: true, updated: 2, missing_ids: [] });
      }),
    );

    const user = userEvent.setup();
    renderManage();

    await screen.findByText("Crypto");
    await user.click(screen.getByRole("checkbox", { name: /select crypto/i }));
    await user.click(screen.getByRole("checkbox", { name: /select finance/i }));

    // The batch weight toolbar appears once a selection exists.
    const toolbar = screen.getByRole("group", {
      name: /set weight for selected/i,
    });
    await user.click(
      within(toolbar).getByRole("button", { name: /^reduce$/i }),
    );

    await waitFor(() => expect(bulkBody).not.toBeNull());
    expect(bulkBody!.weight).toBe("reduce");
    expect([...bulkBody!.category_ids].sort()).toEqual([1, 2]);
  });
});
