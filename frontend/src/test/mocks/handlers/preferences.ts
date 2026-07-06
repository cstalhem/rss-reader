import { http, HttpResponse } from "msw";
import type { Preferences, PreferencesUpdate } from "@/lib/types";

/** Fixture matching the backend `PreferencesResponse` shape exactly. */
export const mockPreferences: Preferences = {
  interests: "AI, distributed systems",
  anti_interests: "celebrity gossip",
  feed_refresh_interval: 1800,
  updated_at: "2026-01-01T00:00:00",
};

export const preferenceHandlers = [
  http.get("/api/preferences", () => HttpResponse.json(mockPreferences)),

  http.put("/api/preferences", async ({ request }) => {
    const body = (await request.json()) as PreferencesUpdate;
    // Backend bumps updated_at on every PUT (preferences.py) — mirror that so
    // the interests form's remount-reset behaves as it does in production.
    const merged: Preferences = {
      ...mockPreferences,
      ...body,
      updated_at: new Date().toISOString(),
    };
    return HttpResponse.json(merged);
  }),
];
