"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import NextLink from "next/link";
import {
  Alert,
  Box,
  createListCollection,
  Flex,
  Button,
  Heading,
  IconButton,
  Link,
  Portal,
  Select,
  Text,
  Icon,
} from "@chakra-ui/react";
import {
  LuCheckCheck,
  LuInbox,
  LuClock,
  LuBan,
  LuBrainCog,
  LuMenu,
} from "react-icons/lu";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useArticles, useMarkAsRead } from "@/hooks/useArticles";
import { useMarkAllRead, useMarkAllArticlesRead } from "@/hooks/useFeedMutations";
import { useFeeds } from "@/hooks/useFeeds";
import { useSortPreference } from "@/hooks/useSortPreference";
import { useScoringStatus } from "@/hooks/useScoringStatus";
import { useCompletingArticles } from "@/hooks/useCompletingArticles";
import { rescoreArticle } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { ArticleRow } from "./ArticleRow";
import { ArticleRowSkeleton } from "./ArticleRowSkeleton";
import { ArticleReader } from "./ArticleReader";
import { SortSelect } from "./SortSelect";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ArticleListItem } from "@/lib/types";
import { parseSortOption } from "@/lib/utils";

interface ArticleListProps {
  selectedFeedId?: number | null;
  onOpenMobileSidebar?: () => void;
}

type FilterTab = "unread" | "all" | "scoring" | "blocked";

