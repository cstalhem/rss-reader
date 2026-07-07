"use client";

import { Inbox } from "lucide-react";
import { useMemo } from "react";

import { CategoryChip, ReadDot, ScoreChip } from "@/components/article-badges";
import { LoadMoreButton } from "@/components/load-more-button";
import { RatingControl } from "@/components/rating-control";
import { ErrorState } from "@/components/list-states";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
  dense,
  onOpen,
  onToggleRead,
}: {
  article: ArticleListItem;
  isLast: boolean;
  /** Desktop split-view density: `true` when the reader pane is open. */
  dense: boolean;
  onOpen: (article: ArticleListItem) => void;
  onToggleRead: (article: ArticleListItem) => void;
}) {
  const read = article.is_read;
  const categories = article.categories ?? [];
  const excerpt = article.summary_preview;
  const meta = `${article.feed_title} · ${formatAge(article.published_at)}`;
  return (
    <article
      onClick={() => onOpen(article)}
      className={cn(
        "cursor-pointer px-4 py-4",
        read && "opacity-60",
        !isLast && "border-border/50 border-b",
      )}
    >
      {/* Overline meta row — the dot is the read toggle. The meta stays here
          at every density and breakpoint (phone, dense, and desktop rest). */}
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
        <span className="truncate">{meta}</span>
      </div>

      <div className="min-w-0">
        <h3
          className={cn(
            "mt-1 font-serif text-xl leading-tight",
            !read && "font-semibold",
            // Dense: 2-line clamp at md:. Rest: single-line truncate at md:.
            dense ? "md:line-clamp-2 md:text-lg" : "md:truncate",
          )}
        >
          {article.title}
        </h3>

        {/* Excerpt is desktop-only and rest-state-only. */}
        {!dense && excerpt && (
          <p className="text-muted-foreground mt-1 hidden truncate text-sm md:block">
            {excerpt}
          </p>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {article.composite_score !== null && (
          <ScoreChip score={article.composite_score} />
        )}
        {categories.map((category) => (
          <CategoryChip
            key={category.id}
            label={category.display_name}
            needsTriage={category.needs_triage}
          />
        ))}
        {/* Rating toggles live inside the clickable row — stop propagation so a
            thumbs tap rates without also opening the reader. */}
        <div
          className="ml-auto"
          onClick={(e) => e.stopPropagation()}
          role="presentation"
        >
          <RatingControl articleId={article.id} rating={article.rating} />
        </div>
      </div>
    </article>
  );
}

interface ArticleListProps {
  selection: FeedSelection;
  onOpen: (article: ArticleListItem) => void;
  /**
   * Whether the reader pane is open. Drives the desktop split-view row density
   * (a prop, not a media query — phone rows are unaffected). `data-density`
   * exposes the resolved value for tests.
   */
  readerOpen?: boolean;
}

export function ArticleList({
  selection,
  onOpen,
  readerOpen = false,
}: ArticleListProps) {
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
    return <ErrorState message="Couldn't load articles. Retrying…" />;
  }

  if (articles.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Inbox />
            </EmptyMedia>
            <EmptyTitle>No articles</EmptyTitle>
            <EmptyDescription>
              Articles for this view will appear here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div
      className="h-full overflow-y-auto"
      data-density={readerOpen ? "dense" : "rest"}
    >
      {groups.map((group) => (
        <section key={group.label}>
          <h2 className="bg-background text-muted-foreground sticky top-0 z-[1] px-4 pt-4 pb-1 text-xs font-medium tracking-wide uppercase">
            {group.label}
          </h2>
          {group.items.map((article, i) => (
            <ArticleRow
              key={article.id}
              article={article}
              isLast={i === group.items.length - 1}
              dense={readerOpen}
              onOpen={onOpen}
              onToggleRead={toggleRead}
            />
          ))}
        </section>
      ))}

      {hasNextPage && (
        <LoadMoreButton
          isFetchingNextPage={isFetchingNextPage}
          onClick={() => fetchNextPage()}
        />
      )}
    </div>
  );
}
