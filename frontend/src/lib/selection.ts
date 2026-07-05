import {
  ALL_ARTICLES_SELECTION,
  type Feed,
  type FeedFolder,
  type FeedSelection,
} from "@/lib/types";

/**
 * Type guard for a `FeedSelection`, used to validate JSON read from storage.
 * The discriminant must be one of the known kinds, and feed/folder selections
 * must carry a numeric `id`.
 */
export function isFeedSelection(value: unknown): value is FeedSelection {
  if (typeof value !== "object" || value === null) return false;
  const { type } = value as { type?: unknown };
  if (type === "all") return true;
  if (type === "feed" || type === "folder") {
    return typeof (value as { id?: unknown }).id === "number";
  }
  return false;
}

/** True when `selection` targets this feed. */
export function isFeedSelected(
  selection: FeedSelection,
  feedId: number,
): boolean {
  return selection.type === "feed" && selection.id === feedId;
}

/** True when `selection` targets this folder. */
export function isFolderSelected(
  selection: FeedSelection,
  folderId: number,
): boolean {
  return selection.type === "folder" && selection.id === folderId;
}

/** Whether the feed/folder lists have finished loading (query `isSuccess`). */
export interface SelectionDataStatus {
  feedsLoaded: boolean;
  foldersLoaded: boolean;
}

/**
 * Fall back to "All articles" when the stored selection points at a feed or
 * folder that no longer exists. Loading is passed in explicitly (not inferred
 * from empty arrays): while the relevant list is not loaded the stored
 * selection is kept to avoid clobbering it during fetch; once loaded, an absent
 * id — including when the list is genuinely empty — falls back to All articles.
 */
export function resolveSelection(
  selection: FeedSelection,
  feeds: Feed[],
  folders: FeedFolder[],
  { feedsLoaded, foldersLoaded }: SelectionDataStatus,
): FeedSelection {
  if (selection.type === "feed") {
    if (feedsLoaded && !feeds.some((f) => f.id === selection.id)) {
      return ALL_ARTICLES_SELECTION;
    }
  } else if (selection.type === "folder") {
    if (foldersLoaded && !folders.some((f) => f.id === selection.id)) {
      return ALL_ARTICLES_SELECTION;
    }
  }
  return selection;
}

/** Human-readable name of the selected scope, for the main-pane header. */
export function selectionName(
  selection: FeedSelection,
  feeds: Feed[],
  folders: FeedFolder[],
): string {
  switch (selection.type) {
    case "all":
      return "All articles";
    case "feed":
      return feeds.find((f) => f.id === selection.id)?.title ?? "All articles";
    case "folder":
      return folders.find((f) => f.id === selection.id)?.name ?? "All articles";
    default:
      // Defense in depth: any unexpected discriminant reads as All articles.
      return "All articles";
  }
}
