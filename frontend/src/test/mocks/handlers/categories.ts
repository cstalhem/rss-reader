import { http, HttpResponse } from "msw";
import type {
  AutoGroupApplyPayload,
  AutoGroupApplyResponse,
  AutoGroupSuggestResponse,
  Category,
  CategoryBulkUpdatePayload,
  CategoryBulkUpdateResponse,
  CategoryCreatePayload,
  CategoryGroupPayload,
  CategoryGroupResponse,
  CategoryMergeResponse,
  CategoryUpdatePayload,
} from "@/lib/types";

/** Fixture matching the backend `CategoryResponse` shape exactly. One awaiting triage, one settled. */
export const mockCategories: Category[] = [
  {
    id: 1,
    display_name: "Crypto",
    slug: "crypto",
    weight: "normal",
    parent_id: null,
    needs_triage: true,
    article_count: 4,
    created_at: "2026-07-01T00:00:00",
    sample_articles: [
      {
        id: 9001,
        title: "Bitcoin ETF inflows hit record highs",
        feed_title: "Feed A",
      },
    ],
  },
  {
    id: 2,
    display_name: "Finance",
    slug: "finance",
    weight: "boost",
    parent_id: null,
    needs_triage: false,
    article_count: 10,
    created_at: "2026-06-15T00:00:00",
    sample_articles: [],
  },
];

export const mockCategoryUnseenCount = { count: 1 };

export const categoryHandlers = [
  http.get("/api/categories", ({ request }) => {
    const url = new URL(request.url);
    const needsTriageParam = url.searchParams.get("needs_triage");
    if (needsTriageParam === null) {
      return HttpResponse.json(mockCategories);
    }
    const needsTriage = needsTriageParam === "true";
    return HttpResponse.json(
      mockCategories.filter((c) => c.needs_triage === needsTriage),
    );
  }),

  // Must be registered before `/api/categories/:id` — MSW matches handlers in
  // order, and `:id` would otherwise swallow the literal "unseen-count" segment.
  http.get("/api/categories/unseen-count", () =>
    HttpResponse.json(mockCategoryUnseenCount),
  ),

  http.post("/api/categories", async ({ request }) => {
    const body = (await request.json()) as CategoryCreatePayload;
    const created: Category = {
      id: 3,
      display_name: body.display_name,
      slug: body.display_name.toLowerCase().replace(/\s+/g, "-"),
      weight: "normal",
      parent_id: body.parent_id ?? null,
      needs_triage: false,
      article_count: 0,
      created_at: "2026-07-06T00:00:00",
      sample_articles: [],
    };
    return HttpResponse.json(created, { status: 201 });
  }),

  http.patch("/api/categories", async ({ request }) => {
    const body = (await request.json()) as CategoryBulkUpdatePayload;
    const knownIds = new Set(mockCategories.map((c) => c.id));
    const missing_ids = body.category_ids.filter((id) => !knownIds.has(id));
    const response: CategoryBulkUpdateResponse = {
      ok: true,
      updated: body.category_ids.length - missing_ids.length,
      missing_ids,
    };
    return HttpResponse.json(response);
  }),

  http.post("/api/categories/group", async ({ request }) => {
    const body = (await request.json()) as CategoryGroupPayload;
    const response: CategoryGroupResponse = {
      ok: true,
      updated: body.category_ids.length,
    };
    return HttpResponse.json(response);
  }),

  http.post("/api/categories/merge", () => {
    const response: CategoryMergeResponse = {
      ok: true,
      articles_moved: 2,
      children_released: [],
      aliases_repointed: 1,
    };
    return HttpResponse.json(response);
  }),

  http.post("/api/categories/auto-group/suggest", () => {
    const response: AutoGroupSuggestResponse = {
      groups: [{ parent: "Finance", children: ["Crypto", "Stocks"] }],
    };
    return HttpResponse.json(response);
  }),

  http.post("/api/categories/auto-group/apply", async ({ request }) => {
    const body = (await request.json()) as AutoGroupApplyPayload;
    const response: AutoGroupApplyResponse = {
      ok: true,
      groups_applied: body.groups.length,
      categories_moved: body.groups.reduce(
        (sum, g) => sum + g.children.length,
        0,
      ),
    };
    return HttpResponse.json(response);
  }),

  http.patch("/api/categories/:id", async ({ request, params }) => {
    const body = (await request.json()) as CategoryUpdatePayload;
    const existing = mockCategories.find((c) => c.id === Number(params.id));
    const updated: Category = {
      ...(existing ?? mockCategories[0]),
      ...body,
      id: Number(params.id),
    };
    return HttpResponse.json(updated);
  }),

  http.delete("/api/categories/:id", () => HttpResponse.json({ ok: true })),
];
