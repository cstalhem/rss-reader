import { feedHandlers } from "./feeds";
import { articleHandlers } from "./articles";

export const handlers = [...feedHandlers, ...articleHandlers];
