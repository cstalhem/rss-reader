"use client"

import { ChevronRight, Folder, Inbox, Rss } from "lucide-react"

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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  folderUnread,
  folders,
  rootFeeds,
  totalUnread,
} from "@/components/app-sidebar-placeholder-data"

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" isActive>
              <Inbox className="size-4" />
              <span className="font-medium">All articles</span>
              {totalUnread > 0 && (
                <SidebarMenuBadge>{totalUnread}</SidebarMenuBadge>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Folders</SidebarGroupLabel>
          <SidebarMenu>
            {folders.map((folder) => {
              const unread = folderUnread(folder)
              return (
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
                        <span>{folder.title}</span>
                        {unread > 0 && (
                          <SidebarMenuBadge>{unread}</SidebarMenuBadge>
                        )}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {folder.feeds.map((feed) => (
                          <SidebarMenuSubItem key={feed.id}>
                            <SidebarMenuSubButton>
                              <Rss className="size-4" />
                              <span>{feed.title}</span>
                            </SidebarMenuSubButton>
                            {feed.unread > 0 && (
                              <SidebarMenuBadge>
                                {feed.unread}
                              </SidebarMenuBadge>
                            )}
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Feeds</SidebarGroupLabel>
          <SidebarMenu>
            {rootFeeds.map((feed) => (
              <SidebarMenuItem key={feed.id}>
                <SidebarMenuButton>
                  <Rss className="size-4" />
                  <span>{feed.title}</span>
                  {feed.unread > 0 && (
                    <SidebarMenuBadge>{feed.unread}</SidebarMenuBadge>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <ThemeToggle />
      </SidebarFooter>
    </Sidebar>
  )
}
