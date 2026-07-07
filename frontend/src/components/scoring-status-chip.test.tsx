import { http, HttpResponse } from "msw";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { ScoringStatusChip } from "@/components/scoring-status-chip";
import type { ScoringStatus } from "@/lib/types";
import { server } from "@/test/mocks/server";
import { renderWithProviders, screen, waitFor } from "@/test/utils";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ setTheme: vi.fn(), theme: "dark" }),
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
});

describe("ScoringStatusChip", () => {
  it("shows the sum of non-terminal counts while work is pending", async () => {
    const pending: ScoringStatus = {
      unscored: 1,
      queued: 2,
      scoring: 0,
      scored: 50,
      failed: 1,
      blocked: 4,
      phase: "scoring",
    };
    server.use(
      http.get("/api/scoring/status", () => HttpResponse.json(pending)),
    );

    renderWithProviders(<ScoringStatusChip />);

    await waitFor(() =>
      expect(screen.getByText(/Processing/)).toHaveTextContent(
        "Processing 3 articles",
      ),
    );
  });

  it("renders nothing when idle (all counts zero)", async () => {
    renderWithProviders(<ScoringStatusChip />);

    await waitFor(() =>
      expect(screen.queryByRole("status")).not.toBeInTheDocument(),
    );
    expect(screen.queryByText(/processing/i)).not.toBeInTheDocument();
  });
});
