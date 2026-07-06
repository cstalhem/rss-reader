import { http, HttpResponse } from "msw";
import type { Article, ArticleCounts, ArticleListItem } from "@/lib/types";

const TOTAL_ARTICLES = 32;
const FEED_A_ID = 1;
const FEED_B_ID = 2;

/** Fixture matching the backend `ArticleListItem` shape exactly. 32 unread items split across two feeds. */
export const mockArticles: ArticleListItem[] = Array.from(
  { length: TOTAL_ARTICLES },
  (_, i) => {
    const id = i + 1;
    const feedId = id % 2 === 0 ? FEED_A_ID : FEED_B_ID;
    return {
      id,
      feed_id: feedId,
      feed_title: feedId === FEED_A_ID ? "Feed A" : "Feed B",
      title: `Article ${id}`,
      url: `https://example.com/articles/${id}`,
      author: null,
      published_at: "2026-07-01T00:00:00",
      is_read: false,
      categories: null,
      interest_score: null,
      quality_score: null,
      composite_score: null,
      score_reasoning: null,
      summary_preview: `Preview of article ${id}`,
      scoring_state: "scored",
      scored_at: null,
      re_evaluating: false,
    };
  },
);

/** Fixture matching the backend `ArticleResponse` shape exactly. */
export const mockArticleDetail: Article = {
  id: 1,
  feed_id: FEED_B_ID,
  title: "Article 1",
  url: "https://example.com/articles/1",
  author: null,
  published_at: "2026-07-01T00:00:00",
  is_read: false,
  categories: null,
  interest_score: null,
  quality_score: null,
  composite_score: null,
  score_reasoning: null,
  scoring_state: "scored",
  scored_at: null,
  re_evaluating: false,
  summary: "Full summary of article 1",
  content: "<p>Full article content</p>",
};

/** Fixture matching the backend `GET /api/articles/counts` shape exactly. */
export const mockArticleCounts: ArticleCounts = {
  unread: TOTAL_ARTICLES,
  read: 5,
  scoring: 1,
  blocked: 3,
};

/**
 * Blocked-view fixtures: one article blocked by a single category, one
 * blocked by two categories (appears under both groups), and one whose only
 * category is no longer block-weight (fallback "No longer blocked" group).
 */
export const mockBlockedArticles: ArticleListItem[] = [
  {
    id: 9001,
    feed_id: FEED_A_ID,
    feed_title: "Feed A",
    title: "Bitcoin ETF inflows hit record highs",
    url: "https://example.com/articles/9001",
    author: null,
    published_at: "2026-07-05T12:00:00",
    is_read: false,
    categories: [
      {
        id: 1,
        display_name: "Crypto",
        slug: "crypto",
        effective_weight: "block",
        parent_display_name: null,
        needs_triage: false,
      },
    ],
    interest_score: null,
    quality_score: null,
    composite_score: null,
    score_reasoning: null,
    summary_preview: null,
    scoring_state: "blocked",
    scored_at: null,
    re_evaluating: false,
  },
  {
    id: 9002,
    feed_id: FEED_B_ID,
    feed_title: "Feed B",
    title: "Celebrity-backed NFT project collapses amid lawsuits",
    url: "https://example.com/articles/9002",
    author: null,
    published_at: "2026-07-05T15:00:00",
    is_read: false,
    categories: [
      {
        id: 1,
        display_name: "Crypto",
        slug: "crypto",
        effective_weight: "block",
        parent_display_name: null,
        needs_triage: false,
      },
      {
        id: 2,
        display_name: "Celebrity Gossip",
        slug: "celebrity-gossip",
        effective_weight: "block",
        parent_display_name: null,
        needs_triage: false,
      },
    ],
    interest_score: null,
    quality_score: null,
    composite_score: null,
    score_reasoning: null,
    summary_preview: null,
    scoring_state: "blocked",
    scored_at: null,
    re_evaluating: false,
  },
  {
    id: 9003,
    feed_id: FEED_A_ID,
    feed_title: "Feed A",
    title: "Reweighted category, still parked in blocked state",
    url: "https://example.com/articles/9003",
    author: null,
    published_at: "2026-07-04T09:00:00",
    is_read: false,
    categories: [
      {
        id: 3,
        display_name: "Finance",
        slug: "finance",
        effective_weight: "normal",
        parent_display_name: null,
        needs_triage: false,
      },
    ],
    interest_score: null,
    quality_score: null,
    composite_score: null,
    score_reasoning: null,
    summary_preview: null,
    scoring_state: "blocked",
    scored_at: null,
    re_evaluating: false,
  },
];

export const articleHandlers = [
  http.get("/api/articles", ({ request }) => {
    const url = new URL(request.url);
    const skip = Number(url.searchParams.get("skip") ?? "0");
    const limit = Number(url.searchParams.get("limit") ?? "25");
    const isReadParam = url.searchParams.get("is_read");
    const feedIdParam = url.searchParams.get("feed_id");
    const folderIdParam = url.searchParams.get("folder_id");
    const scoringStateParam = url.searchParams.get("scoring_state");

    if (scoringStateParam === "blocked") {
      const items = mockBlockedArticles.slice(skip, skip + limit);
      const hasMore = skip + limit < mockBlockedArticles.length;
      return HttpResponse.json({ items, has_more: hasMore });
    }

    let filtered = mockArticles;
    if (isReadParam !== null) {
      // Mirror the backend: is_read filters server-side before pagination.
      filtered = filtered.filter((a) => String(a.is_read) === isReadParam);
    }
    if (feedIdParam !== null) {
      const feedId = Number(feedIdParam);
      filtered = filtered.filter((a) => a.feed_id === feedId);
    } else if (folderIdParam !== null) {
      // No folder fixtures defined — folder scoping yields no matches.
      filtered = [];
    }

    const items = filtered.slice(skip, skip + limit);
    const hasMore = skip + limit < filtered.length;

    return HttpResponse.json({ items, has_more: hasMore });
  }),

  http.post("/api/articles/:id/rescue", ({ params }) => {
    const id = Number(params.id);
    const exists = mockBlockedArticles.some((a) => a.id === id);
    if (!exists) {
      return HttpResponse.json(
        { detail: "Article not found" },
        { status: 404 },
      );
    }
    return HttpResponse.json({ ok: true });
  }),

  // Must be registered before the `/api/articles/:id` handler — MSW matches
  // handlers in order, and `:id` would otherwise swallow the literal "counts" segment.
  http.get("/api/articles/counts", () => HttpResponse.json(mockArticleCounts)),

  http.get("/api/articles/:id", ({ params }) => {
    const id = Number(params.id);
    // Derive detail fields from the matching list fixture so list and detail
    // never disagree about the same article (feed, title, read state).
    const base = mockArticles.find((a) => a.id === id);
    return HttpResponse.json({
      ...mockArticleDetail,
      ...(base && {
        feed_id: base.feed_id,
        title: base.title,
        url: base.url,
        published_at: base.published_at,
        is_read: base.is_read,
      }),
      id,
    });
  }),

  http.patch("/api/articles/:id", async ({ params, request }) => {
    const id = Number(params.id);
    const body = (await request.json()) as { is_read: boolean };
    return HttpResponse.json({
      ...mockArticleDetail,
      id,
      is_read: body.is_read,
    });
  }),
];
