import { http, HttpResponse } from "msw";
import type { ScoringStatus } from "@/lib/types";

/** Fixture matching `GET /api/scoring/status`. IDLE by default (all counts 0) so tests that don't care about scoring state aren't affected by the chip's polling query. */
export const mockScoringStatus: ScoringStatus = {
  unscored: 0,
  queued: 0,
  scoring: 0,
  scored: 0,
  failed: 0,
  blocked: 0,
  phase: "idle",
};

export const scoringHandlers = [
  http.get("/api/scoring/status", () => HttpResponse.json(mockScoringStatus)),
];
