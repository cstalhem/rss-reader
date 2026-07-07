"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Folder,
  FolderPen,
  Inbox,
  MoreHorizontal,
  Pencil,
  Plus,
  Rss,
  SatelliteDish,
  Settings,
  ShieldOff,
  Trash2,
} from "lucide-react";

import { useArticleCounts } from "@/hooks/useArticleCounts";
import { useFeeds } from "@/hooks/useFeeds";
import { useFeedFolders } from "@/hooks/useFeedFolders";
import { buildSidebarModel, type SidebarFolder } from "@/lib/sidebar";
import {
  isBlockedSelected,
  isFeedSelected,
  isFolderSelected,
} from "@/lib/selection";
import type { Feed, FeedSelection } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FeedManagementModal,
  type ManageModal,
} from "@/components/feed-management";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { ScoringStatusChip } from "@/components/scoring-status-chip";
import { ThemeToggle } from "@/components/theme-toggle";

/** De-emphasize fully-read feeds (unread === 0) per the read-visual convention. */
function feedOpacity(unread: number): string | undefined {
  return unread > 0 ? undefined : "opacity-60";
}

/** Deterministic skeleton widths — cycled by index so SSR and client agree (no hydration mismatch). */
const SKELETON_WIDTHS = ["60%", "75%", "50%", "85%", "65%"] as const;

/**
 * Active-row left border, matching the settings rail's active-section
 * indicator (`components/settings-shell.tsx`) exactly — same `bg-primary`
 * token and dimensions — so the two sidebars' "selected" treatment reads as
 * one shared visual language. Relies on the row's `SidebarMenuItem`/
 * `SidebarMenuSubItem` ancestor being `relative` (it is, by default).
 */
function ActiveIndicator() {
  return (
    <span
      className="bg-primary absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full"
      aria-hidden
    />
  );
}

/**
 * Right-aligned unread count rendered inside the menu button. Uses `opacity`
 * (not an explicit color) so it inherits the button's text color and stays
 * visible/legible in default, hover, and active states.
 */
function UnreadCount({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto shrink-0 text-xs font-medium tabular-nums opacity-70">
      {count}
    </span>
  );
}

/**
 * The global "All articles" badge. Server-computed total (`useArticleCounts`);
 * shows a skeleton while loading rather than a client-side sum, a muted dash if
 * the counts query fails, and nothing when there are no unread articles.
 */
function GlobalUnreadCount({
  count,
  isError,
}: {
  count: number | null;
  isError: boolean;
}) {
  if (isError) {
    return (
      <span
        className="ml-auto shrink-0 text-xs opacity-50"
        title="Couldn't load unread count"
      >
        –
      </span>
    );
  }
  if (count === null) {
    return <Skeleton className="ml-auto h-3 w-5 shrink-0 rounded" />;
  }
  return <UnreadCount count={count} />;
}

/**
 * Compact aggregator marker for sidebar rows — icon-only outline Badge with a
 * native `title` (no Tooltip component in list rows, per the perf rule).
 */
function AggregatorBadge() {
  return (
    <Badge
      variant="outline"
      title="Aggregator feed"
      className="text-muted-foreground px-1 py-0"
    >
      <SatelliteDish aria-hidden />
      <span className="sr-only">Aggregator feed</span>
    </Badge>
  );
}

/**
 * Always-visible ellipsis → actions menu for a feed row (touch-first, no
 * hover-only affordances). The row only fires `onOpenModal` — the modal state
 * itself is hoisted to the sidebar (one instance, not one per row).
 */
