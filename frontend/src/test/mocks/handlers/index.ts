import { articleHandlers } from "./articles";
import { categoryHandlers } from "./categories";
import { feedHandlers } from "./feeds";
import { preferenceHandlers } from "./preferences";
import { scoringHandlers } from "./scoring";

export const handlers = [
  ...feedHandlers,
  ...articleHandlers,
  ...categoryHandlers,
  ...preferenceHandlers,
  ...scoringHandlers,
];
