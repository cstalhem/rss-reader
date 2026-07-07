"use client";

import { useEffect, useState } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { ArticleList } from "@/components/article-list";
import { ArticleReader } from "@/components/article-reader";
import { BlockedView } from "@/components/blocked-view";
import { ReadFilterToggle } from "@/components/read-filter-toggle";
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
  type ReadFilter,
} from "@/lib/types";
import { cn } from "@/lib/utils";

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

  // Ephemeral read-state filter — resets to "unread" on every fresh load
  // (never persisted) and deliberately carries across scope switches within
  // a session, so no effect resets it on selection change.
  const [readFilter, setReadFilter] = useState<ReadFilter>("unread");

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
          {selection.type !== "blocked" && (
            <ReadFilterToggle
              value={readFilter}
              onChange={setReadFilter}
              className={cn(
                "md:static md:ml-auto",
                // Desktop: when the reader is open, clear its top-right close
                // button (article-reader.tsx: absolute top-4 right-4 size-9).
                // Mobile: hide the floating bar behind the full-screen reader.
                openArticle !== null && "max-md:hidden md:mr-14",
                // Floating segmented surface on mobile — the bg-muted track plus
                // border/shadow reads as an elevated bar over the scrolling list.
                "max-md:fixed max-md:bottom-6 max-md:left-1/2 max-md:z-30 max-md:-translate-x-1/2 max-md:border max-md:shadow-lg",
              )}
            />
          )}
        </header>
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
          {/* List column: full width by default; animates to a fixed 380px
              column at md: when the reader is open (phone stays full-bleed).
              cn keeps the width classes readable. */}
          <div
            className={cn(
              "min-h-0 flex-1 transition-[width] duration-300 md:flex-none",
              openArticle !== null
                ? "md:w-[380px] md:shrink-0 md:border-r"
                : "md:w-full",
            )}
          >
            {selection.type === "blocked" ? (
              <BlockedView onOpen={setOpenArticle} />
            ) : (
              <ArticleList
                selection={selection}
                filter={readFilter}
                onOpen={setOpenArticle}
                readerOpen={openArticle !== null}
              />
            )}
          </div>
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
