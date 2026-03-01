import { http, HttpResponse } from "msw";
import { API_BASE_URL } from "@/lib/api";
import type { Feed, FeedFolder } from "@/lib/types";

export const mockFeeds: Feed[] = [
  {
    id: 1,
    url: "https://example.com/feed.xml",
    title: "Example Feed",
    last_fetched_at: null,
    display_order: 1,
    unread_count: 5,
    folder_id: null,
    folder_name: null,
  },
];

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
  http.get(`${API_BASE_URL}/api/feeds`, () => HttpResponse.json(mockFeeds)),
  http.get(`${API_BASE_URL}/api/feed-folders`, () =>
    HttpResponse.json(mockFeedFolders),
  ),
];
