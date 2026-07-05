import { parseServerDate } from "@/lib/utils";
import type { ArticleCategory, ArticleListItem } from "@/lib/types";

/** Label for the fallback group: block-weight category was reweighted after the article was blocked. */
export const NO_LONGER_BLOCKED_GROUP = "No longer blocked";

/** An article's blocking categories, derived client-side from its own category weights. */
function blockingCategories(article: ArticleListItem): ArticleCategory[] {
  return (article.categories ?? []).filter(
    (category) => category.effective_weight === "block",
  );
}

export interface BlockedGroup {
  /** Category display name, or `NO_LONGER_BLOCKED_GROUP` for the fallback bucket. */
  name: string;
  articles: ArticleListItem[];
}

/**
 * Group blocked articles by blocking category (newest first within each
 * group). An article with multiple blocking categories appears in each of
 * its groups; one with none (category reweighted since it was blocked) goes
 * into the fallback group. Group order follows first appearance, with the
 * fallback group always last.
 */
export function groupBlockedArticles(
  articles: ArticleListItem[],
): BlockedGroup[] {
  const sorted = [...articles].sort((a, b) => {
    const aTime = a.published_at
      ? parseServerDate(a.published_at).getTime()
      : 0;
    const bTime = b.published_at
      ? parseServerDate(b.published_at).getTime()
      : 0;
    return bTime - aTime;
  });

  const groups = new Map<string, ArticleListItem[]>();
  for (const article of sorted) {
    const categories = blockingCategories(article);
    const names =
      categories.length > 0
        ? categories.map((c) => c.display_name)
        : [NO_LONGER_BLOCKED_GROUP];
    for (const name of names) {
      const bucket = groups.get(name);
      if (bucket) {
        bucket.push(article);
      } else {
        groups.set(name, [article]);
      }
    }
  }

  // Fallback group always sorts last regardless of first-appearance order.
  const entries = [...groups.entries()];
  entries.sort((a, b) => {
    if (a[0] === NO_LONGER_BLOCKED_GROUP) return 1;
    if (b[0] === NO_LONGER_BLOCKED_GROUP) return -1;
    return 0;
  });

  return entries.map(([name, groupArticles]) => ({
    name,
    articles: groupArticles,
  }));
}

/** Other blocking-category names for an article, excluding `current` — for the "also blocked by" note. */
export function otherBlockingCategories(
  article: ArticleListItem,
  current: string,
): string[] {
  return blockingCategories(article)
    .map((c) => c.display_name)
    .filter((name) => name !== current);
}
