import {
  ALL_ARTICLES_SELECTION,
  type Feed,
  type FeedFolder,
  type FeedSelection,
} from "@/lib/types";

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

/**
 * Fall back to "All articles" when the stored selection points at a feed or
 * folder that no longer exists. Returns the input unchanged while data is still
 * loading (empty arrays) to avoid clobbering a valid selection during fetch.
 */
export function resolveSelection(
  selection: FeedSelection,
  feeds: Feed[],
  folders: FeedFolder[],
): FeedSelection {
  if (selection.type === "feed") {
    if (feeds.length > 0 && !feeds.some((f) => f.id === selection.id)) {
      return ALL_ARTICLES_SELECTION;
    }
  } else if (selection.type === "folder") {
    if (folders.length > 0 && !folders.some((f) => f.id === selection.id)) {
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
  }
}
