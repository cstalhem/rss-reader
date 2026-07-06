import { articleHandlers } from "./articles";
import { categoryHandlers } from "./categories";
import { feedHandlers } from "./feeds";

export const handlers = [
  ...feedHandlers,
  ...articleHandlers,
  ...categoryHandlers,
];
