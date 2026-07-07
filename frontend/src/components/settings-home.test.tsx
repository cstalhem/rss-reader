import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { SettingsHome } from "@/components/settings-home";
import { server } from "@/test/mocks/server";
import { renderWithProviders, screen } from "@/test/utils";

const { mockUseIsMobile } = vi.hoisted(() => ({
  mockUseIsMobile: vi.fn(),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: mockUseIsMobile,
}));

function renderHome() {
  server.use(
    http.get("/api/categories/unseen-count", () =>
      HttpResponse.json({ count: 0 }),
    ),
  );
  return renderWithProviders(<SettingsHome />);
}

describe("SettingsHome", () => {
  it("renders the section selection list on mobile", () => {
    mockUseIsMobile.mockReturnValue(true);
    renderHome();

    expect(
      screen.getByRole("heading", { name: "Settings" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /General/ })).toHaveAttribute(
      "href",
      "/settings/general",
    );
    expect(
      screen.getByRole("link", { name: /Feed management/ }),
    ).toHaveAttribute("href", "/settings/feed-management");
  });

  it("renders an empty-state prompt on desktop, without a redirect", () => {
    mockUseIsMobile.mockReturnValue(false);
    renderHome();

    expect(screen.getByText("Select a setting")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
