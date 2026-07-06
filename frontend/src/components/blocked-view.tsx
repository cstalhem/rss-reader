"use client";

import { LifeBuoy, ShieldOff } from "lucide-react";
import { useMemo } from "react";

import { LoadMoreButton } from "@/components/load-more-button";
import { EmptyState, ErrorState } from "@/components/list-states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBlockedArticles } from "@/hooks/useBlockedArticles";
import { useRescueArticle } from "@/hooks/useRescueArticle";
import { groupBlockedArticles, otherBlockingCategories } from "@/lib/blocked";
import { cn, formatAge } from "@/lib/utils";
import type { ArticleListItem } from "@/lib/types";

/** How many skeleton rows to show while the first page loads. */
const SKELETON_ROW_COUNT = 6;

function BlockedRow({
  article,
  groupName,
  isLast,
  onOpen,
  onRescue,
}: {
  article: ArticleListItem;
  groupName: string;
  isLast: boolean;
  onOpen: (article: ArticleListItem) => void;
  onRescue: (id: number) => void;
}) {
  const also = otherBlockingCategories(article, groupName);
  const meta = `${article.feed_title} · ${formatAge(article.published_at)}`;
  return (
    <article
      onClick={() => onOpen(article)}
      className={cn(
        "flex cursor-pointer items-center gap-2 px-4 py-2 opacity-60",
        !isLast && "border-border/50 border-b",
      )}
    >
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-serif text-base leading-snug">
          {article.title}
        </h3>
        <p className="text-muted-foreground truncate text-xs">
          {meta}
          {also.length > 0 && (
            <span className="text-destructive/70">
              {" "}
              · also blocked by {also.join(", ")}
            </span>
          )}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Rescue "${article.title}"`}
        className="size-11 shrink-0 rounded-full md:h-9 md:w-auto md:gap-1.5 md:rounded-md md:px-3"
        onClick={(e) => {
          e.stopPropagation();
          onRescue(article.id);
        }}
      >
        <LifeBuoy className="size-5 md:size-4" />
        <span className="hidden md:inline">Rescue</span>
      </Button>
    </article>
  );
}

interface BlockedViewProps {
  onOpen: (article: ArticleListItem) => void;
}

export function BlockedView({ onOpen }: BlockedViewProps) {
  const {
    articles,
    isPending,
    isError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useBlockedArticles();
  const rescue = useRescueArticle();

  const groups = useMemo(() => groupBlockedArticles(articles), [articles]);

  if (isPending) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="space-y-6 p-4">
          {Array.from({ length: SKELETON_ROW_COUNT }, (_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-5 w-[85%]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return <ErrorState message="Couldn't load blocked articles. Retrying…" />;
  }

  if (articles.length === 0) {
    return <EmptyState icon={ShieldOff} title="No blocked articles" />;
  }

  return (
    <div className="h-full overflow-y-auto">
      {groups.map((group) => (
        <section key={group.name}>
          <h2 className="bg-background sticky top-0 z-[1] flex items-baseline gap-2 px-4 pt-4 pb-1.5">
            <span className="text-destructive/80 text-xs font-semibold tracking-wide uppercase">
              {group.name}
            </span>
            <span className="text-muted-foreground text-xs">
              {group.articles.length} article
              {group.articles.length === 1 ? "" : "s"}
            </span>
          </h2>
          {group.articles.map((article, i) => (
            <BlockedRow
              key={article.id}
              article={article}
              groupName={group.name}
              isLast={i === group.articles.length - 1}
              onOpen={onOpen}
              onRescue={rescue.mutate}
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
