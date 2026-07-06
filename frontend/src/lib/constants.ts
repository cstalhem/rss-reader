import {
  ChevronDown,
  ChevronUp,
  ChevronsUp,
  Minus,
  ShieldOff,
  type LucideIcon,
} from "lucide-react";

import type { CategoryWeight } from "./types";

/** Polling interval for feed and folder unread counts. */
export const FEED_STATE_POLL_INTERVAL = 10_000;

/** Page size for paginated article list queries. */
export const ARTICLES_PAGE_SIZE = 25;

/** Ordinal 5-value category weight scale, low → high. Order matters for the segmented control. */
export const CATEGORY_WEIGHTS = [
  "block",
  "reduce",
  "normal",
  "boost",
  "max",
] as const satisfies readonly CategoryWeight[];

/** Human labels for the category weight vocabulary. */
export const CATEGORY_WEIGHT_LABEL: Record<CategoryWeight, string> = {
  block: "Block",
  reduce: "Reduce",
  normal: "Normal",
  boost: "Boost",
  max: "Max",
};

/** Leading icon for each category weight vocabulary — pairs with CATEGORY_WEIGHT_LABEL. */
export const CATEGORY_WEIGHT_ICON: Record<CategoryWeight, LucideIcon> = {
  block: ShieldOff,
  reduce: ChevronDown,
  normal: Minus,
  boost: ChevronUp,
  max: ChevronsUp,
};

/** How long a triage Keep/Block decision stays undoable before the mutation fires. */
export const TRIAGE_UNDO_DELAY = 5_000;
