import { http, HttpResponse } from "msw";
import { API_BASE_URL } from "@/lib/api";
import type { ArticleListItem } from "@/lib/types";

export const mockArticles: ArticleListItem[] = [
  {
    id: 1,
    feed_id: 1,
    title: "Test Article",
    url: "https://example.com/article-1",
    author: "Test Author",
    published_at: "2026-02-28T10:00:00",
    is_read: false,
    categories: null,
    interest_score: null,
    quality_score: null,
    composite_score: null,
    score_reasoning: null,
    summary_preview: "A test article summary",
    scoring_state: "unscored",
    scored_at: null,
  },
];

export const articleHandlers = [
  http.get(`${API_BASE_URL}/api/articles`, () =>
    HttpResponse.json(mockArticles),
  ),
];