function FeedActionsMenu({
  feed,
  onOpenModal,
}: {
  feed: Feed;
  onOpenModal: (modal: ManageModal) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuAction aria-label={`Actions for ${feed.title}`}>
          <MoreHorizontal />
        </SidebarMenuAction>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {/* preventDefault on onSelect (canonical Radix guidance): stops the
            menu's focus-restore from racing the opening dialog's focus trap. */}
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            onOpenModal({ kind: "edit-feed", feed });
          }}
        >
          <Pencil /> Edit feed
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={(event) => {
            event.preventDefault();
            onOpenModal({ kind: "delete-feed", feed });
          }}
        >
          <Trash2 /> Delete feed
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Ellipsis → actions menu for a folder row (rename / delete). */
function FolderActionsMenu({
  folder,
  onOpenModal,
}: {
  folder: SidebarFolder;
  onOpenModal: (modal: ManageModal) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* after:-left-1 trims the mobile hit-area toward the adjacent
            collapse chevron so their expanded tap targets don't overlap. */}
        <SidebarMenuAction
          aria-label={`Actions for ${folder.name}`}
          className="after:-left-1"
        >
          <MoreHorizontal />
        </SidebarMenuAction>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {/* preventDefault on onSelect (canonical Radix guidance): stops the
            menu's focus-restore from racing the opening dialog's focus trap. */}
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            onOpenModal({ kind: "rename-folder", folder });
          }}
        >
          <FolderPen /> Rename folder
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={(event) => {
            event.preventDefault();
            onOpenModal({
              kind: "delete-folder",
              folder,
              feedCount: folder.feeds.length,
            });
          }}
        >
          <Trash2 /> Delete folder
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface AppSidebarProps {
  selection: FeedSelection;
  onSelect: (selection: FeedSelection) => void;
}

