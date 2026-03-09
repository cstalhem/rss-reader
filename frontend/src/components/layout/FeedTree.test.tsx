import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders, userEvent } from "@/test/utils";
import type { Feed, FeedFolder } from "@/lib/types";
import { FeedTree } from "./FeedTree";

function makeFeed(overrides: Partial<Feed>): Feed {
  return {
    id: 1,
    url: "https://example.com/feed.xml",
    title: "Feed One",
    last_fetched_at: null,
    display_order: 1,
    unread_count: 0,
    folder_id: null,
    folder_name: null,
    ...overrides,
  };
}

function makeFolder(overrides: Partial<FeedFolder>): FeedFolder {
  return {
    id: 10,
    name: "Folder One",
    display_order: 1,
    created_at: "2026-02-24T00:00:00",
    unread_count: 0,
    ...overrides,
  };
}

describe("FeedTree", () => {
  it("renders shared navigation items and selects feeds and folders", async () => {
    const onSelect = vi.fn();
    const folder = makeFolder({ unread_count: 3 });
    const folderFeed = makeFeed({
      id: 2,
      title: "Folder Feed",
      folder_id: folder.id,
      unread_count: 4,
    });
    const rootFeed = makeFeed({ id: 3, title: "Root Feed", unread_count: 2 });

    renderWithProviders(
      <FeedTree
        selection={{ kind: "all" }}
        totalUnread={9}
        rootItems={[
          { kind: "folder", order: 1, id: folder.id },
          { kind: "feed", order: 2, id: rootFeed.id },
        ]}
        orderedFolders={[folder]}
        feedsByFolder={new Map([[folder.id, [folderFeed]]])}
        ungroupedFeeds={[rootFeed]}
        expandedFolders={{ [folder.id]: true }}
        onSelect={onSelect}
        onToggleFolderExpanded={vi.fn()}
        onDeleteFeed={vi.fn()}
        onMarkAllRead={vi.fn()}
        onRenameFeed={vi.fn()}
        onMoveFeed={vi.fn()}
        folderFeedPadding={4}
        showDesktopActions={false}
        enableSwipeActions={true}
      />,
    );

    expect(screen.getByText("All Articles")).toBeInTheDocument();
    expect(screen.getByText("Folder One")).toBeInTheDocument();
    expect(screen.getByText("Folder Feed")).toBeInTheDocument();
    expect(screen.getByText("Root Feed")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByText("Folder One"));
    await user.click(screen.getByText("Root Feed"));

    expect(onSelect).toHaveBeenNthCalledWith(1, {
      kind: "folder",
      folderId: folder.id,
    });
    expect(onSelect).toHaveBeenNthCalledWith(2, {
      kind: "feed",
      feedId: rootFeed.id,
    });
  });

  it("toggles folders without selecting them", async () => {
    const onSelect = vi.fn();
    const onToggleFolderExpanded = vi.fn();
    const folder = makeFolder({});

    renderWithProviders(
      <FeedTree
        selection={{ kind: "all" }}
        totalUnread={0}
        rootItems={[{ kind: "folder", order: 1, id: folder.id }]}
        orderedFolders={[folder]}
        feedsByFolder={new Map()}
        ungroupedFeeds={[]}
        expandedFolders={{ [folder.id]: true }}
        onSelect={onSelect}
        onToggleFolderExpanded={onToggleFolderExpanded}
        onDeleteFeed={vi.fn()}
        onMarkAllRead={vi.fn()}
        onRenameFeed={vi.fn()}
        onMoveFeed={vi.fn()}
        folderFeedPadding={6}
        showDesktopActions={true}
        enableSwipeActions={false}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /collapse folder/i }));

    expect(onToggleFolderExpanded).toHaveBeenCalledWith(folder.id);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
