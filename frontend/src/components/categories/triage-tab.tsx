"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronRight,
  Merge,
  MoreHorizontal,
  Pencil,
  ShieldOff,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCategories } from "@/hooks/useCategories";
import { useUpdateCategory } from "@/hooks/useUpdateCategory";
import { TRIAGE_UNDO_DELAY } from "@/lib/constants";
import type { Category, CategoryUpdatePayload } from "@/lib/types";
import { cn } from "@/lib/utils";

import { CategoryActionModals, type CategoryModal } from "./category-modals";
import { WeightIndicator } from "./weight-controls";

function TriageRow({
  category,
  onKeep,
  onBlock,
  onRename,
  onMerge,
}: {
  category: Category;
  onKeep: (category: Category) => void;
  onBlock: (category: Category) => void;
  onRename: (category: Category) => void;
  onMerge: (category: Category) => void;
}) {
  const [open, setOpen] = useState(false);

  const overflow = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`More actions for ${category.display_name}`}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            onRename(category);
          }}
        >
          <Pencil /> Rename
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            onMerge(category);
          }}
        >
          <Merge /> Merge
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="border-border rounded-lg border p-3">
        {/* Mobile: stacked */}
        <div className="flex flex-col gap-2.5 md:hidden">
          <div className="min-w-0">
            <h4 className="text-base leading-snug font-semibold">
              {category.display_name}
            </h4>
            <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
              <span className="tabular-nums">
                {category.article_count} articles
              </span>
              <span aria-hidden>·</span>
              <WeightIndicator weight={category.weight} />
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              className="flex-1"
              onClick={() => onKeep(category)}
            >
              <Check /> Keep
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="flex-1"
              onClick={() => onBlock(category)}
            >
              <ShieldOff /> Block
            </Button>
            {overflow}
          </div>
        </div>

        {/* Desktop: single row */}
        <div className="hidden items-center gap-2 md:flex">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="truncate font-medium">
              {category.display_name}
            </span>
            <span className="text-muted-foreground text-xs tabular-nums">
              {category.article_count} articles
            </span>
            <WeightIndicator weight={category.weight} />
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="sm" onClick={() => onKeep(category)}>
              <Check /> Keep
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onBlock(category)}
            >
              <ShieldOff /> Block
            </Button>
            {overflow}
          </div>
        </div>

        {category.sample_articles.length > 0 && (
          <>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground mt-2 flex items-center gap-1 text-xs"
              >
                <ChevronRight
                  className={cn(
                    "size-3.5 transition-transform",
                    open && "rotate-90",
                  )}
                />
                {open ? "Hide" : "Show"} sample articles
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="mt-2 flex flex-col gap-1.5 pl-4">
                {category.sample_articles.map((sample) => (
                  <li key={sample.id} className="text-sm">
                    <span className="line-clamp-1">{sample.title}</span>
                    <span className="text-muted-foreground text-xs">
                      {sample.feed_title}
                    </span>
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </>
        )}
      </div>
    </Collapsible>
  );
}

export function TriageTab() {
  const { data: categories, isLoading } = useCategories(true);
  const updateCategory = useUpdateCategory();
  const updateMutate = updateCategory.mutate;

  const [modal, setModal] = useState<CategoryModal | null>(null);

  // Deferred-commit undo: a Keep/Block optimistically removes the row from the
  // visible list and holds the real PATCH behind a timer. Undo clears the timer
  // so the server is never called. On unmount, all pending timers are flushed
  // (fired immediately) so a decision is never silently lost.
  const [pending, setPending] = useState<Set<number>>(new Set());
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  // Latest payload per pending id, so the flush-on-unmount can fire the PATCH.
  const payloadsRef = useRef<Map<number, CategoryUpdatePayload>>(new Map());

  const clearPending = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) clearTimeout(timer);
    timersRef.current.delete(id);
    payloadsRef.current.delete(id);
    setPending((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const commit = useCallback(
    (id: number, data: CategoryUpdatePayload) => {
      timersRef.current.delete(id);
      payloadsRef.current.delete(id);
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      updateMutate({ id, data });
    },
    [updateMutate],
  );

  const decide = useCallback(
    (category: Category, data: CategoryUpdatePayload, verb: string) => {
      setPending((prev) => new Set(prev).add(category.id));
      payloadsRef.current.set(category.id, data);
      const timer = setTimeout(
        () => commit(category.id, data),
        TRIAGE_UNDO_DELAY,
      );
      timersRef.current.set(category.id, timer);
      toast(`${verb} "${category.display_name}"`, {
        action: { label: "Undo", onClick: () => clearPending(category.id) },
      });
    },
    [commit, clearPending],
  );

  const handleKeep = useCallback(
    (category: Category) => decide(category, { needs_triage: false }, "Kept"),
    [decide],
  );
  const handleBlock = useCallback(
    (category: Category) =>
      decide(category, { weight: "block", needs_triage: false }, "Blocked"),
    [decide],
  );

  // Flush any pending timers on unmount so an in-flight decision still commits.
  useEffect(() => {
    const timers = timersRef.current;
    const payloads = payloadsRef.current;
    return () => {
      timers.forEach((timer, id) => {
        clearTimeout(timer);
        const data = payloads.get(id);
        if (data) updateMutate({ id, data });
      });
      timers.clear();
      payloads.clear();
    };
  }, [updateMutate]);

  const visible = (categories ?? []).filter((c) => !pending.has(c.id));
  const allCategories = categories ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h3 className="text-base font-semibold">New categories</h3>
        {visible.length > 0 && (
          <Badge variant="default" className="rounded-full">
            {visible.length} new
          </Badge>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No new categories to review. New ones appear here when the model tags
          articles with a category it hasn&apos;t used before.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-sm">
            These categories were auto-created and are already live at{" "}
            <span className="font-medium">Normal</span> weight. Confirm or
            adjust them.
          </p>
          {visible.map((category) => (
            <TriageRow
              key={category.id}
              category={category}
              onKeep={handleKeep}
              onBlock={handleBlock}
              onRename={(c) => setModal({ kind: "rename", source: c })}
              onMerge={(c) =>
                setModal({ kind: "merge", source: c, presetTarget: null })
              }
            />
          ))}
        </div>
      )}

      <CategoryActionModals
        modal={modal}
        allCategories={allCategories}
        onClose={() => setModal(null)}
        onSwitchToMerge={(source, target) =>
          setModal({ kind: "merge", source, presetTarget: target })
        }
      />
    </div>
  );
}
