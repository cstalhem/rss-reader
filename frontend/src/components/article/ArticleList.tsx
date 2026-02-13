"use client";

import { useState, useMemo } from "react";
import { Box, Flex, Button, Text, Skeleton, Stack } from "@chakra-ui/react";
import { useArticles, useMarkAsRead } from "@/hooks/useArticles";
import { useMarkAllRead } from "@/hooks/useFeedMutations";
import { useFeeds } from "@/hooks/useFeeds";
import { useSortPreference } from "@/hooks/useSortPreference";
import { useScoringStatus } from "@/hooks/useScoringStatus";
import { ArticleRow } from "./ArticleRow";
import { ArticleReader } from "./ArticleReader";
import { SortSelect } from "./SortSelect";
import { Article, parseSortOption } from "@/lib/types";

interface ArticleListProps {
  selectedFeedId?: number | null;
}

type FilterTab = "unread" | "all" | "scoring" | "blocked";

export function ArticleList({ selectedFeedId }: ArticleListProps) {
  const [filter, setFilter] = useState<FilterTab>("unread");
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const { sortOption, setSortOption } = useSortPreference();
  const { data: scoringStatus } = useScoringStatus();

  // Derive useArticles options from filter state
  const showAll = filter !== "unread";
  const scoringState = filter === "scoring" ? "pending" : filter === "blocked" ? "blocked" : undefined;
  const excludeBlocked = filter === "unread" || filter === "all";

  // Parse sort option for backend
  const { sort_by, order } = parseSortOption(sortOption);

  const { data: articles, isLoading, loadMore, hasMore } = useArticles({
    showAll,
    feedId: selectedFeedId ?? undefined,
    sortBy: sort_by,
    order: order,
    scoringState: scoringState,
    excludeBlocked: excludeBlocked,
  });

  const { data: feeds } = useFeeds();
  const markAsRead = useMarkAsRead();
  const markAllRead = useMarkAllRead();

  const feedNames = useMemo(() => {
    const map: Record<number, string> = {};
    if (feeds) {
      for (const feed of feeds) {
        map[feed.id] = feed.title;
      }
    }
    return map;
  }, [feeds]);

  // Calculate tab counts
  const scoringCount = (scoringStatus?.unscored ?? 0) + (scoringStatus?.queued ?? 0) + (scoringStatus?.scoring ?? 0);
  const blockedCount = scoringStatus?.blocked ?? 0;

  const handleToggleRead = (article: Article) => {
    markAsRead.mutate({
      articleId: article.id,
      isRead: !article.is_read,
    });
  };

  const handleSelect = (article: Article) => {
    setSelectedArticle(article);
  };

  const handleMarkAllAsRead = () => {
    if (selectedFeedId) {
      markAllRead.mutate(selectedFeedId);
    }
  };

  const articleCount = articles?.length ?? 0;
  const countLabel =
    filter === "unread"
      ? `${articleCount} unread article${articleCount !== 1 ? "s" : ""}`
      : filter === "scoring"
      ? `${articleCount} pending article${articleCount !== 1 ? "s" : ""}`
      : filter === "blocked"
      ? `${articleCount} blocked article${articleCount !== 1 ? "s" : ""}`
      : `${articleCount} article${articleCount !== 1 ? "s" : ""}`;

  // Empty state messages by filter
  const emptyMessage =
    filter === "unread"
      ? "No unread articles. You're all caught up!"
      : filter === "all"
      ? "No articles yet. Add some feeds to get started."
      : filter === "scoring"
      ? "No articles awaiting scoring."
      : "No blocked articles.";

  return (
    <Box>
      {/* Top bar with filter tabs, sort, and count */}
      <Flex
        px={4}
        py={3}
        borderBottom="1px solid"
        borderColor="border.subtle"
        alignItems="center"
        justifyContent="space-between"
      >
        <Flex gap={2} alignItems="center" flexWrap="wrap">
          {/* Filter tabs */}
          <Button
            size="sm"
            variant={filter === "unread" ? "solid" : "ghost"}
            colorPalette={filter === "unread" ? "accent" : undefined}
            onClick={() => setFilter("unread")}
          >
            Unread
          </Button>
          <Button
            size="sm"
            variant={filter === "all" ? "solid" : "ghost"}
            colorPalette={filter === "all" ? "accent" : undefined}
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          <Button
            size="sm"
            variant={filter === "scoring" ? "solid" : "ghost"}
            colorPalette={filter === "scoring" ? "accent" : undefined}
            onClick={() => setFilter("scoring")}
            disabled={scoringCount === 0}
          >
            Scoring{scoringCount > 0 ? ` (${scoringCount})` : ""}
          </Button>
          <Button
            size="sm"
            variant={filter === "blocked" ? "solid" : "ghost"}
            colorPalette={filter === "blocked" ? "accent" : undefined}
            onClick={() => setFilter("blocked")}
            disabled={blockedCount === 0}
          >
            Blocked{blockedCount > 0 ? ` (${blockedCount})` : ""}
          </Button>

          {/* Mark all read button - only for unread/all tabs */}
          {(filter === "unread" || filter === "all") &&
            selectedFeedId &&
            articleCount > 0 &&
            filter === "unread" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleMarkAllAsRead}
                disabled={markAllRead.isPending}
              >
                Mark all read
              </Button>
            )}

          {/* Sort dropdown */}
          <SortSelect value={sortOption} onChange={setSortOption} />
        </Flex>

        <Text fontSize="sm" color="fg.muted">
          {countLabel}
        </Text>
      </Flex>

      {/* Article list */}
      {isLoading ? (
        <Stack gap={0}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Box key={i} px={4} py={3}>
              <Skeleton height="20px" mb={2} />
              <Skeleton height="16px" width="60%" />
            </Box>
          ))}
        </Stack>
      ) : articles && articles.length > 0 ? (
        <>
          <Box>
            {articles.map((article) => (
              <ArticleRow
                key={article.id}
                article={article}
                feedName={selectedFeedId ? undefined : feedNames[article.feed_id]}
                onSelect={handleSelect}
                onToggleRead={handleToggleRead}
              />
            ))}
          </Box>

          {/* Load more button */}
          {hasMore && (
            <Flex justifyContent="center" py={4}>
              <Button
                colorPalette="accent"
                onClick={loadMore}
                disabled={isLoading}
              >
                Load more
              </Button>
            </Flex>
          )}
        </>
      ) : (
        <Flex
          alignItems="center"
          justifyContent="center"
          minHeight="400px"
          p={8}
        >
          <Text fontSize="lg" color="fg.muted">
            {emptyMessage}
          </Text>
        </Flex>
      )}

      {/* Article reader drawer */}
      <ArticleReader
        article={selectedArticle}
        articles={articles ?? []}
        onClose={() => setSelectedArticle(null)}
        onNavigate={(article) => setSelectedArticle(article)}
      />
    </Box>
  );
}
