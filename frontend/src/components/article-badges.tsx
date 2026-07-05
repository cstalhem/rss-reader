import { cn } from "@/lib/utils";

/**
 * Small read-state / score / category tokens shared by the article list
 * rows and the reader's overline so the two surfaces can never drift apart.
 */

/** Filled accent dot = unread, hollow dot = read (project visual rule). */
export function ReadDot({ read }: { read: boolean }) {
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

export function ScoreChip({ score }: { score: number }) {
  return (
    <span className="bg-secondary text-secondary-foreground rounded px-1.5 py-0.5 text-[11px]">
      {score.toFixed(1)}
    </span>
  );
}

export function CategoryChip({ label }: { label: string }) {
  return (
    <span className="text-muted-foreground rounded border px-1.5 py-0.5 text-[11px]">
      {label}
    </span>
  );
}
