"use client";

import { Box, Flex, Text, IconButton } from "@chakra-ui/react";
import { Article } from "@/lib/types";
import { formatRelativeDate } from "@/lib/utils";

interface ArticleRowProps {
  article: Article;
  onSelect: (article: Article) => void;
  onToggleRead: (article: Article) => void;
}

export function ArticleRow({
  article,
  onSelect,
  onToggleRead,
}: ArticleRowProps) {
  return (
    <Flex
      py={3}
      px={4}
      gap={3}
      borderBottom="1px solid"
      borderColor="border.subtle"
      cursor="pointer"
      opacity={article.is_read ? 0.6 : 1}
      _hover={{ bg: "bg.subtle" }}
      onClick={() => onSelect(article)}
    >
      {/* Unread indicator dot */}
      <Box flexShrink={0} pt={1}>
        {!article.is_read && (
          <Box w="8px" h="8px" borderRadius="full" bg="colorPalette.solid" />
        )}
      </Box>

      {/* Main content */}
      <Flex flex={1} direction="column" gap={1} minW={0}>
        {/* Title - truncated */}
        <Text
          fontSize="md"
          fontWeight="medium"
          color="fg.default"
          whiteSpace="nowrap"
          overflow="hidden"
          textOverflow="ellipsis"
        >
          {article.title}
        </Text>

        {/* Source and date */}
        <Text fontSize="sm" color="fg.muted">
          Feed • {formatRelativeDate(article.published_at)}
        </Text>

        {/* Reserved space for future LLM reasoning/summary (Phase 5) */}
        <Box minH="0" />
      </Flex>

      {/* Toggle read/unread button */}
      <Box flexShrink={0}>
        <IconButton
          aria-label={article.is_read ? "Mark as unread" : "Mark as read"}
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onToggleRead(article);
          }}
        >
          {article.is_read ? "○" : "●"}
        </IconButton>
      </Box>
    </Flex>
  );
}
