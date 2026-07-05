"use client"

import { ChevronRight, Folder, Inbox, Rss } from "lucide-react"

import { useFeeds } from "@/hooks/useFeeds"
import { useFeedFolders } from "@/hooks/useFeedFolders"
import { buildSidebarModel } from "@/lib/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"

/** De-emphasize fully-read feeds (unread === 0) per the read-visual convention. */
function feedOpacity(unread: number): string | undefined {
  return unread > 0 ? undefined : "opacity-60"
}

export function AppSidebar() {
  const feedsQuery = useFeeds()
  const foldersQuery = useFeedFolders()

  const isLoading = feedsQuery.isPending || foldersQuery.isPending
  const isError = feedsQuery.isError || foldersQuery.isError

  const model = buildSidebarModel(
    feedsQuery.data ?? [],
    foldersQuery.data ?? [],
  )

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" isActive>
              <Inbox className="size-4" />
              <span className="font-medium">All articles</span>
              {model.totalUnread > 0 && (
                <SidebarMenuBadge>{model.totalUnread}</SidebarMenuBadge>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {isError ? (
          <SidebarGroup>
            <p className="px-2 text-sm text-muted-foreground">
              Couldn&apos;t load feeds. Retrying…
            </p>
          </SidebarGroup>
        ) : isLoading ? (
          <SidebarGroup>
            <SidebarMenu>
              {Array.from({ length: 5 }).map((_, i) => (
                <SidebarMenuItem key={i}>
                  <SidebarMenuSkeleton showIcon />
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
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton>
                            <ChevronRight className="size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                            <Folder className="size-4" />
                            <span>{folder.name}</span>
                            {folder.unread_count > 0 && (
                              <SidebarMenuBadge>
                                {folder.unread_count}
                              </SidebarMenuBadge>
                            )}
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {folder.feeds.map((feed) => (
                              <SidebarMenuSubItem key={feed.id}>
                                <SidebarMenuSubButton
                                  className={feedOpacity(feed.unread_count)}
                                >
                                  <Rss className="size-4" />
                                  <span>{feed.title}</span>
                                </SidebarMenuSubButton>
                                {feed.unread_count > 0 && (
                                  <SidebarMenuBadge>
                                    {feed.unread_count}
                                  </SidebarMenuBadge>
                                )}
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
                        className={feedOpacity(feed.unread_count)}
                      >
                        <Rss className="size-4" />
                        <span>{feed.title}</span>
                        {feed.unread_count > 0 && (
                          <SidebarMenuBadge>
                            {feed.unread_count}
                          </SidebarMenuBadge>
                        )}
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
  )
}
