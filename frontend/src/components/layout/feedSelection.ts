import {
  ALL_FEEDS_SELECTION,
  Feed,
  FeedFolder,
  FeedSelection,
} from "@/lib/types";

export const FEED_SELECTION_STORAGE_KEY = "feed-selection";

export function parseStoredFeedSelection(raw: string | null): FeedSelection | null {
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const selection = parsed as Partial<FeedSelection> & {
      kind?: string;
    };

    if (selection.kind === "all") {
      return ALL_FEEDS_SELECTION;
    }

    if (selection.kind === "feed" && typeof selection.feedId === "number") {
      return { kind: "feed", feedId: selection.feedId };
    }

    if (
      selection.kind === "folder" &&
      typeof selection.folderId === "number"
    ) {
      return { kind: "folder", folderId: selection.folderId };
    }
  } catch {
    return null;
  }

  return null;
}

export function validateFeedSelection(
  selection: FeedSelection,
  feeds: Feed[] | undefined,
  folders: FeedFolder[] | undefined
): FeedSelection {
  if (selection.kind === "feed") {
    if (!feeds) return selection;
    const exists = feeds.some((feed) => feed.id === selection.feedId);
    return exists ? selection : ALL_FEEDS_SELECTION;
  }

  if (selection.kind === "folder") {
    if (!folders) return selection;
    const exists = folders.some((folder) => folder.id === selection.folderId);
    return exists ? selection : ALL_FEEDS_SELECTION;
  }

  return ALL_FEEDS_SELECTION;
}

export function shouldShowFolderUnreadBadge(unreadCount: number): boolean {
  return unreadCount > 0;
}
