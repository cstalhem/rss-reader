"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { GroupSuggestionItem } from "@/lib/types";
import { cn } from "@/lib/utils";

/** A dropped child is keyed by `"<parentName>::<childName>"` so identically named children in different groups stay independent. */
function childKey(parent: string, child: string) {
  return `${parent}::${child}`;
}

/**
 * The auto-group review step: reject a whole proposed group, or drop individual
 * children. Apply submits the surviving desired state (each accepted group with
 * its kept children) to `useAutoGroupApply`. Nothing persists until Apply.
 */
export function AutoGroupReview({
  suggestions,
  isPending,
  onCancel,
  onApply,
}: {
  suggestions: GroupSuggestionItem[];
  isPending: boolean;
  onCancel: () => void;
  onApply: (groups: GroupSuggestionItem[]) => void;
}) {
  const [rejected, setRejected] = useState<Set<string>>(new Set());
  const [droppedChildren, setDroppedChildren] = useState<Set<string>>(
    new Set(),
  );

  const toggle = (set: Set<string>, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  };

  const surviving: GroupSuggestionItem[] = suggestions
    .filter((group) => !rejected.has(group.parent))
    .map((group) => ({
      parent: group.parent,
      children: group.children.filter(
        (child) => !droppedChildren.has(childKey(group.parent, child)),
      ),
    }))
    .filter((group) => group.children.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="bg-muted text-muted-foreground w-fit rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
          Step 2 of 2 · Review
        </span>
        <h3 className="text-base font-semibold">Review proposed groups</h3>
        <p className="text-muted-foreground text-sm">
          Accept or reject each proposed shelf, and drop any child that
          doesn&apos;t fit. Nothing is applied until you confirm.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {suggestions.map((group) => {
          const isRejected = rejected.has(group.parent);
          return (
            <section
              key={group.parent}
              className={cn(
                "border-border rounded-lg border transition-opacity",
                isRejected && "opacity-45",
              )}
            >
              <header className="border-border/60 flex items-center justify-between gap-2 border-b px-3 py-2">
                <h4 className="text-sm font-semibold">{group.parent}</h4>
                <Button
                  size="xs"
                  variant={isRejected ? "outline" : "ghost"}
                  onClick={() =>
                    setRejected((prev) => toggle(prev, group.parent))
                  }
                >
                  {isRejected ? "Rejected — restore" : "Reject"}
                </Button>
              </header>
              <ul className="divide-border/60 divide-y px-3">
                {group.children.map((child) => {
                  const key = childKey(group.parent, child);
                  const dropped = droppedChildren.has(key);
                  return (
                    <li
                      key={child}
                      className="flex items-center gap-2 py-2 text-sm"
                    >
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate",
                          dropped && "text-muted-foreground line-through",
                        )}
                      >
                        {child}
                      </span>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        aria-label={
                          dropped ? `Restore ${child}` : `Drop ${child}`
                        }
                        disabled={isRejected}
                        onClick={() =>
                          setDroppedChildren((prev) => toggle(prev, key))
                        }
                      >
                        {dropped ? <Check /> : <X />}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          disabled={isPending || surviving.length === 0}
          onClick={() => onApply(surviving)}
        >
          Apply {surviving.length} group{surviving.length === 1 ? "" : "s"}
        </Button>
      </div>
    </div>
  );
}
