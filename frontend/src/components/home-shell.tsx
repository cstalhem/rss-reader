"use client";

import { useEffect, useState } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { ArticleList } from "@/components/article-list";
import { ArticleReader } from "@/components/article-reader";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useFeeds } from "@/hooks/useFeeds";
import { useFeedFolders } from "@/hooks/useFeedFolders";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  isFeedSelection,
  resolveSelection,
  selectionName,
} from "@/lib/selection";
import {
  ALL_ARTICLES_SELECTION,
  type ArticleListItem,
  type FeedSelection,
} from "@/lib/types";

const SELECTION_STORAGE_KEY = "rss-reader:selection";

export function HomeShell() {
  const [stored, setStored] = useLocalStorage<FeedSelection>(
    SELECTION_STORAGE_KEY,
    ALL_ARTICLES_SELECTION,
    isFeedSelection,
  );

  const feedsQuery = useFeeds();
  const foldersQuery = useFeedFolders();
  const feeds = feedsQuery.data ?? [];
  const folders = foldersQuery.data ?? [];

  // The open article is shell-level UI state (URL state is a later milestone).
  const [openArticle, setOpenArticle] = useState<ArticleListItem | null>(null);

  // Fall back to All articles if the stored selection points at a
  // feed/folder that no longer exists (validated once data has loaded).
  const selection = resolveSelection(stored, feeds, folders, {
    feedsLoaded: feedsQuery.isSuccess,
    foldersLoaded: foldersQuery.isSuccess,
  });
  const header = selectionName(selection, feeds, folders);

  // Persist a healed selection back to storage so the stale id doesn't linger.
  // Legitimate external-system sync (localStorage); guarded on inequality so it
  // runs once per heal, never in a loop.
  useEffect(() => {
    if (selection !== stored) {
      setStored(selection);
    }
  }, [selection, stored, setStored]);

  return (
    <SidebarProvider>
      <AppSidebar selection={selection} onSelect={setStored} />
      {/* The h-svh/min-h-0 constrained-height chain is the #93 shell decision. */}
      <SidebarInset className="h-svh overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <h1 className="text-sm font-medium">{header}</h1>
        </header>
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ArticleList selection={selection} onOpen={setOpenArticle} />
          {openArticle !== null && (
            <ArticleReader
              article={openArticle}
              onClose={() => setOpenArticle(null)}
            />
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
