"use client";

import { Inbox } from "lucide-react";
import { useMemo } from "react";

import { CategoryChip, ReadDot, ScoreChip } from "@/components/article-badges";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useArticles } from "@/hooks/useArticles";
import { useMarkRead } from "@/hooks/useMarkRead";
import { cn, formatAge, parseServerDate } from "@/lib/utils";
import type { ArticleListItem, FeedSelection } from "@/lib/types";

type GroupLabel = "Today" | "Yesterday" | "Earlier";

const GROUP_ORDER: GroupLabel[] = ["Today", "Yesterday", "Earlier"];

/** How many skeleton rows to show while the first page loads. */
const SKELETON_ROW_COUNT = 6;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Bucket by published date. Null/invalid dates fall into "Earlier". */
function groupFor(publishedAt: string | null): GroupLabel {
  if (!publishedAt) return "Earlier";
  const published = parseServerDate(publishedAt);
  if (Number.isNaN(published.getTime())) return "Earlier";
  const now = new Date();
  const todayStart = startOfDay(now);
  // Date-field arithmetic, not a fixed 24h offset — DST days are 23/25h long.
  const yesterdayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1,
  ).getTime();
  const day = startOfDay(published);
  if (day >= todayStart) return "Today";
  if (day >= yesterdayStart) return "Yesterday";
  return "Earlier";
}

function ArticleRow({
  article,
  isLast,
  onOpen,
  onToggleRead,
}: {
  article: ArticleListItem;
  isLast: boolean;
  onOpen: (article: ArticleListItem) => void;
  onToggleRead: (article: ArticleListItem) => void;
}) {
  const read = article.is_read;
  const categories = article.categories ?? [];
  return (
    <article
      onClick={() => onOpen(article)}
      className={cn(
        "cursor-pointer px-4 py-4",
        read && "opacity-60",
        !isLast && "border-border/50 border-b",
      )}
    >
      {/* Overline meta row — the dot is the read toggle */}
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <button
          type="button"
          aria-label={read ? "Mark as unread" : "Mark as read"}
          className="-m-3 flex size-10 shrink-0 items-center justify-center"
          onClick={(e) => {
            e.stopPropagation();
            onToggleRead(article);
          }}
        >
          <ReadDot read={read} />
        </button>
        <span className="truncate">
          {article.feed_title} · {formatAge(article.published_at)}
        </span>
      </div>

      <h3
        className={cn(
          "mt-1 font-serif text-xl leading-tight",
          !read && "font-semibold",
        )}
      >
        {article.title}
      </h3>

      {(article.composite_score !== null || categories.length > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {article.composite_score !== null && (
            <ScoreChip score={article.composite_score} />
          )}
          {categories.map((category) => (
            <CategoryChip key={category.id} label={category.display_name} />
          ))}
        </div>
      )}
    </article>
  );
}

interface ArticleListProps {
  selection: FeedSelection;
  onOpen: (article: ArticleListItem) => void;
}

export function ArticleList({ selection, onOpen }: ArticleListProps) {
  const {
    articles,
    isPending,
    isError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useArticles(selection);
  const markRead = useMarkRead();

  const toggleRead = (article: ArticleListItem) => {
    markRead.mutate({ id: article.id, isRead: !article.is_read });
  };

  // Recompute buckets only when the article set changes — not on every
  // mark-read re-render of a long loaded list.
  const groups = useMemo(
    () =>
      GROUP_ORDER.map((label) => ({
        label,
        items: articles.filter((a) => groupFor(a.published_at) === label),
      })).filter((g) => g.items.length > 0),
    [articles],
  );

  if (isPending) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="space-y-6 p-4">
          {Array.from({ length: SKELETON_ROW_COUNT }, (_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-6 w-[85%]" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-muted-foreground text-sm">
          Couldn&apos;t load articles. Retrying…
        </p>
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <Inbox className="text-muted-foreground size-8" />
        <p className="font-medium">No articles</p>
        <p className="text-muted-foreground text-sm">
          Articles for this view will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      {groups.map((group) => (
        <section key={group.label}>
          <h2 className="bg-background text-muted-foreground sticky top-0 px-4 pt-4 pb-1 text-xs font-medium tracking-wide uppercase">
            {group.label}
          </h2>
          {group.items.map((article, i) => (
            <ArticleRow
              key={article.id}
              article={article}
              isLast={i === group.items.length - 1}
              onOpen={onOpen}
              onToggleRead={toggleRead}
            />
          ))}
        </section>
      ))}

      {hasNextPage && (
        <div className="p-4">
          <Button
            variant="ghost"
            className="w-full"
            disabled={isFetchingNextPage}
            onClick={() => fetchNextPage()}
          >
            {isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
