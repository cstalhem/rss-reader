import { describe, expect, it } from "vitest";
import {
  ARTICLE_EMPTY_STATES,
  ARTICLE_SORT_LABELS,
  ARTICLE_SORT_OPTIONS,
  createArticleFilterCollection,
  getArticleFilterActionLabel,
  getArticleScoringPhaseColorPalette,
  getArticleScoringPhaseLabel,
} from "./viewConfig";

describe("article view config", () => {
  it("builds desktop filter options with counts and disabled states", () => {
    const collection = createArticleFilterCollection({
      unreadCount: 4,
      scoringCount: 0,
      blockedCount: 2,
    });

    expect(collection.items).toEqual([
      { label: "Unread (4)", value: "unread" },
      { label: "All", value: "all" },
      { label: "Scoring", value: "scoring", disabled: true },
      { label: "Blocked (2)", value: "blocked", disabled: false },
    ]);
  });

  it("formats mobile filter labels without adding unread counts", () => {
    const counts = { unreadCount: 9, scoringCount: 3, blockedCount: 1 };

    expect(getArticleFilterActionLabel("unread", counts)).toBe("Unread");
    expect(getArticleFilterActionLabel("all", counts)).toBe("All");
    expect(getArticleFilterActionLabel("scoring", counts)).toBe("Scoring (3)");
    expect(getArticleFilterActionLabel("blocked", counts)).toBe("Blocked (1)");
  });

  it("exposes shared sort labels and options", () => {
    expect(ARTICLE_SORT_LABELS.date_desc).toBe("Newest first");
    expect(ARTICLE_SORT_OPTIONS.items.map((item) => item.label)).toEqual([
      "Highest score",
      "Lowest score",
      "Newest first",
      "Oldest first",
    ]);
  });

  it("provides empty-state and scoring phase lookup helpers", () => {
    expect(ARTICLE_EMPTY_STATES.unread.message).toBe(
      "No unread articles. You're all caught up!",
    );
    expect(getArticleScoringPhaseLabel("categorizing")).toBe("Categorizing…");
    expect(getArticleScoringPhaseLabel(undefined)).toBe("Scoring complete");
    expect(getArticleScoringPhaseColorPalette("thinking")).toBe("blue");
    expect(getArticleScoringPhaseColorPalette(undefined)).toBe("green");
  });
});
