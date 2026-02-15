"use client";

import { useState, useMemo } from "react";
import { Box, Flex, Button, Text, Icon } from "@chakra-ui/react";
import { LuCheckCheck, LuInbox, LuClock, LuBan } from "react-icons/lu";
import { useArticles, useMarkAsRead } from "@/hooks/useArticles";
import { useMarkAllRead } from "@/hooks/useFeedMutations";
import { useFeeds } from "@/hooks/useFeeds";
import { useSortPreference } from "@/hooks/useSortPreference";
import { useScoringStatus } from "@/hooks/useScoringStatus";
import { useCompletingArticles } from "@/hooks/useCompletingArticles";
import { ArticleRow } from "./ArticleRow";
import { ArticleRowSkeleton } from "./ArticleRowSkeleton";
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

  // Calculate tab counts (needed before useArticles for scoringActive)
  const scoringCount = (scoringStatus?.unscored ?? 0) + (scoringStatus?.queued ?? 0) + (scoringStatus?.scoring ?? 0);
  const blockedCount = scoringStatus?.blocked ?? 0;

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
    scoringActive: scoringCount > 0,
  });

  // Track articles completing scoring (for animation in Scoring tab)
  // Hook returns merged display list with completing articles in original positions
  const { displayArticles, completingIds } = useCompletingArticles(
    articles,
    filter === "scoring"
  );

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

  const articleCount = displayArticles?.length ?? 0;
  const countLabel =
    filter === "unread"
      ? `${articleCount} unread article${articleCount !== 1 ? "s" : ""}`
      : filter === "scoring"
      ? `${articleCount} pending article${articleCount !== 1 ? "s" : ""}`
      : filter === "blocked"
      ? `${articleCount} blocked article${articleCount !== 1 ? "s" : ""}`
      : `${articleCount} article${articleCount !== 1 ? "s" : ""}`;

  // Empty state messages and icons by filter
  const emptyMessage =
    filter === "unread"
      ? "No unread articles. You're all caught up!"
      : filter === "all"
      ? "No articles yet"
      : filter === "scoring"
      ? "No articles awaiting scoring."
      : "No blocked articles.";

  const emptyIcon =
    filter === "unread"
      ? LuCheckCheck
      : filter === "all"
      ? LuInbox
      : filter === "scoring"
      ? LuClock
      : LuBan;

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
        <Box>
          {Array.from({ length: 5 }).map((_, i) => (
            <ArticleRowSkeleton key={i} />
          ))}
        </Box>
      ) : displayArticles && displayArticles.length > 0 ? (
        <>
          <Box>
            {displayArticles.map((article) => (
              <ArticleRow
                key={article.id}
                article={article}
                feedName={selectedFeedId ? undefined : feedNames[article.feed_id]}
                onSelect={handleSelect}
                onToggleRead={handleToggleRead}
                isCompleting={completingIds.has(article.id)}
                scoringPhase={
                  article.scoring_state === "scoring" &&
                  scoringStatus?.current_article_id === article.id
                    ? scoringStatus.phase
                    : undefined
                }
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
          direction="column"
          alignItems="center"
          justifyContent="center"
          gap={4}
          py={16}
          px={8}
        >
          <Icon as={emptyIcon} boxSize={12} color="fg.subtle" />
          <Text fontSize="lg" color="fg.muted" textAlign="center">
            {emptyMessage}
          </Text>
          {filter === "all" && (
            <Text fontSize="sm" color="fg.subtle" textAlign="center">
              Add feeds from the sidebar to get started
            </Text>
          )}
        </Flex>
      )}

      {/* Article reader drawer */}
      <ArticleReader
        article={selectedArticle}
        articles={displayArticles ?? []}
        onClose={() => setSelectedArticle(null)}
        onNavigate={(article) => setSelectedArticle(article)}
      />
    </Box>
  );
}
