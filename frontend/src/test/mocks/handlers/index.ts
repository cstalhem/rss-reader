import { articleHandlers } from "./articles";
import { feedHandlers } from "./feeds";

export const handlers = [...feedHandlers, ...articleHandlers];
