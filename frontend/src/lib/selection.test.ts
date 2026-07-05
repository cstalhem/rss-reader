import { describe, expect, it } from "vitest";
import {
  isFeedSelection,
  resolveSelection,
  selectionName,
} from "@/lib/selection";
import {
  ALL_ARTICLES_SELECTION,
  type Feed,
  type FeedFolder,
  type FeedSelection,
} from "@/lib/types";

function feed(overrides: Partial<Feed> & Pick<Feed, "id">): Feed {
  return {
    url: `https://example.com/${overrides.id}.xml`,
    title: `Feed ${overrides.id}`,
    display_order: 0,
    last_fetched_at: null,
    unread_count: 0,
    folder_id: null,
    folder_name: null,
    ...overrides,
  };
}

function folder(
  overrides: Partial<FeedFolder> & Pick<FeedFolder, "id">,
): FeedFolder {
  return {
    name: `Folder ${overrides.id}`,
    display_order: 0,
    created_at: "2026-02-20T00:00:00",
    unread_count: 0,
    ...overrides,
  };
}

const LOADED = { feedsLoaded: true, foldersLoaded: true };
const NOT_LOADED = { feedsLoaded: false, foldersLoaded: false };

describe("isFeedSelection", () => {
  it("accepts valid selections", () => {
    expect(isFeedSelection({ type: "all" })).toBe(true);
    expect(isFeedSelection({ type: "feed", id: 3 })).toBe(true);
    expect(isFeedSelection({ type: "folder", id: 7 })).toBe(true);
  });

  it("rejects a malformed discriminant", () => {
    expect(isFeedSelection({ type: "everything" })).toBe(false);
  });

  it("rejects feed/folder selections missing a numeric id", () => {
    expect(isFeedSelection({ type: "feed" })).toBe(false);
    expect(isFeedSelection({ type: "folder", id: "1" })).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(isFeedSelection(null)).toBe(false);
    expect(isFeedSelection("all")).toBe(false);
    expect(isFeedSelection(42)).toBe(false);
  });
});

describe("resolveSelection", () => {
  it("falls back to All when a stale feed id is absent and feeds are loaded", () => {
    const selection: FeedSelection = { type: "feed", id: 99 };
    const result = resolveSelection(selection, [feed({ id: 10 })], [], LOADED);
    expect(result).toBe(ALL_ARTICLES_SELECTION);
  });

  it("falls back to All when the last feed was deleted (loaded + empty)", () => {
    const selection: FeedSelection = { type: "feed", id: 10 };
    const result = resolveSelection(selection, [], [], LOADED);
    expect(result).toBe(ALL_ARTICLES_SELECTION);
  });

  it("keeps a stale feed selection while feeds are NOT loaded", () => {
    const selection: FeedSelection = { type: "feed", id: 99 };
    const result = resolveSelection(selection, [], [], NOT_LOADED);
    expect(result).toBe(selection);
  });

  it("keeps a valid feed selection when the id is present", () => {
    const selection: FeedSelection = { type: "feed", id: 10 };
    const result = resolveSelection(selection, [feed({ id: 10 })], [], LOADED);
    expect(result).toBe(selection);
  });

  it("falls back to All for a dead folder once folders are loaded", () => {
    const selection: FeedSelection = { type: "folder", id: 99 };
    const result = resolveSelection(selection, [], [folder({ id: 1 })], LOADED);
    expect(result).toBe(ALL_ARTICLES_SELECTION);
  });

  it("keeps a stale folder selection during the not-loaded window", () => {
    const selection: FeedSelection = { type: "folder", id: 99 };
    const result = resolveSelection(selection, [], [], NOT_LOADED);
    expect(result).toBe(selection);
  });

  it("leaves the All selection untouched", () => {
    const result = resolveSelection(ALL_ARTICLES_SELECTION, [], [], LOADED);
    expect(result).toBe(ALL_ARTICLES_SELECTION);
  });
});

describe("selectionName", () => {
  it("names a feed, folder, and All", () => {
    expect(
      selectionName({ type: "feed", id: 10 }, [feed({ id: 10, title: "HN" })], []),
    ).toBe("HN");
    expect(
      selectionName(
        { type: "folder", id: 1 },
        [],
        [folder({ id: 1, name: "Tech" })],
      ),
    ).toBe("Tech");
    expect(selectionName(ALL_ARTICLES_SELECTION, [], [])).toBe("All articles");
  });

  it("falls back to All articles for an unknown discriminant", () => {
    const malformed = { type: "bogus" } as unknown as FeedSelection;
    expect(selectionName(malformed, [], [])).toBe("All articles");
  });
});
