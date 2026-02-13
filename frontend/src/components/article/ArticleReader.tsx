"use client";

import { useMemo } from "react";
import {
  Box,
  Flex,
  Text,
  IconButton,
  Link,
  Drawer,
  Separator,
} from "@chakra-ui/react";
import { Article } from "@/lib/types";
import { formatRelativeDate } from "@/lib/utils";
import { useAutoMarkAsRead } from "@/hooks/useAutoMarkAsRead";
import { usePreferences } from "@/hooks/usePreferences";
import { TagChip } from "./TagChip";

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

  // Get preferences for tag weights
  const { preferences, updateCategoryWeight } = usePreferences();

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
          <Drawer.Header borderBottomWidth="1px" px={{ base: 6, md: 12 }}>
            <Flex direction="column" gap={4} py={6} pr={16}>
              {/* Title */}
              <Text
                textStyle="reader.heading"
                fontSize="2xl"
                fontWeight="600"
                lineHeight="1.3"
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
                  {article.categories.map((category, index) => {
                    const currentWeight =
                      preferences?.topic_weights?.[category.toLowerCase()] || "neutral";
                    return (
                      <TagChip
                        key={index}
                        label={category}
                        size="md"
                        interactive={true}
                        currentWeight={currentWeight}
                        onWeightChange={(weight) =>
                          updateCategoryWeight({ category: category.toLowerCase(), weight })
                        }
                      />
                    );
                  })}
                </Flex>
              )}

              {/* Score Display */}
              {article.scoring_state === "scored" ? (
                <Box mt={3}>
                  <Flex gap={3} alignItems="baseline">
                    <Text fontSize="md" fontWeight="medium" color="fg.default">
                      Score:{" "}
                      <Text
                        as="span"
                        fontSize="lg"
                        fontWeight="semibold"
                        color={
                          article.composite_score! >= 15
                            ? "accent.fg"
                            : article.composite_score! >= 10
                            ? "fg.default"
                            : "fg.muted"
                        }
                      >
                        {article.composite_score?.toFixed(1)}/20
                      </Text>
                    </Text>
                    {article.quality_score !== null && (
                      <Text fontSize="sm" color="fg.muted">
                        Quality: {article.quality_score.toFixed(0)}/10
                      </Text>
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

              <Separator mt={4} />

              {/* Actions */}
              <Flex gap={2} mt={4}>
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
              </Flex>

              {/* Navigation arrows */}
              <Flex gap={2} position="absolute" top={4} right={12}>
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
              </Flex>
            </Flex>

            <Drawer.CloseTrigger />
          </Drawer.Header>

          <Drawer.Body px={{ base: 6, md: 12 }} py={{ base: 6, md: 8 }}>
            <Box
              textStyle="reader"
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
                  bg: "bg.subtle",
                  p: 4,
                  borderRadius: "md",
                  overflowX: "auto",
                  my: 4,
                },
                "& code": {
                  fontFamily: "monospace",
                  fontSize: "0.9em",
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