export function ArticleList({ selectedFeedId, onOpenMobileSidebar }: ArticleListProps) {
  const [filter, setFilter] = useState<FilterTab>("unread");
  const [selectedArticle, setSelectedArticle] = useState<ArticleListItem | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isConfirmMarkAllOpen, setIsConfirmMarkAllOpen] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { sortOption, setSortOption } = useSortPreference();
  const { data: scoringStatus } = useScoringStatus();
  const queryClient = useQueryClient();

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
  const { displayArticles, completingIds } = useCompletingArticles(
    articles,
    filter === "scoring"
  );

  const { data: feeds } = useFeeds();
  const markAsRead = useMarkAsRead();
  const markAllRead = useMarkAllRead();
  const markAllArticlesRead = useMarkAllArticlesRead();

  // Rescore mutation
  const rescoreMutation = useMutation({
    mutationFn: (articleId: number) => rescoreArticle(articleId),
    meta: { errorTitle: "Failed to rescore article" },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.scoringStatus.all });
    },
  });

  // Feed name lookup
  const feedNames = useMemo(() => {
    const map: Record<number, string> = {};
    if (feeds) {
      for (const feed of feeds) {
        map[feed.id] = feed.title;
      }
    }
    return map;
  }, [feeds]);

  // Current feed name for heading
  const feedName = selectedFeedId ? feedNames[selectedFeedId] ?? "Feed" : "Articles";

  // IntersectionObserver for sticky scroll-collapse
  useEffect(() => {
    const heading = headingRef.current;
    if (!heading) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsScrolled(!entry.isIntersecting);
      },
      { rootMargin: "-1px 0px 0px 0px" }
    );

    observer.observe(heading);
    return () => observer.disconnect();
  }, []);

  const handleToggleRead = (article: ArticleListItem) => {
    markAsRead.mutate({
      articleId: article.id,
      isRead: !article.is_read,
    });
  };

  const handleSelect = (article: ArticleListItem) => {
    setSelectedArticle(article);
  };

  const handleRescore = (article: ArticleListItem) => {
    rescoreMutation.mutate(article.id);
  };

  const handleMarkAllAsRead = () => {
    if (selectedFeedId) {
      markAllRead.mutate(selectedFeedId);
    } else {
      // All Articles view: show confirmation
      setIsConfirmMarkAllOpen(true);
    }
  };

  const handleConfirmMarkAllArticlesRead = () => {
    markAllArticlesRead.mutate();
    setIsConfirmMarkAllOpen(false);
  };

  const articleCount = displayArticles?.length ?? 0;

  // Filter dropdown collection with counts
  const filterCollection = useMemo(() => {
    const unreadCount = filter === "unread" ? articleCount : undefined;
    const allCount = filter === "all" ? articleCount : undefined;

    return createListCollection({
      items: [
        { label: `Unread${unreadCount !== undefined ? ` (${unreadCount})` : ""}`, value: "unread" },
        { label: `All${allCount !== undefined ? ` (${allCount})` : ""}`, value: "all" },
        { label: `Scoring${scoringCount > 0 ? ` (${scoringCount})` : ""}`, value: "scoring", disabled: scoringCount === 0 },
        { label: `Blocked${blockedCount > 0 ? ` (${blockedCount})` : ""}`, value: "blocked", disabled: blockedCount === 0 },
      ],
    });
  }, [filter, articleCount, scoringCount, blockedCount]);

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
      {/* Scoring readiness warning */}
      {scoringStatus?.scoring_ready === false && scoringStatus.scoring_ready_reason && (
        <Alert.Root status="warning" variant="surface" size="sm">
          <Alert.Indicator>
            <LuBrainCog />
          </Alert.Indicator>
          <Alert.Title fontSize="xs">
            {scoringStatus.scoring_ready_reason}
            {scoringStatus.scoring_ready_reason.includes("Ollama settings") && (
              <>
                {" "}
                <Link asChild color="fg.warning" textDecoration="underline">
                  <NextLink href="/settings/ollama">Configure &rarr;</NextLink>
                </Link>
              </>
            )}
          </Alert.Title>
        </Alert.Root>
      )}

      {/* Feed name heading */}
      <Flex px={4} pt={4} pb={2} alignItems="center" gap={2}>
        {/* Mobile hamburger */}
        <IconButton
          aria-label="Open sidebar"
          size="sm"
          variant="ghost"
          display={{ base: "flex", md: "none" }}
          onClick={onOpenMobileSidebar}
        >
          <LuMenu />
        </IconButton>
        <Heading ref={headingRef} fontSize="2xl" fontWeight="bold">
          {feedName}
        </Heading>
      </Flex>

      {/* Controls bar */}
      <Flex
        px={4}
        py={2}
        borderBottom="1px solid"
        borderColor="border.subtle"
        alignItems="center"
        gap={2}
        position={isScrolled ? "sticky" : "static"}
        top={0}
        zIndex={isScrolled ? 5 : undefined}
        bg="bg"
      >
        {/* Inline feed name when scrolled */}
        {isScrolled && (
          <Text
            fontSize="sm"
            fontWeight="medium"
            flexShrink={0}
            mr={1}
            css={{
              animation: "fadeIn 0.15s ease-out",
              "@keyframes fadeIn": {
                "0%": { opacity: 0 },
                "100%": { opacity: 1 },
              },
            }}
          >
            {feedName}
          </Text>
        )}

        {/* Filter dropdown */}
        <Select.Root
          collection={filterCollection}
          size="sm"
          value={[filter]}
          onValueChange={(details) => {
            const selected = details.value[0] as FilterTab | undefined;
            if (selected) setFilter(selected);
          }}
          positioning={{ sameWidth: true }}
          width="auto"
          minWidth="130px"
        >
          <Select.HiddenSelect />
          <Select.Control>
            <Select.Trigger>
              <Select.ValueText placeholder="Filter..." />
            </Select.Trigger>
            <Select.IndicatorGroup>
              <Select.Indicator />
            </Select.IndicatorGroup>
          </Select.Control>
          <Portal>
            <Select.Positioner>
              <Select.Content>
                {filterCollection.items.map((option) => (
                  <Select.Item key={option.value} item={option}>
                    {option.label}
                    <Select.ItemIndicator />
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Positioner>
          </Portal>
        </Select.Root>

        {/* Sort dropdown */}
        <SortSelect value={sortOption} onChange={setSortOption} />

        <Box flex={1} />

        {/* Mark all read icon button */}
        {filter === "unread" && articleCount > 0 && (
          <IconButton
            aria-label="Mark all as read"
            title="Mark all as read"
            size="sm"
            variant="ghost"
            onClick={handleMarkAllAsRead}
            disabled={markAllRead.isPending || markAllArticlesRead.isPending}
          >
            <LuCheckCheck />
          </IconButton>
        )}

        {/* Count label */}
        <Text fontSize="sm" color="fg.muted" flexShrink={0}>
          {articleCount}
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
          <Box as="section" aria-label="Article list">
            {displayArticles.map((article) => (
              <ArticleRow
                key={article.id}
                article={article}
                feedName={selectedFeedId ? undefined : feedNames[article.feed_id]}
                onSelect={handleSelect}
                onToggleRead={handleToggleRead}
                onRescore={handleRescore}
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

      {/* Confirm mark all articles read dialog */}
      <ConfirmDialog
        open={isConfirmMarkAllOpen}
        onOpenChange={({ open }) => setIsConfirmMarkAllOpen(open)}
        title="Mark all articles as read?"
        body="This will mark all unread articles across all feeds as read."
        confirmLabel="Mark all read"
        confirmColorPalette="accent"
        onConfirm={handleConfirmMarkAllArticlesRead}
      />

      {/* Article reader drawer */}
      <ArticleReader
        key={selectedArticle?.id}
        article={selectedArticle}
        articles={displayArticles ?? []}
        onClose={() => setSelectedArticle(null)}
        onNavigate={(article) => setSelectedArticle(article)}
      />
    </Box>
  );
}
