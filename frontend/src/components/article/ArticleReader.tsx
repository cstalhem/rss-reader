"use client";

import { useMemo, useState } from "react";
import {
  Box,
  Flex,
  Text,
  IconButton,
  Spinner,
} from "@chakra-ui/react";
import {
  LuExternalLink,
  LuChevronUp,
  LuChevronDown,
  LuX,
} from "react-icons/lu";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArticleListItem } from "@/lib/types";
import { formatRelativeDate } from "@/lib/utils";
import { fetchArticle, updateCategory as apiUpdateCategory } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useAutoMarkAsRead } from "@/hooks/useAutoMarkAsRead";
import { TagChip } from "./TagChip";
import { ScoreBadge } from "./ScoreBadge";
import { ArticleContent } from "./ArticleContent";

interface ArticleReaderProps {
  article: ArticleListItem;
  articles: ArticleListItem[];
  onClose: () => void;
  onNavigate: (article: ArticleListItem) => void;
}

export function ArticleReader({
  article,
  articles,
  onClose,
  onNavigate,
}: ArticleReaderProps) {
  // Fetch full article content on demand
  const { data: fullArticle, isLoading: isLoadingContent } = useQuery({
    queryKey: queryKeys.articles.detail(article.id),
    queryFn: () => fetchArticle(article.id),
  });

  // Trigger auto-mark as read when article is displayed
  useAutoMarkAsRead(article.id, article.is_read);

  // Optimistic weight state for instant visual feedback
  // State resets automatically when parent uses key={article.id}
  const [optimisticWeights, setOptimisticWeights] = useState<Record<number, string>>({});

  const queryClient = useQueryClient();
  const updateCategoryWeightMutation = useMutation({
    mutationFn: ({ categoryId, weight }: { categoryId: number; weight: string }) =>
      apiUpdateCategory(categoryId, { weight }),
    meta: { errorTitle: "Failed to update category weight" },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
    },
  });

  // Determine prev/next articles
  const { prevArticle, nextArticle } = useMemo(() => {
    if (articles.length === 0) {
      return { prevArticle: null, nextArticle: null };
    }

    const currentIndex = articles.findIndex((a) => a.id === article.id);
    if (currentIndex === -1) {
      return { prevArticle: null, nextArticle: null };
    }

    return {
      prevArticle: currentIndex > 0 ? articles[currentIndex - 1] : null,
      nextArticle:
        currentIndex < articles.length - 1 ? articles[currentIndex + 1] : null,
    };
  }, [article, articles]);

  // Use full article content when available, fall back to empty while loading
  const contentHtml = fullArticle?.content || fullArticle?.summary || "";

  return (
    <Box>
      {/* Sticky header bar */}
      <Flex
        position="sticky"
        top={0}
        zIndex={2}
        bg="bg"
        borderBottomWidth="1px"
        borderColor="border.subtle"
        alignItems="center"
        gap={2}
        px={4}
        py={2}
      >
        <Text
          flex={1}
          whiteSpace="nowrap"
          overflow="hidden"
          textOverflow="ellipsis"
          fontSize="sm"
          fontWeight="medium"
        >
          {article.title}
        </Text>
        <IconButton
          aria-label="Open original"
          title="Open original"
          size="sm"
          variant="ghost"
          onClick={() => window.open(article.url, "_blank", "noopener,noreferrer")}
        >
          <LuExternalLink />
        </IconButton>
        <IconButton
          aria-label="Previous article"
          title="Previous article"
          size="sm"
          variant="ghost"
          disabled={!prevArticle}
          onClick={() => prevArticle && onNavigate(prevArticle)}
        >
          <LuChevronUp />
        </IconButton>
        <IconButton
          aria-label="Next article"
          title="Next article"
          size="sm"
          variant="ghost"
          disabled={!nextArticle}
          onClick={() => nextArticle && onNavigate(nextArticle)}
        >
          <LuChevronDown />
        </IconButton>
        <IconButton
          aria-label="Close reader"
          title="Close reader"
          size="sm"
          variant="ghost"
          onClick={onClose}
        >
          <LuX />
        </IconButton>
      </Flex>

      {/* Scrollable content area */}
      <Box maxW="800px" mx="auto" px={{ base: 4, md: 8 }} py={6}>
        {/* Article title */}
        <Text
          textStyle="reader.heading"
          fontSize="3xl"
          fontWeight="700"
          fontFamily="sans"
          lineHeight="1.25"
          letterSpacing="-0.01em"
          mb={4}
        >
          {article.title}
        </Text>

        {/* Metadata */}
        <Flex gap={4} alignItems="center" fontSize="sm" color="fg.muted" mb={3}>
          <Text>Feed</Text>
          <Text>*</Text>
          <Text>{formatRelativeDate(article.published_at)}</Text>
          {article.author && (
            <>
              <Text>*</Text>
              <Text>{article.author}</Text>
            </>
          )}
        </Flex>

        {/* Category Tags */}
        {article.categories && article.categories.length > 0 && (
          <Flex gap={2} flexWrap="wrap" mb={4}>
            {article.categories.map((cat) => (
              <TagChip
                key={cat.id}
                label={cat.display_name}
                size="md"
                interactive={true}
                currentWeight={optimisticWeights[cat.id] ?? cat.effective_weight}
                onWeightChange={(weight) => {
                  setOptimisticWeights((prev) => ({ ...prev, [cat.id]: weight }));
                  updateCategoryWeightMutation.mutate({ categoryId: cat.id, weight });
                }}
              />
            ))}
          </Flex>
        )}

        {/* Score Display */}
        {article.scoring_state === "scored" ? (
          <Box mb={6}>
            <Flex gap={3} alignItems="center">
              <ScoreBadge
                score={article.composite_score}
                scoringState={article.scoring_state}
                size="md"
              />
              <Text fontSize="md" color="fg.muted">
                /20
              </Text>
              {article.quality_score !== null && (
                <>
                  <Text fontSize="sm" color="fg.muted">*</Text>
                  <Text fontSize="sm" color="fg.muted">
                    Quality: {article.quality_score.toFixed(0)}/10
                  </Text>
                </>
              )}
            </Flex>
            {fullArticle?.score_reasoning && (
              <Text
                mt={2}
                fontSize="sm"
                color="fg.muted"
                fontStyle="italic"
                lineHeight="1.6"
              >
                {fullArticle.score_reasoning}
              </Text>
            )}
          </Box>
        ) : (
          <Box mb={6}>
            <Text fontSize="sm" color="fg.muted">
              {article.scoring_state === "scoring" && "Scoring in progress..."}
              {article.scoring_state === "queued" && "Queued for scoring..."}
              {article.scoring_state === "unscored" && "Not yet scored"}
              {article.scoring_state === "failed" && "Scoring failed"}
            </Text>
          </Box>
        )}

        {/* Article body */}
        {isLoadingContent ? (
          <Flex justifyContent="center" py={12}>
            <Spinner size="lg" colorPalette="accent" />
          </Flex>
        ) : (
          <ArticleContent html={contentHtml} />
        )}
      </Box>
    </Box>
  );
}
