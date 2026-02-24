import { describe, expect, it } from "bun:test";
import {
  parseStoredFeedSelection,
  shouldShowFolderUnreadBadge,
  validateFeedSelection,
} from "../feedSelection";
import { ALL_FEEDS_SELECTION, Feed, FeedFolder } from "../../../lib/types";

function makeFeed(id: number): Feed {
  return {
    id,
    url: `https://example.com/${id}.xml`,
    title: `Feed ${id}`,
    last_fetched_at: null,
    display_order: id,
    unread_count: 0,
    folder_id: null,
    folder_name: null,
  };
}

function makeFolder(id: number): FeedFolder {
  return {
    id,
    name: `Folder ${id}`,
    display_order: id,
    created_at: "2026-02-24T00:00:00",
    unread_count: 0,
  };
}

describe("sidebar folder helpers", () => {
  it("shows folder unread badge only when unread count is greater than zero", () => {
    expect(shouldShowFolderUnreadBadge(0)).toBe(false);
    expect(shouldShowFolderUnreadBadge(4)).toBe(true);
  });

  it("falls back to all selection when selected feed no longer exists", () => {
    const selection = { kind: "feed", feedId: 123 } as const;
    const validated = validateFeedSelection(selection, [makeFeed(1)], [makeFolder(1)]);
    expect(validated).toEqual(ALL_FEEDS_SELECTION);
  });

  it("falls back to all selection when selected folder no longer exists", () => {
    const selection = { kind: "folder", folderId: 42 } as const;
    const validated = validateFeedSelection(selection, [makeFeed(1)], [makeFolder(1)]);
    expect(validated).toEqual(ALL_FEEDS_SELECTION);
  });

  it("parses persisted feed and folder selections", () => {
    expect(parseStoredFeedSelection('{"kind":"feed","feedId":8}')).toEqual({
      kind: "feed",
      feedId: 8,
    });
    expect(parseStoredFeedSelection('{"kind":"folder","folderId":9}')).toEqual({
      kind: "folder",
      folderId: 9,
    });
  });
});
