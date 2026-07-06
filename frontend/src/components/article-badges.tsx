import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

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
    <Badge
      variant="secondary"
      className="rounded px-1.5 text-[11px] font-normal"
    >
      {score.toFixed(1)}
    </Badge>
  );
}

export function CategoryChip({
  label,
  needsTriage = false,
}: {
  label: string;
  needsTriage?: boolean;
}) {
  return (
    <Badge
      variant="outline"
      className="text-muted-foreground max-w-full items-center gap-1 truncate rounded px-1.5 text-[11px] font-normal"
    >
      {needsTriage && (
        <span
          className="bg-primary size-1.5 shrink-0 rounded-full"
          aria-hidden
        />
      )}
      {label}
    </Badge>
  );
}

/**
 * Editorial score readout for the reader header. A refined by-line-style stat
 * pair: the relevance figure leads in the theme orange with a tabular numeral,
 * quality sits beside it, each under a small uppercase Inter label. Renders
 * nothing when both scores are absent. Sans (`font-sans`) keeps the UI
 * micro-text distinct from the serif reading measure.
 */
export function ReaderScores({
  relevance,
  quality,
}: {
  relevance: number | null;
  quality: number | null;
}) {
  if (relevance === null && quality === null) return null;
  return (
    <dl className="flex items-stretch gap-5 font-sans">
      {relevance !== null && (
        <ScoreStat label="Relevance" value={relevance.toFixed(1)} accent />
      )}
      {relevance !== null && quality !== null && (
        <div className="border-border/60 border-l" aria-hidden />
      )}
      {quality !== null && (
        <ScoreStat label="Quality" value={`${quality}`} suffix="/10" />
      )}
    </dl>
  );
}

function ScoreStat({
  label,
  value,
  suffix,
  accent = false,
}: {
  label: string;
  value: string;
  suffix?: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-[10px] font-medium tracking-[0.14em] uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          "text-2xl leading-none font-semibold tabular-nums",
          accent && "text-primary",
        )}
      >
        {value}
        {suffix && (
          <span className="text-muted-foreground ml-0.5 text-sm font-normal">
            {suffix}
          </span>
        )}
      </dd>
    </div>
  );
}
