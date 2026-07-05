"use client";

import DOMPurify from "dompurify";
import { Check } from "lucide-react";
import { useEffect, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useArticle } from "@/hooks/useArticle";
import { useMarkRead } from "@/hooks/useMarkRead";
import { cn, formatAge } from "@/lib/utils";
import type { ArticleListItem } from "@/lib/types";

/** Dwell threshold before auto-marking an opened article read — issue #94 decision. */
const MARK_READ_DWELL_MS = 3000;

function ReadDot({ read }: { read: boolean }) {
  return (
    <span
      className={cn(
        "size-2 rounded-full",
        read
          ? "border-muted-foreground/50 border bg-transparent"
          : "bg-primary",
      )}
    />
  );
}

function CategoryChip({ label }: { label: string }) {
  return (
    <span className="text-muted-foreground rounded border px-1.5 py-0.5 text-[11px]">
      {label}
    </span>
  );
}

interface ArticleReaderProps {
  /** The list item that was opened — supplies feed/meta/score fields immediately. */
  article: ArticleListItem;
  onClose: () => void;
  /** Overridable only for tests; production uses the #94-decided threshold. */
  dwellMs?: number;
}

export function ArticleReader({
  article,
  onClose,
  dwellMs = MARK_READ_DWELL_MS,
}: ArticleReaderProps) {
  const detailQuery = useArticle(article.id);
  const markRead = useMarkRead();

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

  // Dwell auto-mark (#94): mark read `dwellMs` after open if it was unread when
  // opened. Never auto-marks unread. The opened article is frozen in shell state
  // for the reader's lifetime, so `is_read`/`id` here reflect open-time state; the
  // timer re-arms per article. `mutate` (not the mutation object) is a stable ref.
  const markMutate = markRead.mutate;
  const articleId = article.id;
  const wasUnreadAtOpen = !article.is_read;
  useEffect(() => {
    if (!wasUnreadAtOpen) return;
    const timer = setTimeout(() => {
      markMutate({ id: articleId, isRead: true });
    }, dwellMs);
    return () => clearTimeout(timer);
  }, [articleId, wasUnreadAtOpen, dwellMs, markMutate]);

  return (
    <div className="bg-background animate-in fade-in fixed inset-0 z-40 flex flex-col duration-200">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-5 pt-10 pb-24">
          <div className="mx-auto max-w-[68ch]">
            {/* Overline: live read status + category chips, above the headline */}
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <span className="text-muted-foreground mr-1 flex items-center gap-1.5 text-xs">
                <ReadDot read={isRead} />
                {isRead ? "Read" : "Unread"}
              </span>
              {categories.map((category) => (
                <CategoryChip key={category.id} label={category.display_name} />
              ))}
            </div>

            <h1 className="font-serif text-3xl leading-tight font-bold">
              {article.title}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              {article.feed_title} · {formatAge(article.published_at)}
            </p>

            <div className="mt-4 space-y-3">
              {(article.composite_score !== null ||
                article.quality_score !== null) && (
                <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                  {article.composite_score !== null && (
                    <span>relevance {article.composite_score.toFixed(1)}</span>
                  )}
                  {article.quality_score !== null && (
                    <span>quality {article.quality_score}/10</span>
                  )}
                </div>
              )}
              {article.score_reasoning !== null && (
                <blockquote className="text-muted-foreground border-l-2 pl-3 font-serif text-sm italic">
                  {article.score_reasoning}
                </blockquote>
              )}
            </div>
          </div>

          {bodyHtml === null ? (
            <div className="mx-auto mt-8 max-w-[68ch] space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[92%]" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[85%]" />
              <Skeleton className="h-4 w-[70%]" />
              <Skeleton className="mt-6 h-4 w-full" />
              <Skeleton className="h-4 w-[88%]" />
              <Skeleton className="h-4 w-[60%]" />
            </div>
          ) : (
            <div
              className="[&_blockquote]:text-muted-foreground mx-auto mt-6 max-w-[68ch] font-serif text-[17px] leading-[1.7] [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:italic [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_img]:max-w-full [&_li]:mt-1 [&_p]:mt-4 [&_pre]:overflow-x-auto [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-5"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          )}
        </div>
      </div>
      <Button
        onClick={onClose}
        className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full shadow-lg"
      >
        <Check />
        Done
      </Button>
    </div>
  );
}

export { MARK_READ_DWELL_MS };
