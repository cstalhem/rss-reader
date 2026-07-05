import type { Feed, FeedFolder } from "@/lib/types";

/** A folder plus the feeds nested under it, ordered for display. */
export interface SidebarFolder extends FeedFolder {
  feeds: Feed[];
}

/** The ordered model the sidebar renders. */
export interface SidebarModel {
  folders: SidebarFolder[];
  rootFeeds: Feed[];
  /** Server-computed global unread; `null` while the counts query is loading. */
  totalUnread: number | null;
}

/** Order by `display_order`, then `id` — matching the backend's `GET /api/feeds` ordering. */
function byDisplayOrder<T extends { display_order: number; id: number }>(
  a: T,
  b: T,
): number {
  return a.display_order - b.display_order || a.id - b.id;
}

/**
 * Shape live feeds/folders into the ordered sidebar model.
 *
 * Folder unread counts come straight from the folders endpoint (server-computed)
 * and are never recomputed from feed data. `globalUnread` is the server-computed
 * total (from the counts endpoint) — passed through verbatim, never derived from
 * article data. Pass `null` while the counts query is loading.
 */
export function buildSidebarModel(
  feeds: Feed[],
  folders: FeedFolder[],
  globalUnread: number | null,
): SidebarModel {
  const sortedFolders = [...folders].sort(byDisplayOrder);
  const sortedFeeds = [...feeds].sort(byDisplayOrder);

  const feedsByFolder = new Map<number, Feed[]>();
  const rootFeeds: Feed[] = [];
  for (const feed of sortedFeeds) {
    if (feed.folder_id === null) {
      rootFeeds.push(feed);
    } else {
      const bucket = feedsByFolder.get(feed.folder_id);
      if (bucket) {
        bucket.push(feed);
      } else {
        feedsByFolder.set(feed.folder_id, [feed]);
      }
    }
  }

  const modelFolders: SidebarFolder[] = sortedFolders.map((folder) => ({
    ...folder,
    feeds: feedsByFolder.get(folder.id) ?? [],
  }));

  return { folders: modelFolders, rootFeeds, totalUnread: globalUnread };
}
