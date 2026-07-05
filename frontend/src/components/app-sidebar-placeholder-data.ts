// Hardcoded placeholder data shaped like the real domain (folders → feeds,
// with unread counts). Slice 3 swaps this for live TanStack Query hooks.

export type Feed = {
  id: string
  title: string
  unread: number
}

export type Folder = {
  id: string
  title: string
  feeds: Feed[]
}

export const folders: Folder[] = [
  {
    id: "tech",
    title: "Tech",
    feeds: [
      { id: "hn", title: "Hacker News", unread: 42 },
      { id: "ars", title: "Ars Technica", unread: 7 },
      { id: "verge", title: "The Verge", unread: 13 },
    ],
  },
  {
    id: "science",
    title: "Science",
    feeds: [
      { id: "quanta", title: "Quanta Magazine", unread: 3 },
      { id: "nature", title: "Nature News", unread: 0 },
    ],
  },
  {
    id: "news",
    title: "News",
    feeds: [
      { id: "reuters", title: "Reuters World", unread: 21 },
      { id: "guardian", title: "The Guardian", unread: 9 },
      { id: "apnews", title: "AP News", unread: 5 },
      { id: "bbc", title: "BBC World", unread: 2 },
    ],
  },
]

// Root-level feeds not inside any folder.
export const rootFeeds: Feed[] = [
  { id: "xkcd", title: "xkcd", unread: 1 },
  { id: "waitbutwhy", title: "Wait But Why", unread: 0 },
]

export const folderUnread = (folder: Folder): number =>
  folder.feeds.reduce((sum, feed) => sum + feed.unread, 0)

export const totalUnread: number =
  folders.reduce((sum, folder) => sum + folderUnread(folder), 0) +
  rootFeeds.reduce((sum, feed) => sum + feed.unread, 0)
