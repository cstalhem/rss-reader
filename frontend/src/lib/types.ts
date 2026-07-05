/** Server response shapes. Mirror the backend Pydantic schemas exactly. */

/** Mirrors backend `FeedResponse` (schemas.py). */
export interface Feed {
  id: number;
  url: string;
  title: string;
  display_order: number;
  last_fetched_at: string | null;
  unread_count: number;
  folder_id: number | null;
  folder_name: string | null;
}

/** Mirrors backend `FeedFolderResponse` (schemas.py). */
export interface FeedFolder {
  id: number;
  name: string;
  display_order: number;
  created_at: string;
  unread_count: number;
}
