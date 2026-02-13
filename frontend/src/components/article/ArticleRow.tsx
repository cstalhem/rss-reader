"use client";

import { Box, Flex, Text, IconButton, Spinner } from "@chakra-ui/react";
import { LuClock } from "react-icons/lu";
import { Article } from "@/lib/types";
import { formatRelativeDate } from "@/lib/utils";
import { TagChip } from "./TagChip";

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

        {/* Category tags */}
        {article.categories && article.categories.length > 0 && (
          <Flex gap={1} flexWrap="wrap" mt={1}>
            {article.categories.slice(0, 3).map((category, index) => (
              <TagChip key={index} label={category} size="sm" />
            ))}
            {article.categories.length > 3 && (
              <Text fontSize="xs" color="fg.muted" alignSelf="center">
                +{article.categories.length - 3}
              </Text>
            )}
          </Flex>
        )}
      </Flex>

      {/* Scoring state indicator and toggle read/unread button */}
      <Flex flexShrink={0} alignItems="center" gap={2}>
        {/* Scoring state indicator */}
        <Box fontSize="xs" color="fg.muted">
          {article.scoring_state === "scoring" && (
            <Spinner size="xs" colorPalette="accent" />
          )}
          {article.scoring_state === "queued" && (
            <LuClock size={14} />
          )}
          {article.scoring_state === "unscored" && (
            <Text>—</Text>
          )}
          {article.scoring_state === "failed" && (
            <Text color="red.fg">✕</Text>
          )}
          {article.scoring_state === "scored" && article.composite_score !== null && (
            <Text
              fontWeight="medium"
              color={
                article.composite_score >= 15
                  ? "accent.fg"
                  : article.composite_score >= 10
                  ? "fg.default"
                  : "fg.muted"
              }
            >
              {article.composite_score.toFixed(1)}
            </Text>
          )}
        </Box>
        {/* Toggle read/unread button */}
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
      </Flex>
    </Flex>
  );
}
