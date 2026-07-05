import { http, HttpResponse } from "msw";
import type { Feed, FeedFolder } from "@/lib/types";

/** Fixture matching the backend `FeedResponse` shape exactly. */
export const mockFeeds: Feed[] = [
  {
    id: 1,
    url: "https://example.com/feed.xml",
    title: "Example Feed",
    display_order: 1,
    last_fetched_at: null,
    unread_count: 5,
    folder_id: null,
    folder_name: null,
  },
];

/** Fixture matching the backend `FeedFolderResponse` shape exactly. */
export const mockFeedFolders: FeedFolder[] = [
  {
    id: 1,
    name: "Tech",
    display_order: 1,
    created_at: "2026-02-20T00:00:00",
    unread_count: 3,
  },
];

export const feedHandlers = [
  http.get("/api/feeds", () => HttpResponse.json(mockFeeds)),
  http.get("/api/feed-folders", () => HttpResponse.json(mockFeedFolders)),
];
