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
}

export interface Feed {
  id: number;
  url: string;
  title: string;
  last_fetched_at: string | null;
}
