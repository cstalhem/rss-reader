"use client";

import { Box, Flex, Text, Spinner } from "@chakra-ui/react";
import { Article } from "@/lib/types";
import { formatRelativeDate } from "@/lib/utils";
import { TagChip } from "./TagChip";
import { ScoreBadge } from "./ScoreBadge";

interface ArticleRowProps {
  article: Article;
  feedName?: string;
  onSelect: (article: Article) => void;
  onToggleRead: (article: Article) => void;
  isCompleting?: boolean;
}

export function ArticleRow({
  article,
  feedName,
  onSelect,
  onToggleRead,
  isCompleting = false,
}: ArticleRowProps) {
  // Add subtle accent background tint for high-scored rows
  const isHighScored = article.scoring_state === "scored" &&
    article.composite_score !== null &&
    article.composite_score >= 15;

  return (
    <Flex
      py={3}
      px={4}
      gap={3}
      borderBottom="1px solid"
      borderColor="border.subtle"
      cursor="pointer"
      opacity={article.is_read && !isCompleting ? 0.6 : 1}
      bg={isHighScored ? "accent.subtle" : undefined}
      _hover={{ bg: "bg.subtle" }}
      onClick={() => onSelect(article)}
      css={isCompleting ? {
        animation: "scoreReveal 3s ease-out forwards",
        "@keyframes scoreReveal": {
          "0%": {
            backgroundColor: "color-mix(in srgb, var(--chakra-colors-accent-solid) 20%, transparent)",
          },
          "40%": {
            backgroundColor: "color-mix(in srgb, var(--chakra-colors-accent-solid) 5%, transparent)",
            opacity: 1,
          },
          "80%": {
            opacity: 1,
            backgroundColor: "transparent",
          },
          "100%": {
            opacity: 0,
            backgroundColor: "transparent",
          },
        },
      } : undefined}
    >
      {/* Read/unread toggle dot */}
      <Box
        flexShrink={0}
        alignSelf="center"
        px={2}
        cursor="pointer"
        onClick={(e) => {
          e.stopPropagation();
          onToggleRead(article);
        }}
        title={article.is_read ? "Mark as unread" : "Mark as read"}
      >
        <Box
          w="10px"
          h="10px"
          borderRadius="full"
          bg={article.is_read ? "transparent" : "accent.solid"}
          borderWidth="2px"
          borderColor={article.is_read ? "fg.muted" : "accent.solid"}
        />
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

        {/* Source, date, and category tags */}
        <Flex gap={2} alignItems="center" flexWrap="wrap">
          <Text fontSize="sm" color="fg.muted" flexShrink={0}>
            {feedName ? `${feedName} • ` : ""}{formatRelativeDate(article.published_at)}
          </Text>
          {article.categories && article.categories.length > 0 && (
            <>
              <Box w="1px" h="14px" bg="border.subtle" flexShrink={0} />
              {article.categories.slice(0, 3).map((category, index) => (
                <TagChip key={index} label={category} size="sm" />
              ))}
              {article.categories.length > 3 && (
                <Text fontSize="xs" color="fg.muted">
                  +{article.categories.length - 3}
                </Text>
              )}
            </>
          )}
        </Flex>
      </Flex>

      {/* Scoring state indicator and score badge */}
      <Flex flexShrink={0} alignItems="center" gap={2}>
        {/* Scoring state indicators for non-scored states */}
        {article.scoring_state === "scoring" && (
          <Spinner size="xs" colorPalette="accent" />
        )}
        {(article.scoring_state === "queued" || article.scoring_state === "unscored") && (
          <Box
            w="8px"
            h="8px"
            borderRadius="full"
            bg="fg.muted"
            css={{
              animation: "pulse 2s ease-in-out infinite",
              "@keyframes pulse": {
                "0%, 100%": { opacity: 0.4 },
                "50%": { opacity: 1 },
              },
            }}
          />
        )}
        {article.scoring_state === "failed" && (
          <Text fontSize="xs" color="red.fg">✕</Text>
        )}

        {/* Score badge for scored articles */}
        <ScoreBadge
          score={article.composite_score}
          scoringState={article.scoring_state}
          size="sm"
        />
      </Flex>
    </Flex>
  );
}