export function AppSidebar({ selection, onSelect }: AppSidebarProps) {
  const feedsQuery = useFeeds();
  const foldersQuery = useFeedFolders();
  const countsQuery = useArticleCounts();

  // One hoisted modal state for all management flows — rows just fire callbacks.
  const [modal, setModal] = useState<ManageModal | null>(null);

  const isLoading = feedsQuery.isPending || foldersQuery.isPending;
  const isError = feedsQuery.isError || foldersQuery.isError;

  const model = buildSidebarModel(
    feedsQuery.data ?? [],
    foldersQuery.data ?? [],
    countsQuery.data?.unread ?? null,
  );

  return (
    <Sidebar>
      {/* App wordmark. h-14 + border-b matches the article-list header so the
          two top bars align across the sidebar/content divide; the primary-color
          icon and semibold mark set it apart from the muted nav rows below. */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <Rss className="text-primary size-5" />
        <span className="text-base font-semibold tracking-tight">
          RSS Reader
        </span>
      </div>
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <SidebarMenu className="flex-1">
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                isActive={selection.type === "all"}
                onClick={() => onSelect({ type: "all" })}
              >
                {selection.type === "all" && <ActiveIndicator />}
                <Inbox className="size-4" />
                <span className="font-medium">All articles</span>
                <GlobalUnreadCount
                  count={model.totalUnread}
                  isError={countsQuery.isError}
                />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-12"
                aria-label="Add feed or folder"
              >
                <Plus />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* preventDefault on onSelect (canonical Radix guidance):
                  stops the menu's focus-restore from racing the opening
                  dialog's focus trap. */}
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  setModal({ kind: "add-feed" });
                }}
              >
                <Rss /> Add feed
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  setModal({ kind: "new-folder" });
                }}
              >
                <Folder /> New folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {isError ? (
          <SidebarGroup>
            <p className="text-muted-foreground px-2 text-sm">
              Couldn&apos;t load feeds. Retrying…
            </p>
          </SidebarGroup>
        ) : isLoading ? (
          <SidebarGroup>
            <SidebarMenu>
              {SKELETON_WIDTHS.map((width, i) => (
                <SidebarMenuItem key={i}>
                  <SidebarMenuSkeleton showIcon width={width} />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ) : (
          <>
            {model.folders.length > 0 && (
              <SidebarGroup>
                <SidebarGroupLabel>Folders</SidebarGroupLabel>
                <SidebarMenu>
                  {model.folders.map((folder) => (
                    <Collapsible
                      key={folder.id}
                      defaultOpen
                      className="group/collapsible"
                    >
                      <SidebarMenuItem>
                        {/*
                          Split select/toggle/manage: the button (name) selects
                          the folder, sibling SidebarMenuActions hold the
                          collapse chevron and the always-visible ellipsis menu.
                          Siblings (not nested) avoid a <button> inside a
                          <button>. The registry gutter (pr-8) only accounts
                          for one action, so widen it to clear both — same
                          variant stack so tailwind-merge dedupes. The ellipsis
                          sits at the registry position (right-1) to align with
                          feed-row ellipses; the chevron is offset inward.
                        */}
                        <SidebarMenuButton
                          isActive={isFolderSelected(selection, folder.id)}
                          onClick={() =>
                            onSelect({ type: "folder", id: folder.id })
                          }
                          className="group-has-data-[sidebar=menu-action]/menu-item:pr-14"
                        >
                          {isFolderSelected(selection, folder.id) && (
                            <ActiveIndicator />
                          )}
                          <Folder className="size-4 shrink-0" />
                          <span className="truncate" title={folder.name}>
                            {folder.name}
                          </span>
                          <UnreadCount count={folder.unread_count} />
                        </SidebarMenuButton>
                        <CollapsibleTrigger asChild>
                          {/* after:-right-1 trims the mobile hit-area toward
                              the ellipsis so their tap targets don't overlap. */}
                          <SidebarMenuAction
                            aria-label={`Toggle ${folder.name}`}
                            className="right-7 after:-right-1"
                          >
                            <ChevronRight className="transition-transform group-data-[state=open]/collapsible:rotate-90" />
                          </SidebarMenuAction>
                        </CollapsibleTrigger>
                        <FolderActionsMenu
                          folder={folder}
                          onOpenModal={setModal}
                        />
                        <CollapsibleContent>
                          <SidebarMenuSub className="mr-0 pr-0">
                            {folder.feeds.map((feed) => (
                              <SidebarMenuSubItem key={feed.id}>
                                <SidebarMenuSubButton
                                  isActive={isFeedSelected(selection, feed.id)}
                                  onClick={() =>
                                    onSelect({ type: "feed", id: feed.id })
                                  }
                                  className={feedOpacity(feed.unread_count)}
                                >
                                  {isFeedSelected(selection, feed.id) && (
                                    <ActiveIndicator />
                                  )}
                                  <Rss className="size-4 shrink-0" />
                                  <span className="truncate" title={feed.title}>
                                    {feed.title}
                                  </span>
                                  {feed.is_aggregator && <AggregatorBadge />}
                                  <UnreadCount count={feed.unread_count} />
                                </SidebarMenuSubButton>
                                <FeedActionsMenu
                                  feed={feed}
                                  onOpenModal={setModal}
                                />
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  ))}
                </SidebarMenu>
              </SidebarGroup>
            )}

            {model.rootFeeds.length > 0 && (
              <SidebarGroup>
                <SidebarGroupLabel>Feeds</SidebarGroupLabel>
                <SidebarMenu>
                  {model.rootFeeds.map((feed) => (
                    <SidebarMenuItem key={feed.id}>
                      <SidebarMenuButton
                        isActive={isFeedSelected(selection, feed.id)}
                        onClick={() => onSelect({ type: "feed", id: feed.id })}
                        className={feedOpacity(feed.unread_count)}
                      >
                        {isFeedSelected(selection, feed.id) && (
                          <ActiveIndicator />
                        )}
                        <Rss className="size-4 shrink-0" />
                        <span className="truncate" title={feed.title}>
                          {feed.title}
                        </span>
                        {feed.is_aggregator && <AggregatorBadge />}
                        <UnreadCount count={feed.unread_count} />
                      </SidebarMenuButton>
                      <FeedActionsMenu feed={feed} onOpenModal={setModal} />
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroup>
            )}

            <SidebarGroup>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isBlockedSelected(selection)}
                    onClick={() => onSelect({ type: "blocked" })}
                  >
                    <ShieldOff className="size-4" />
                    <span>Blocked</span>
                    <UnreadCount count={countsQuery.data?.blocked ?? 0} />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter>
        <ScoringStatusChip />
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start"
          asChild
        >
          <Link href="/settings">
            <Settings className="size-4" />
            <span>Settings</span>
          </Link>
        </Button>
        <ThemeToggle />
      </SidebarFooter>

      {/* Portals to body (Radix default) — works even when the sidebar is a mobile Sheet. */}
      <FeedManagementModal
        modal={modal}
        folders={model.folders}
        onClose={() => setModal(null)}
      />
    </Sidebar>
  );
}
