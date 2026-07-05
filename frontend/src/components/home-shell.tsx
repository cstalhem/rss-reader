"use client"

import { useEffect } from "react"
import { Inbox } from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { useFeeds } from "@/hooks/useFeeds"
import { useFeedFolders } from "@/hooks/useFeedFolders"
import { useLocalStorage } from "@/hooks/useLocalStorage"
import {
  isFeedSelection,
  resolveSelection,
  selectionName,
} from "@/lib/selection"
import { ALL_ARTICLES_SELECTION, type FeedSelection } from "@/lib/types"

const SELECTION_STORAGE_KEY = "rss-reader:selection"

export function HomeShell() {
  const [stored, setStored] = useLocalStorage<FeedSelection>(
    SELECTION_STORAGE_KEY,
    ALL_ARTICLES_SELECTION,
    isFeedSelection,
  )

  const feedsQuery = useFeeds()
  const foldersQuery = useFeedFolders()
  const feeds = feedsQuery.data ?? []
  const folders = foldersQuery.data ?? []

  // Fall back to All articles if the stored selection points at a
  // feed/folder that no longer exists (validated once data has loaded).
  const selection = resolveSelection(stored, feeds, folders, {
    feedsLoaded: feedsQuery.isSuccess,
    foldersLoaded: foldersQuery.isSuccess,
  })
  const header = selectionName(selection, feeds, folders)

  // Persist a healed selection back to storage so the stale id doesn't linger.
  // Legitimate external-system sync (localStorage); guarded on inequality so it
  // runs once per heal, never in a loop.
  useEffect(() => {
    if (selection !== stored) {
      setStored(selection)
    }
  }, [selection, stored, setStored])

  return (
    <SidebarProvider>
      <AppSidebar selection={selection} onSelect={setStored} />
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <h1 className="text-sm font-medium">{header}</h1>
        </header>
        <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <Inbox className="size-10 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">No articles</p>
            <p className="text-sm text-muted-foreground">
              Articles for this view will appear here.
            </p>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
