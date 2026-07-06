import { http, HttpResponse } from "msw";
import type {
  Feed,
  FeedCreatePayload,
  FeedFolder,
  FeedFolderCreatePayload,
  FeedFolderUpdatePayload,
  FeedUpdatePayload,
} from "@/lib/types";

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
    is_aggregator: false,
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
  http.post("/api/feeds", async ({ request }) => {
    const body = (await request.json()) as FeedCreatePayload;
    const created: Feed = {
      id: 2,
      url: body.url,
      title: "New Feed",
      display_order: 2,
      last_fetched_at: null,
      unread_count: 0,
      folder_id: null,
      folder_name: null,
      is_aggregator: body.is_aggregator ?? false,
    };
    return HttpResponse.json(created, { status: 201 });
  }),
  http.patch("/api/feeds/:id", async ({ request, params }) => {
    const body = (await request.json()) as FeedUpdatePayload;
    const updated: Feed = {
      ...mockFeeds[0],
      ...body,
      id: Number(params.id),
    };
    // The real backend recomputes the embedded folder_name from folder_id —
    // keep the fixture shape faithful instead of leaving it stale.
    const folder = mockFeedFolders.find((f) => f.id === updated.folder_id);
    updated.folder_name = folder?.name ?? null;
    return HttpResponse.json(updated);
  }),
  http.delete("/api/feeds/:id", () => HttpResponse.json({ ok: true })),
  http.post("/api/feed-folders", async ({ request }) => {
    const body = (await request.json()) as FeedFolderCreatePayload;
    const created: FeedFolder = {
      id: 2,
      name: body.name,
      display_order: 2,
      created_at: "2026-02-20T00:00:00",
      unread_count: 0,
    };
    return HttpResponse.json(created, { status: 201 });
  }),
  http.patch("/api/feed-folders/:id", async ({ request, params }) => {
    const body = (await request.json()) as FeedFolderUpdatePayload;
    const updated: FeedFolder = {
      ...mockFeedFolders[0],
      ...body,
      id: Number(params.id),
    };
    return HttpResponse.json(updated);
  }),
  http.delete("/api/feed-folders/:id", () => HttpResponse.json({ ok: true })),
];
