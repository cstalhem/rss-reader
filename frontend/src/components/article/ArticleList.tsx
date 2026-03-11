"use client";

import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
} from "react";
import NextLink from "next/link";
import {
  Alert,
  Box,
  Flex,
  Button,
  Heading,
  IconButton,
  Link,
  Portal,
  Select,
  Text,
  Icon,
  Collapsible,
} from "@chakra-ui/react";
import {
  LuCheckCheck,
  LuBrainCog,
  LuMenu,
} from "react-icons/lu";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useArticles, useMarkAsRead } from "@/hooks/useArticles";
import { useBufferedArticles } from "@/hooks/useBufferedArticles";
import {
  useMarkAllRead,
  useMarkAllArticlesRead,
} from "@/hooks/useFeedMutations";
import { useFeeds } from "@/hooks/useFeeds";
import { useFeedFolders } from "@/hooks/useFeedFolders";
import { useSortPreference } from "@/hooks/useSortPreference";
import { useScoringStatus } from "@/hooks/useScoringStatus";
import { useCompletingArticles } from "@/hooks/useCompletingArticles";
import { rescoreArticle } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { NewArticlesPill } from "./NewArticlesPill";
import { ArticleRow } from "./ArticleRow";
import { ArticleRowSkeleton } from "./ArticleRowSkeleton";
import { ArticleReader } from "./ArticleReader";
import { SortSelect } from "./SortSelect";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { UnreadCountBadge } from "@/components/ui/unread-count-badge";
import { MobileArticleActionBar } from "./MobileArticleActionBar";
import { ArticleListItem, FeedSelection, FilterTab } from "@/lib/types";
import { parseSortOption } from "@/lib/utils";
import { ARTICLE_EMPTY_STATES, createArticleFilterCollection } from "./viewConfig";

interface ArticleListProps {
  selection: FeedSelection;
  onOpenMobileSidebar?: () => void;
  mainRef: React.RefObject<HTMLDivElement | null>;
}

