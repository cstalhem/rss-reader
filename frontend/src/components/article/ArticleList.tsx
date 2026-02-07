"use client";

import { useState } from "react";
import { Box, Flex, Button, Text, Skeleton, Stack } from "@chakra-ui/react";
import { useArticles, useMarkAsRead } from "@/hooks/useArticles";
import { ArticleRow } from "./ArticleRow";
import { ArticleReader } from "./ArticleReader";
import { Article } from "@/lib/types";

export function ArticleList() {
  const [showAll, setShowAll] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  const { data: articles, isLoading, loadMore, hasMore } = useArticles({ showAll });
  const markAsRead = useMarkAsRead();

  const handleToggleRead = (article: Article) => {
    markAsRead.mutate({
      articleId: article.id,
      isRead: !article.is_read,
    });
  };

  const handleSelect = (article: Article) => {
    setSelectedArticle(article);
  };

  const articleCount = articles?.length ?? 0;
  const countLabel = showAll
    ? `${articleCount} article${articleCount !== 1 ? "s" : ""}`
    : `${articleCount} unread article${articleCount !== 1 ? "s" : ""}`;

  return (
    <Box>
      {/* Top bar with filter toggle and count */}
      <Flex
        px={4}
        py={3}
        borderBottom="1px solid"
        borderColor="border.subtle"
        alignItems="center"
        justifyContent="space-between"
      >
        <Flex gap={2}>
          <Button
            size="sm"
            variant={!showAll ? "solid" : "ghost"}
            colorPalette={!showAll ? "accent" : undefined}
            onClick={() => setShowAll(false)}
          >
            Unread
          </Button>
          <Button
            size="sm"
            variant={showAll ? "solid" : "ghost"}
            colorPalette={showAll ? "accent" : undefined}
            onClick={() => setShowAll(true)}
          >
            All
          </Button>
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
            {showAll
              ? "No articles yet. Add some feeds to get started."
              : "No unread articles. You're all caught up!"}
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
