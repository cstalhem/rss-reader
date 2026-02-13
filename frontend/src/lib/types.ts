export interface Article {
  id: number;
  feed_id: number;
  title: string;
  url: string;
  author: string | null;
  published_at: string | null;
  summary: string | null;
  content: string | null;
  is_read: boolean;
  // LLM scoring fields
  categories: string[] | null;
  interest_score: number | null;
  quality_score: number | null;
  composite_score: number | null;
  score_reasoning: string | null;
  scoring_state: string;
  scored_at: string | null;
}

export interface Feed {
  id: number;
  url: string;
  title: string;
  last_fetched_at: string | null;
  display_order: number;
  unread_count: number;
}

export interface UserPreferences {
  interests: string;
  anti_interests: string;
  topic_weights: Record<string, string> | null;
  updated_at: string;
}

export type SortOption = "score_desc" | "score_asc" | "date_desc" | "date_asc";

export function parseSortOption(option: SortOption): { sort_by: string; order: string } {
  switch (option) {
    case "score_desc": return { sort_by: "composite_score", order: "desc" };
    case "score_asc": return { sort_by: "composite_score", order: "asc" };
    case "date_desc": return { sort_by: "published_at", order: "desc" };
    case "date_asc": return { sort_by: "published_at", order: "asc" };
  }
}
