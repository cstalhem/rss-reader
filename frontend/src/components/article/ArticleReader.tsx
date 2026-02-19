"use client";

import { useMemo, useState, useEffect } from "react";
import {
  Box,
  Flex,
  Text,
  IconButton,
  Link,
  Drawer,
  Separator,
} from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Article } from "@/lib/types";
import { formatRelativeDate } from "@/lib/utils";
import { updateCategory as apiUpdateCategory } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useAutoMarkAsRead } from "@/hooks/useAutoMarkAsRead";
import { TagChip } from "./TagChip";
import { ScoreBadge } from "./ScoreBadge";

interface ArticleReaderProps {
  article: Article | null;
  articles: Article[];
  onClose: () => void;
  onNavigate: (article: Article) => void;
}

export function ArticleReader({
  article,
  articles,
  onClose,
  onNavigate,
}: ArticleReaderProps) {
  const isOpen = article !== null;

  // Trigger auto-mark as read when article is displayed
  useAutoMarkAsRead(article?.id ?? 0, article?.is_read ?? true);

  // Optimistic weight state for instant visual feedback
  const [optimisticWeights, setOptimisticWeights] = useState<Record<number, string>>({});

  // Reset optimistic state when article changes
  useEffect(() => {
    setOptimisticWeights({});
  }, [article?.id]);

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
    if (!article || articles.length === 0) {
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

  if (!article) return null;

  const contentHtml = article.content || article.summary || "";

  return (
    <Drawer.Root
      open={isOpen}
      onOpenChange={(details) => {
        if (!details.open) {
          onClose();
        }
      }}
      placement="end"
      size={{ base: "full", md: "xl" }}
    >
      <Drawer.Backdrop />
      <Drawer.Positioner>
        <Drawer.Content
          css={{
            width: { base: "100%", md: "75vw" },
            maxWidth: { base: "100%", md: "75vw" },
          }}
        >
          <Drawer.Body px={{ base: 6, md: 12 }} py={{ base: 6, md: 8 }}>
            {/* Nav buttons -- scroll with content */}
            <Flex justifyContent="flex-end" gap={2} mb={6}>
              <IconButton
                aria-label="Previous article"
                size="sm"
                variant="ghost"
                colorPalette="accent"
                _hover={{ bg: "accent.subtle" }}
                disabled={!prevArticle}
                onClick={() => prevArticle && onNavigate(prevArticle)}
              >
                ←
              </IconButton>
              <IconButton
                aria-label="Next article"
                size="sm"
                variant="ghost"
                colorPalette="accent"
                _hover={{ bg: "accent.subtle" }}
                disabled={!nextArticle}
                onClick={() => nextArticle && onNavigate(nextArticle)}
              >
                →
              </IconButton>
              <Drawer.CloseTrigger position="static" />
            </Flex>

            {/* Article header */}
            <Flex direction="column" gap={5} mb={10}>
              {/* Title */}
              <Text
                textStyle="reader.heading"
                fontSize="3xl"
                fontWeight="700"
                fontFamily="sans"
                lineHeight="1.25"
                letterSpacing="-0.01em"
              >
                {article.title}
              </Text>

              {/* Metadata */}
              <Flex gap={4} alignItems="center" fontSize="sm" color="fg.muted">
                <Text>Feed</Text>
                <Text>•</Text>
                <Text>{formatRelativeDate(article.published_at)}</Text>
                {article.author && (
                  <>
                    <Text>•</Text>
                    <Text>{article.author}</Text>
                  </>
                )}
              </Flex>

              {/* Category Tags */}
              {article.categories && article.categories.length > 0 && (
                <Flex gap={2} flexWrap="wrap" mt={2}>
                  {article.categories.map((cat) => (
                    <TagChip
                      key={cat.id}
                      label={cat.display_name}
                      size="md"
                      interactive={true}
                      currentWeight={optimisticWeights[cat.id] ?? cat.effective_weight}
                      onWeightChange={(weight) => {
                        setOptimisticWeights(prev => ({ ...prev, [cat.id]: weight }));
                        updateCategoryWeightMutation.mutate({ categoryId: cat.id, weight });
                      }}
                    />
                  ))}
                </Flex>
              )}

              {/* Score Display */}
              {article.scoring_state === "scored" ? (
                <Box mt={3}>
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
                        <Text fontSize="sm" color="fg.muted">•</Text>
                        <Text fontSize="sm" color="fg.muted">
                          Quality: {article.quality_score.toFixed(0)}/10
                        </Text>
                      </>
                    )}
                  </Flex>
                  {article.score_reasoning && (
                    <Text
                      mt={2}
                      fontSize="sm"
                      color="fg.muted"
                      fontStyle="italic"
                      lineHeight="1.6"
                    >
                      {article.score_reasoning}
                    </Text>
                  )}
                </Box>
              ) : (
                <Box mt={3}>
                  <Text fontSize="sm" color="fg.muted">
                    {article.scoring_state === "scoring" && "Scoring in progress..."}
                    {article.scoring_state === "queued" && "Queued for scoring..."}
                    {article.scoring_state === "unscored" && "Not yet scored"}
                    {article.scoring_state === "failed" && "Scoring failed"}
                  </Text>
                </Box>
              )}

              <Separator />

              {/* Actions */}
              <Link
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                fontSize="sm"
                colorPalette="accent"
                fontWeight="medium"
                _hover={{ color: "accent.emphasized" }}
              >
                Open original →
              </Link>

              <Separator />
            </Flex>

            {/* Article body */}
            <Box
              textStyle="reader"
              maxW="680px"
              mx="auto"
              css={{
                "& img": {
                  maxWidth: "100%",
                  height: "auto",
                  maxHeight: "600px",
                  objectFit: "contain",
                  borderRadius: "md",
                  my: 4,
                },
                "& a": {
                  textDecoration: "underline",
                },
                "& h1, & h2, & h3, & h4, & h5, & h6": {
                  fontWeight: "600",
                  mt: 6,
                  mb: 3,
                  lineHeight: "1.3",
                },
                "& h1": { fontSize: "2xl" },
                "& h2": { fontSize: "xl" },
                "& h3": { fontSize: "lg" },
                "& p": {
                  mb: 5,
                  lineHeight: "1.85",
                },
                "& ul, & ol": {
                  pl: 6,
                  mb: 4,
                },
                "& li": {
                  mb: 2,
                },
                "& blockquote": {
                  borderLeftWidth: "4px",
                  borderColor: "border.emphasized",
                  pl: 4,
                  py: 2,
                  my: 4,
                  fontStyle: "italic",
                  color: "fg.muted",
                },
                "& pre": {
                  bg: "oklch(13% 0.008 55)",
                  p: 5,
                  borderRadius: "lg",
                  overflowX: "auto",
                  my: 5,
                  borderWidth: "1px",
                  borderColor: "border.subtle",
                },
                "& code": {
                  fontFamily: "mono",
                  fontSize: "0.875em",
                  lineHeight: "1.6",
                },
                "& pre code": {
                  bg: "transparent",
                  p: 0,
                },
                "& :not(pre) > code": {
                  bg: "bg.emphasized",
                  px: 1.5,
                  py: 0.5,
                  borderRadius: "sm",
                  fontSize: "0.875em",
                },
              }}
              dangerouslySetInnerHTML={{ __html: contentHtml }}
            />
          </Drawer.Body>
        </Drawer.Content>
      </Drawer.Positioner>
    </Drawer.Root>
  );
}
