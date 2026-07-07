import { describe, expect, it } from "vitest";
import type { Feed, FeedFolder } from "@/lib/types";
import { buildSidebarModel } from "@/lib/sidebar";

function feed(overrides: Partial<Feed> & Pick<Feed, "id">): Feed {
  return {
    url: `https://example.com/${overrides.id}.xml`,
    title: `Feed ${overrides.id}`,
    display_order: 0,
    last_fetched_at: null,
    unread_count: 0,
    folder_id: null,
    folder_name: null,
    is_aggregator: false,
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

describe("buildSidebarModel", () => {
  it("nests feeds under their folder by folder_id", () => {
    const folders = [folder({ id: 1, name: "Tech" })];
    const feeds = [
      feed({ id: 10, folder_id: 1, title: "In folder" }),
      feed({ id: 11, folder_id: null, title: "Root feed" }),
    ];

    const model = buildSidebarModel(feeds, folders, null);

    expect(model.folders).toHaveLength(1);
    expect(model.folders[0].feeds.map((f) => f.id)).toEqual([10]);
    expect(model.rootFeeds.map((f) => f.id)).toEqual([11]);
  });

  it("orders feeds within a folder by display_order then id", () => {
    const folders = [folder({ id: 1 })];
    const feeds = [
      feed({ id: 30, folder_id: 1, display_order: 2 }),
      feed({ id: 10, folder_id: 1, display_order: 1 }),
      feed({ id: 20, folder_id: 1, display_order: 1 }),
    ];

    const model = buildSidebarModel(feeds, folders, null);

    // display_order 1 (id 10, 20) before display_order 2 (id 30)
    expect(model.folders[0].feeds.map((f) => f.id)).toEqual([10, 20, 30]);
  });

  it("orders folders by display_order then id", () => {
    const folders = [
      folder({ id: 2, display_order: 2 }),
      folder({ id: 1, display_order: 1 }),
      folder({ id: 3, display_order: 1 }),
    ];

    const model = buildSidebarModel([], folders, null);

    expect(model.folders.map((f) => f.id)).toEqual([1, 3, 2]);
  });

  it("orders root feeds by display_order then id", () => {
    const feeds = [
      feed({ id: 30, display_order: 2 }),
      feed({ id: 10, display_order: 1 }),
      feed({ id: 20, display_order: 1 }),
    ];

    const model = buildSidebarModel(feeds, [], null);

    expect(model.rootFeeds.map((f) => f.id)).toEqual([10, 20, 30]);
  });

  it("keeps an empty folder with no feeds", () => {
    const folders = [folder({ id: 1, name: "Empty", unread_count: 0 })];

    const model = buildSidebarModel([], folders, null);

    expect(model.folders).toHaveLength(1);
    expect(model.folders[0].feeds).toEqual([]);
  });

  it("uses the server unread_count on folders, never recomputing from feeds", () => {
    const folders = [folder({ id: 1, unread_count: 99 })];
    const feeds = [
      feed({ id: 10, folder_id: 1, unread_count: 1 }),
      feed({ id: 11, folder_id: 1, unread_count: 2 }),
    ];

    const model = buildSidebarModel(feeds, folders, null);

    expect(model.folders[0].unread_count).toBe(99);
  });

  it("passes the server-computed global unread through verbatim", () => {
    const folders = [folder({ id: 1, unread_count: 99 })];
    const feeds = [
      feed({ id: 10, folder_id: 1, unread_count: 5 }),
      feed({ id: 11, folder_id: null, unread_count: 3 }),
    ];

    // Independent of feed/folder counts — never summed client-side.
    const model = buildSidebarModel(feeds, folders, 42);

    expect(model.totalUnread).toBe(42);
  });

  it("reports null total while counts are loading", () => {
    const feeds = [feed({ id: 10, unread_count: 5 })];

    const model = buildSidebarModel(feeds, [], null);

    expect(model.totalUnread).toBeNull();
  });

  it("returns empty groups and null total for no data", () => {
    const model = buildSidebarModel([], [], null);

    expect(model.folders).toEqual([]);
    expect(model.rootFeeds).toEqual([]);
    expect(model.totalUnread).toBeNull();
  });
});
