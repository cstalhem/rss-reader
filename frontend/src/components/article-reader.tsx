"use client";

import DOMPurify from "dompurify";
import { X } from "lucide-react";
import { useEffect, useMemo } from "react";

import {
  CategoryChip,
  ReadDot,
  ReaderScores,
} from "@/components/article-badges";
import { RatingControl } from "@/components/rating-control";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useArticle } from "@/hooks/useArticle";
import { useMarkRead } from "@/hooks/useMarkRead";
import { usePreferences } from "@/hooks/usePreferences";
import { formatAge } from "@/lib/utils";
import type { ArticleListItem } from "@/lib/types";

/** Fallback dwell threshold (seconds) when the preference hasn't loaded — issue #94 default. */
const DEFAULT_DWELL_SECONDS = 5;

interface ArticleReaderProps {
  /** The list item that was opened — supplies feed/meta/score fields immediately. */
  article: ArticleListItem;
  onClose: () => void;
  /** Test-only override; production reads the dwell from preferences (prop wins if provided). */
  dwellMs?: number;
}

export function ArticleReader({
  article,
  onClose,
  dwellMs,
}: ArticleReaderProps) {
  const detailQuery = useArticle(article.id);
  const markRead = useMarkRead();
  const { data: preferences } = usePreferences();

  // The prop is a test-only override; otherwise the configurable preference
  // (seconds → ms) drives the dwell, falling back to the #94 default.
  const resolvedDwellMs =
    dwellMs ??
    (preferences?.mark_read_dwell_seconds ?? DEFAULT_DWELL_SECONDS) * 1000;

  // Live rating tracks the cached detail (the rate mutation patches it),
  // falling back to the list item until the detail query resolves.
  const rating = detailQuery.data?.rating ?? article.rating;

  // Live read status tracks the cached detail (the mark-read mutation flips it),
  // falling back to the list item until the detail query resolves.
  const isRead = detailQuery.data?.is_read ?? article.is_read;

  const categories = article.categories ?? [];
  const rawBody = detailQuery.data
    ? (detailQuery.data.content ?? detailQuery.data.summary)
    : undefined;
  const bodyHtml = useMemo(
    () => (rawBody != null ? DOMPurify.sanitize(rawBody) : null),
    [rawBody],
  );

  // Esc closes the reader (listener mounted only while the reader is open).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Dwell auto-mark (#94): mark read `dwellMs` after the content is readable,
  // if the article was unread when opened. Never auto-marks unread, and never
  // marks an article whose content failed to load. The opened article is frozen
  // in shell state for the reader's lifetime, so `is_read`/`id` here reflect
  // open-time state; `mutate` (not the mutation object) is a stable ref.
  const markMutate = markRead.mutate;
  const articleId = article.id;
  const wasUnreadAtOpen = !article.is_read;
  const contentLoaded = detailQuery.isSuccess;
  useEffect(() => {
    if (!wasUnreadAtOpen || !contentLoaded) return;
    const timer = setTimeout(() => {
      markMutate({ id: articleId, isRead: true });
    }, resolvedDwellMs);
    return () => clearTimeout(timer);
  }, [articleId, wasUnreadAtOpen, contentLoaded, resolvedDwellMs, markMutate]);

  return (
    <div className="bg-background animate-in fade-in md:slide-in-from-right fixed inset-0 z-40 flex flex-col duration-200 md:static md:z-auto md:min-w-0 md:flex-1">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-5 pt-10 pb-24">
          <div className="mx-auto max-w-[68ch]">
            <div>
              {/* Overline: live read status + category chips, above the headline */}
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                <span className="text-muted-foreground mr-1 flex items-center gap-1.5 text-xs">
                  <ReadDot read={isRead} />
                  {isRead ? "Read" : "Unread"}
                </span>
                {categories.map((category) => (
                  <CategoryChip
                    key={category.id}
                    label={category.display_name}
                    needsTriage={category.needs_triage}
                  />
                ))}
                {/* Desktop close affordance — sits in the overline; mobile uses
                    the fixed bottom button below. */}
                <Button
                  variant="outline"
                  size="icon-lg"
                  className="ml-auto hidden rounded-full md:flex"
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                >
                  <X />
                </Button>
              </div>

              <h1 className="font-serif text-3xl leading-tight font-bold">
                {article.title}
              </h1>
              <p className="text-muted-foreground mt-2 text-sm">
                {article.feed_title} · {formatAge(article.published_at)}
              </p>

              <div className="mt-5 space-y-4">
                <div className="flex items-center gap-3">
                  <ReaderScores
                    relevance={article.composite_score}
                    quality={article.quality_score}
                  />
                  <RatingControl
                    articleId={article.id}
                    rating={rating}
                    className="ml-auto"
                  />
                </div>
                {article.score_reasoning !== null && (
                  <blockquote className="text-muted-foreground border-l-2 pl-3 font-serif text-sm italic">
                    {article.score_reasoning}
                  </blockquote>
                )}
              </div>
            </div>

            {detailQuery.isError ? (
              <p className="text-muted-foreground mt-8 text-sm">
                Couldn&apos;t load this article.{" "}
                <a
                  href={article.url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  Open the original
                </a>
              </p>
            ) : detailQuery.isPending ? (
              <div className="mt-8 space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[92%]" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[85%]" />
                <Skeleton className="h-4 w-[70%]" />
                <Skeleton className="mt-6 h-4 w-full" />
                <Skeleton className="h-4 w-[88%]" />
                <Skeleton className="h-4 w-[60%]" />
              </div>
            ) : bodyHtml === null ? (
              <p className="text-muted-foreground mt-8 text-sm">
                This article has no content.{" "}
                <a
                  href={article.url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  Open the original
                </a>
              </p>
            ) : (
              <div
                className="[&_blockquote]:text-muted-foreground [&_a]:text-primary [&_a]:decoration-primary/40 [&_a:hover]:decoration-primary mt-6 font-serif text-[17px] leading-[1.7] [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:italic [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_img]:max-w-full [&_li]:mt-1 [&_p]:mt-4 [&_pre]:overflow-x-auto [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-5"
                dangerouslySetInnerHTML={{ __html: bodyHtml }}
              />
            )}
          </div>
        </div>
      </div>
      <Button
        onClick={onClose}
        className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full shadow-lg md:hidden"
      >
        <X />
        Close
      </Button>
    </div>
  );
}