export function ArticleList({
  selection,
  onOpenMobileSidebar,
  mainRef,
}: ArticleListProps) {
  const [filter, setFilter] = useState<FilterTab>("unread");
  const [selectedArticle, setSelectedArticle] =
    useState<ArticleListItem | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isReaderOpen, setIsReaderOpen] = useState(false);
  const [isConfirmMarkAllOpen, setIsConfirmMarkAllOpen] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const rowRefs = useRef<Map<number, HTMLElement>>(new Map());
  const pendingOpenRef = useRef<ArticleListItem | null>(null);
  const openScrollTopRef = useRef(0);
  const { sortOption, setSortOption } = useSortPreference();
  const { data: scoringStatus } = useScoringStatus();
  const queryClient = useQueryClient();
  const serverRetryAfter = scoringStatus?.rate_limit_retry_after ?? 0;
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
  const prevRetryAfterRef = useRef(0);

  // Seed countdown from server value when it changes (derived, no effect needed)
  if (serverRetryAfter !== prevRetryAfterRef.current) {
    prevRetryAfterRef.current = serverRetryAfter;
    setRateLimitCountdown(serverRetryAfter);
  }

  // Tick down locally for smooth display
  useEffect(() => {
    if (rateLimitCountdown <= 0) return;
    const interval = setInterval(() => {
      setRateLimitCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [rateLimitCountdown > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // Calculate tab counts (needed before useArticles for scoringActive)
  const scoringCount =
    (scoringStatus?.unscored ?? 0) +
    (scoringStatus?.queued ?? 0) +
    (scoringStatus?.scoring ?? 0) +
    (scoringStatus?.categorization?.queued ?? 0) +
    (scoringStatus?.categorization?.categorizing ?? 0);
  const blockedCount = scoringStatus?.blocked ?? 0;
  const failedCount = scoringStatus?.failed ?? 0;

  // Derive useArticles options from filter state
  const showAll = filter !== "unread";
  const scoringState =
    filter === "scoring"
      ? "pending"
      : filter === "blocked"
        ? "blocked"
        : filter === "failed"
          ? "failed"
          : undefined;
  const excludeBlocked = filter === "unread" || filter === "all";

  // Parse sort option for backend
  const { sort_by, order } = parseSortOption(sortOption);

  const {
    data: articles,
    isLoading,
    loadMore,
    hasMore,
    limit,
  } = useArticles({
    showAll,
    feedId: selection.kind === "feed" ? selection.feedId : undefined,
    folderId: selection.kind === "folder" ? selection.folderId : undefined,
    sortBy: sort_by,
    order: order,
    scoringState: scoringState,
    excludeBlocked: excludeBlocked,
    scoringActive: scoringCount > 0,
  });

  // Buffer new articles on Unread tab to prevent list shift during scoring
  const isBuffering = filter === "unread" && scoringCount > 0;
  const resetKey = `${selection.kind}:${selection.kind === "feed" ? selection.feedId : selection.kind === "folder" ? selection.folderId : "all"}:${sortOption}`;
  const { displayArticles: bufferedArticles, newCount, flush } = useBufferedArticles(
    articles,
    isBuffering,
    resetKey,
    limit,
  );

  // Track articles completing scoring (for animation in Scoring tab)
  // Pass raw `articles` — not bufferedArticles — to avoid referential instability
  // triggering useCompletingArticles' useLayoutEffect setState loop.
  const { displayArticles: completedArticles, completingIds } = useCompletingArticles(
    articles,
    filter === "scoring",
  );

  // The two hooks are mutually exclusive by tab — pick the right output
  const displayArticles = isBuffering ? bufferedArticles : completedArticles;

  const { data: feeds } = useFeeds();
  const { data: folders } = useFeedFolders();
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
  const feedName =
    selection.kind === "feed"
      ? (feedNames[selection.feedId] ?? "Feed")
      : selection.kind === "folder"
        ? (folders?.find((folder) => folder.id === selection.folderId)?.name ??
          "Folder")
        : "Articles";

  // Unread count for heading badge
  const unreadCount =
    selection.kind === "feed"
      ? (feeds?.find((f) => f.id === selection.feedId)?.unread_count ?? 0)
      : selection.kind === "folder"
        ? (folders?.find((f) => f.id === selection.folderId)?.unread_count ?? 0)
        : (feeds?.reduce((sum, f) => sum + f.unread_count, 0) ?? 0);

  // IntersectionObserver for sticky scroll-collapse
  useEffect(() => {
    const heading = headingRef.current;
    if (!heading) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsScrolled(!entry.isIntersecting);
      },
      { root: mainRef.current, rootMargin: "-1px 0px 0px 0px" },
    );

    observer.observe(heading);
    return () => observer.disconnect();
  }, [mainRef]);

  const handleToggleRead = (article: ArticleListItem) => {
    markAsRead.mutate({
      articleId: article.id,
      isRead: !article.is_read,
    });
  };

  const openArticle = useCallback(
    (article: ArticleListItem) => {
      const rowEl = rowRefs.current.get(article.id);
      if (rowEl && mainRef.current) {
        rowEl.scrollIntoView({ behavior: "smooth", block: "start" });
        // Wait for scroll to settle, then expand
        const onScrollEnd = () => {
          mainRef.current?.removeEventListener("scrollend", onScrollEnd);
          clearTimeout(fallback);
          if (mainRef.current) {
            openScrollTopRef.current = mainRef.current.scrollTop;
          }
          setSelectedArticle(article);
          setIsReaderOpen(true);
        };
        mainRef.current.addEventListener("scrollend", onScrollEnd, {
          once: true,
        });
        // Fallback timeout in case scrollend doesn't fire (already at position)
        const fallback = setTimeout(onScrollEnd, 400);
      } else {
        // No ref or no scroll container — just open immediately
        setSelectedArticle(article);
        setIsReaderOpen(true);
      }
    },
    [mainRef],
  );

  const handleSelect = useCallback(
    (article: ArticleListItem) => {
      // If clicking the already-open article, close it
      if (selectedArticle?.id === article.id && isReaderOpen) {
        setIsReaderOpen(false);
        return;
      }

      // If another article is open, close it first, then open the new one after exit
      if (isReaderOpen) {
        pendingOpenRef.current = article;
        setIsReaderOpen(false);
        return;
      }

      // No reader open — scroll the row to top, then expand
      openArticle(article);
    },
    [selectedArticle, isReaderOpen, openArticle],
  );

  const handleCloseReader = useCallback(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = openScrollTopRef.current;
    }
    setIsReaderOpen(false);
  }, [mainRef]);

  const handleExitComplete = useCallback(() => {
    // If there's a pending article to open (user clicked a different article), open it
    if (pendingOpenRef.current) {
      const next = pendingOpenRef.current;
      pendingOpenRef.current = null;
      openArticle(next);
    } else {
      setSelectedArticle(null);
    }
  }, [openArticle]);

  const handleRescore = (article: ArticleListItem) => {
    rescoreMutation.mutate(article.id);
  };

  const handleMarkAllAsRead = () => {
    if (selection.kind === "feed") {
      markAllRead.mutate(selection.feedId);
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
    return createArticleFilterCollection({
      unreadCount,
      scoringCount,
      blockedCount,
      failedCount,
    });
  }, [unreadCount, scoringCount, blockedCount, failedCount]);

  const emptyState = ARTICLE_EMPTY_STATES[filter];

  return (
    <Box pb={{ base: 16, md: 0 }}>
      {/* Scoring readiness warning */}
      {scoringStatus?.scoring_ready === false &&
        scoringStatus.scoring_ready_reason && (
          <Box px={4} pt={4} pb={0}>
            <Alert.Root status='warning' variant='surface' size='sm'>
              <Alert.Indicator>
                <LuBrainCog />
              </Alert.Indicator>
              <Alert.Title fontSize='xs'>
                {rateLimitCountdown > 0
                  ? `API rate limit exceeded. Will retry automatically in ${rateLimitCountdown} seconds.`
                  : scoringStatus.scoring_ready_reason}
                {scoringStatus.scoring_ready_reason.includes(
                  "LLM Providers",
                ) && (
                  <>
                    {" "}
                    <Link asChild color='fg.warning' textDecoration='underline'>
                      <NextLink href='/settings/llm-providers'>
                        Configure &rarr;
                      </NextLink>
                    </Link>
                  </>
                )}
              </Alert.Title>
            </Alert.Root>
          </Box>
        )}

      {/* Feed name heading */}
      <Flex px={4} pt={4} pb={2} alignItems='center' gap={2}>
        {/* Mobile hamburger */}
        <IconButton
          aria-label='Open sidebar'
          size='sm'
          variant='ghost'
          display={{ base: "flex", md: "none" }}
          onClick={onOpenMobileSidebar}
        >
          <LuMenu />
        </IconButton>
        <Heading ref={headingRef} fontSize='2xl' fontWeight='bold'>
          {feedName}
        </Heading>
        <Box flex={1} />
        <UnreadCountBadge count={unreadCount} />
      </Flex>

      {/* Controls bar (desktop only) */}
      <Flex
        display={{ base: "none", md: "flex" }}
        px={4}
        py={2}
        borderBottom='1px solid'
        borderColor='border.subtle'
        alignItems='center'
        gap={2}
        position='sticky'
        top={0}
        zIndex={5}
        bg='bg'
      >
        {/* Inline feed name when scrolled */}
        {isScrolled && (
          <Text
            fontSize='sm'
            fontWeight='medium'
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
          size='sm'
          value={[filter]}
          onValueChange={(details) => {
            const selected = details.value[0] as FilterTab | undefined;
            if (selected) setFilter(selected);
          }}
          positioning={{ sameWidth: true }}
          width='auto'
          minWidth='130px'
        >
          <Select.HiddenSelect />
          <Select.Control>
            <Select.Trigger>
              <Select.ValueText placeholder='Filter...' />
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

        {/* Mark all read icon button */}
        {filter === "unread" && articleCount > 0 && (
          <>
            <Box w='1px' alignSelf='stretch' my={1} bg='border.subtle' />
            <IconButton
              aria-label='Mark all as read'
              title='Mark all as read'
              size='sm'
              variant='outline'
              onClick={handleMarkAllAsRead}
              disabled={markAllRead.isPending || markAllArticlesRead.isPending}
            >
              <LuCheckCheck />
            </IconButton>
          </>
        )}

        <Box flex={1} />
      </Flex>

      {/* New articles pill */}
      {newCount > 0 && <NewArticlesPill count={newCount} onFlush={flush} />}

      {/* Article list */}
      {isLoading ? (
        <Box>
          {Array.from({ length: 5 }).map((_, i) => (
            <ArticleRowSkeleton key={i} />
          ))}
        </Box>
      ) : displayArticles && displayArticles.length > 0 ? (
        <>
          <Box as='section' aria-label='Article list'>
            {displayArticles.map((article, index) => {
              const isExpanded =
                selectedArticle?.id === article.id && isReaderOpen;
              return (
                <React.Fragment key={article.id}>
                  <ArticleRow
                    ref={(el: HTMLDivElement | null) => {
                      if (el) rowRefs.current.set(article.id, el);
                      else rowRefs.current.delete(article.id);
                    }}
                    article={article}
                    feedName={
                      selection.kind === "feed"
                        ? undefined
                        : feedNames[article.feed_id]
                    }
                    onSelect={handleSelect}
                    onToggleRead={handleToggleRead}
                    onRescore={handleRescore}
                    isCompleting={completingIds.has(article.id)}
                    isExpanded={isExpanded}
                    onClose={isExpanded ? handleCloseReader : undefined}
                    onOpenOriginal={
                      isExpanded
                        ? () =>
                            window.open(
                              article.url,
                              "_blank",
                              "noopener,noreferrer",
                            )
                        : undefined
                    }
                    onNavigatePrev={
                      isExpanded && index > 0
                        ? () => handleSelect(displayArticles[index - 1])
                        : null
                    }
                    onNavigateNext={
                      isExpanded && index < displayArticles.length - 1
                        ? () => handleSelect(displayArticles[index + 1])
                        : null
                    }
                    scoringPhase={
                      article.scoring_state === "scoring" &&
                      scoringStatus?.phase &&
                      scoringStatus.phase !== "idle"
                        ? scoringStatus.phase
                        : undefined
                    }
                  />
                  {selectedArticle?.id === article.id && (
                    <Collapsible.Root
                      open={isReaderOpen}
                      lazyMount
                      unmountOnExit
                      onExitComplete={handleExitComplete}
                    >
                      <Collapsible.Content>
                        <ArticleReader
                          key={article.id}
                          article={selectedArticle}
                          articles={displayArticles ?? []}
                          feedName={feedNames[selectedArticle.feed_id]}
                          onClose={handleCloseReader}
                          onNavigate={handleSelect}
                          showHeader={false}
                        />
                      </Collapsible.Content>
                    </Collapsible.Root>
                  )}
                </React.Fragment>
              );
            })}
          </Box>

          {/* Load more button */}
          {hasMore && (
            <Flex justifyContent='center' py={4}>
              <Button
                colorPalette='accent'
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
          direction='column'
          alignItems='center'
          justifyContent='center'
          gap={4}
          py={16}
          px={8}
        >
          <Icon as={emptyState.icon} boxSize={12} color='fg.subtle' />
          <Text fontSize='lg' color='fg.muted' textAlign='center'>
            {emptyState.message}
          </Text>
          {filter === "all" && (
            <Text fontSize='sm' color='fg.subtle' textAlign='center'>
              Add feeds from the sidebar to get started
            </Text>
          )}
        </Flex>
      )}

      {/* Mobile action bar */}
      <MobileArticleActionBar
        filter={filter}
        onFilterChange={setFilter}
        sortOption={sortOption}
        onSortChange={setSortOption}
        onMarkAllRead={handleMarkAllAsRead}
        canMarkAllRead={filter === "unread" && articleCount > 0}
        isMarkingRead={markAllRead.isPending || markAllArticlesRead.isPending}
        scoringCount={scoringCount}
        blockedCount={blockedCount}
        failedCount={failedCount}
      />

      {/* Confirm mark all articles read dialog */}
      <ConfirmDialog
        open={isConfirmMarkAllOpen}
        onOpenChange={({ open }) => setIsConfirmMarkAllOpen(open)}
        title='Mark all articles as read?'
        body='This will mark all unread articles across all feeds as read.'
        confirmLabel='Mark all read'
        confirmColorPalette='accent'
        onConfirm={handleConfirmMarkAllArticlesRead}
      />
    </Box>
  );
}
