"use client";

import { ChevronRight, Folder, Inbox, Rss } from "lucide-react";

import { useArticleCounts } from "@/hooks/useArticleCounts";
import { useFeeds } from "@/hooks/useFeeds";
import { useFeedFolders } from "@/hooks/useFeedFolders";
import { buildSidebarModel } from "@/lib/sidebar";
import { isFeedSelected, isFolderSelected } from "@/lib/selection";
import type { FeedSelection } from "@/lib/types";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { ThemeToggle } from "@/components/theme-toggle";

/** De-emphasize fully-read feeds (unread === 0) per the read-visual convention. */
function feedOpacity(unread: number): string | undefined {
  return unread > 0 ? undefined : "opacity-60";
}

/** Deterministic skeleton widths — cycled by index so SSR and client agree (no hydration mismatch). */
const SKELETON_WIDTHS = ["60%", "75%", "50%", "85%", "65%"] as const;

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
 * shows a skeleton while loading rather than a client-side sum, and nothing when
 * there are no unread articles.
 */
function GlobalUnreadCount({ count }: { count: number | null }) {
  if (count === null) {
    return <Skeleton className="ml-auto h-3 w-5 shrink-0 rounded" />;
  }
  return <UnreadCount count={count} />;
}

interface AppSidebarProps {
  selection: FeedSelection;
  onSelect: (selection: FeedSelection) => void;
}

export function AppSidebar({ selection, onSelect }: AppSidebarProps) {
  const feedsQuery = useFeeds();
  const foldersQuery = useFeedFolders();
  const countsQuery = useArticleCounts();

  const isLoading = feedsQuery.isPending || foldersQuery.isPending;
  const isError = feedsQuery.isError || foldersQuery.isError;

  const model = buildSidebarModel(
    feedsQuery.data ?? [],
    foldersQuery.data ?? [],
    countsQuery.data?.unread ?? null,
  );

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              isActive={selection.type === "all"}
              onClick={() => onSelect({ type: "all" })}
            >
              <Inbox className="size-4" />
              <span className="font-medium">All articles</span>
              <GlobalUnreadCount count={model.totalUnread} />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
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
                          Split select/toggle: the button (name) selects the
                          folder, the sibling SidebarMenuAction (chevron) toggles
                          expansion. Keeping them as siblings (not nested) avoids
                          a <button> inside a <button> — the a11y/HTML-validity
                          win. The registry button reserves a right gutter
                          (pr-8) whenever a menu-action is present, so the count
                          sits left of the chevron.
                        */}
                        <SidebarMenuButton
                          isActive={isFolderSelected(selection, folder.id)}
                          onClick={() =>
                            onSelect({ type: "folder", id: folder.id })
                          }
                        >
                          <Folder className="size-4 shrink-0" />
                          <span className="truncate" title={folder.name}>
                            {folder.name}
                          </span>
                          <UnreadCount count={folder.unread_count} />
                        </SidebarMenuButton>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuAction
                            aria-label={`Toggle ${folder.name}`}
                          >
                            <ChevronRight className="transition-transform group-data-[state=open]/collapsible:rotate-90" />
                          </SidebarMenuAction>
                        </CollapsibleTrigger>
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
                                  <Rss className="size-4 shrink-0" />
                                  <span className="truncate" title={feed.title}>
                                    {feed.title}
                                  </span>
                                  <UnreadCount count={feed.unread_count} />
                                </SidebarMenuSubButton>
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
                        <Rss className="size-4 shrink-0" />
                        <span className="truncate" title={feed.title}>
                          {feed.title}
                        </span>
                        <UnreadCount count={feed.unread_count} />
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroup>
            )}
          </>
        )}
      </SidebarContent>

      <SidebarFooter>
        <ThemeToggle />
      </SidebarFooter>
    </Sidebar>
  );
}
