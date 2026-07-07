import { QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { TriageTab } from "@/components/categories/triage-tab";
import { Toaster } from "@/components/ui/sonner";
import type { Category } from "@/lib/types";
import {
  createTestQueryClient,
  render,
  screen,
  userEvent,
  waitFor,
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

const triageCategory: Category = {
  id: 1,
  display_name: "Crypto",
  slug: "crypto",
  weight: "normal",
  parent_id: null,
  needs_triage: true,
  article_count: 4,
  created_at: "2026-07-01T00:00:00",
  sample_articles: [
    {
      id: 9001,
      title: "Bitcoin ETF inflows hit record highs",
      feed_title: "Feed A",
    },
  ],
};

const secondTriage: Category = {
  ...triageCategory,
  id: 5,
  display_name: "Finance",
  slug: "finance",
};

function useTriageList(categories: Category[]) {
  server.use(
    http.get("/api/categories", ({ request }) => {
      const url = new URL(request.url);
      if (url.searchParams.get("needs_triage") === "true") {
        return HttpResponse.json(categories);
      }
      return HttpResponse.json(categories);
    }),
  );
}

function renderTriage() {
  const queryClient = createTestQueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <TriageTab />
      <Toaster />
    </QueryClientProvider>,
  );
  return { queryClient };
}

// The triage row renders both a mobile (stacked) and desktop (single-row)
// layout — jsdom applies no CSS, so both are present. Query the first match;
// both layouts wire the same handlers.
async function firstButton(name: RegExp) {
  const matches = await screen.findAllByRole("button", { name });
  return matches[0];
}

describe("TriageTab deferred-commit undo", () => {
  it("Keep fires PATCH { needs_triage: false } after the timer elapses", async () => {
    useTriageList([triageCategory]);
    let patched: { id: string; body: unknown } | null = null;
    server.use(
      http.patch("/api/categories/:id", async ({ request, params }) => {
        patched = { id: String(params.id), body: await request.json() };
        return HttpResponse.json({ ...triageCategory, needs_triage: false });
      }),
    );

    const user = userEvent.setup();
    renderTriage();

    await screen.findAllByText("Crypto");
    await user.click(await firstButton(/keep/i));

    // Optimistically removed from the visible list.
    await waitFor(() =>
      expect(screen.queryByText("Crypto")).not.toBeInTheDocument(),
    );
    expect(patched).toBeNull();

    // The real PATCH fires only after the undo window elapses.
    await new Promise((resolve) => setTimeout(resolve, 5100));
    await waitFor(() => expect(patched).not.toBeNull());
    expect(patched!.id).toBe("1");
    expect(patched!.body).toMatchObject({ needs_triage: false });
  }, 10000);

  it("Block fires PATCH { weight: 'block', needs_triage: false } after the timer", async () => {
    useTriageList([triageCategory]);
    let patched: unknown = null;
    server.use(
      http.patch("/api/categories/:id", async ({ request }) => {
        patched = await request.json();
        return HttpResponse.json({ ...triageCategory, weight: "block" });
      }),
    );

    const user = userEvent.setup();
    renderTriage();

    await screen.findAllByText("Crypto");
    await user.click(await firstButton(/block/i));
    await waitFor(() =>
      expect(screen.queryByText("Crypto")).not.toBeInTheDocument(),
    );

    await new Promise((resolve) => setTimeout(resolve, 5100));
    await waitFor(() => expect(patched).not.toBeNull());
    expect(patched).toMatchObject({ weight: "block", needs_triage: false });
  }, 10000);

  it("Undo cancels the pending mutation — no PATCH is sent", async () => {
    useTriageList([triageCategory]);
    let patchCount = 0;
    server.use(
      http.patch("/api/categories/:id", () => {
        patchCount += 1;
        return HttpResponse.json({ ...triageCategory, needs_triage: false });
      }),
    );

    const user = userEvent.setup();
    renderTriage();

    await screen.findAllByText("Crypto");
    await user.click(await firstButton(/keep/i));
    await waitFor(() =>
      expect(screen.queryByText("Crypto")).not.toBeInTheDocument(),
    );

    // The sonner toast exposes an Undo action.
    const undo = await screen.findByRole("button", { name: /undo/i });
    await user.click(undo);

    // Row returns; give the (now-cleared) timer window time to elapse.
    await screen.findAllByText("Crypto");
    await new Promise((resolve) => setTimeout(resolve, 5100));
    expect(patchCount).toBe(0);
  }, 10000);
});

describe("TriageTab rename", () => {
  it("submits PATCH { display_name } on rename", async () => {
    useTriageList([triageCategory]);
    let renameBody: unknown = null;
    server.use(
      http.patch("/api/categories/:id", async ({ request }) => {
        renameBody = await request.json();
        return HttpResponse.json({
          ...triageCategory,
          display_name: "Digital assets",
        });
      }),
    );

    const user = userEvent.setup();
    renderTriage();

    await screen.findAllByText("Crypto");
    await user.click(await firstButton(/more actions for crypto/i));
    await user.click(await screen.findByRole("menuitem", { name: /rename/i }));

    const input = await screen.findByLabelText("Name");
    await user.clear(input);
    await user.type(input, "Digital assets");
    await user.click(screen.getByRole("button", { name: /^rename$/i }));

    await waitFor(() => expect(renameBody).not.toBeNull());
    expect(renameBody).toMatchObject({ display_name: "Digital assets" });
  });

  it("on a 409 collision, offers the merge-into path and merges", async () => {
    useTriageList([triageCategory, secondTriage]);
    let mergeBody: unknown = null;
    server.use(
      http.patch("/api/categories/:id", () =>
        HttpResponse.json(
          { detail: "Category name already exists" },
          { status: 409 },
        ),
      ),
      http.post("/api/categories/merge", async ({ request }) => {
        mergeBody = await request.json();
        return HttpResponse.json({
          ok: true,
          articles_moved: 4,
          children_released: [],
          aliases_repointed: 0,
        });
      }),
    );

    const user = userEvent.setup();
    renderTriage();

    await screen.findAllByText("Crypto");
    await user.click(await firstButton(/more actions for crypto/i));
    await user.click(await screen.findByRole("menuitem", { name: /rename/i }));

    const input = await screen.findByLabelText("Name");
    await user.clear(input);
    await user.type(input, "Finance");
    await user.click(screen.getByRole("button", { name: /^rename$/i }));

    // The inline collision affordance switches to the merge flow.
    const mergeInto = await screen.findByRole("button", {
      name: /merge into finance/i,
    });
    await user.click(mergeInto);

    // Consequence pre-confirm, then confirm.
    await user.click(
      await screen.findByRole("button", { name: /confirm merge/i }),
    );

    await waitFor(() => expect(mergeBody).not.toBeNull());
    expect(mergeBody).toMatchObject({ source_id: 1, target_id: 5 });
  });
});
