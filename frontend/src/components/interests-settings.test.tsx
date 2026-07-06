import { http, HttpResponse } from "msw";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { InterestsSettings } from "@/components/interests-settings";
import { mockPreferences } from "@/test/mocks/handlers/preferences";
import { server } from "@/test/mocks/server";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import type { PreferencesUpdate } from "@/lib/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/settings/interests",
}));

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
});

describe("InterestsSettings", () => {
  it("round-trips an edit: loads current values, saves both fields, and resets the baseline", async () => {
    const user = userEvent.setup();
    renderWithProviders(<InterestsSettings />);

    const interestsField = (await screen.findByLabelText(
      "Interests",
    )) as HTMLTextAreaElement;
    const antiInterestsField = screen.getByLabelText(
      "Anti-interests",
    ) as HTMLTextAreaElement;

    await waitFor(() => {
      expect(interestsField.value).toBe(mockPreferences.interests);
      expect(antiInterestsField.value).toBe(mockPreferences.anti_interests);
    });

    const saveButton = screen.getByRole("button", { name: "Save" });
    expect(saveButton).toBeDisabled();

    const newInterests = "space exploration, robotics";
    await user.clear(interestsField);
    await user.type(interestsField, newInterests);

    let captured: PreferencesUpdate | null = null;
    server.use(
      http.put("/api/preferences", async ({ request }) => {
        captured = (await request.json()) as PreferencesUpdate;
        // The mutation success handler invalidates the GET query, so the
        // refetch must also reflect the saved state (and its bumped
        // `updated_at`) for the form to remount with a reset baseline.
        server.use(
          http.get("/api/preferences", () =>
            HttpResponse.json({
              ...mockPreferences,
              ...captured,
              updated_at: "2026-02-02T00:00:00",
            }),
          ),
        );
        return HttpResponse.json({
          ...mockPreferences,
          ...captured,
          updated_at: "2026-02-02T00:00:00",
        });
      }),
    );

    expect(saveButton).toBeEnabled();
    await user.click(saveButton);

    await waitFor(() => {
      expect(captured).not.toBeNull();
    });
    expect(captured!.interests).toBe(newInterests);
    expect(captured!.anti_interests).toBe(mockPreferences.anti_interests);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    });
  });
});
