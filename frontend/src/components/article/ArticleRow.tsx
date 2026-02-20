"use client";

import React from "react";
import { Box, Flex, Text, Spinner } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { LuClock } from "react-icons/lu";
import { ArticleListItem } from "@/lib/types";
import { formatRelativeDate } from "@/lib/utils";
import { HIGH_SCORE_THRESHOLD } from "@/lib/constants";
import { TagChip } from "./TagChip";
import { ScoreBadge } from "./ScoreBadge";

const MAX_VISIBLE_TAGS = 3;

const pulsingIcon = keyframes`
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
`;

const scoreReveal = keyframes`
  0% { background-color: rgba(255, 140, 50, 0.18); }
  40% { background-color: rgba(255, 140, 50, 0.06); opacity: 1; }
  80% { opacity: 1; background-color: transparent; }
  100% { opacity: 0; background-color: transparent; }
`;

interface ArticleRowProps {
  article: ArticleListItem;
  feedName?: string;
  onSelect: (article: ArticleListItem) => void;
  onToggleRead: (article: ArticleListItem) => void;
  isCompleting?: boolean;
  scoringPhase?: string;
}

export const ArticleRow = React.memo(function ArticleRow({
  article,
  feedName,
  onSelect,
  onToggleRead,
  isCompleting = false,
  scoringPhase,
}: ArticleRowProps) {
  // Add subtle accent background tint for high-scored rows
  const isHighScored = article.scoring_state === "scored" &&
    article.composite_score !== null &&
    article.composite_score >= HIGH_SCORE_THRESHOLD;

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
        animation: `${scoreReveal} 3s ease-out forwards`,
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
              {article.categories.slice(0, MAX_VISIBLE_TAGS).map((cat) => (
                <TagChip key={cat.id} label={cat.display_name} size="sm" />
              ))}
              {article.categories.length > MAX_VISIBLE_TAGS && (
                <Text fontSize="xs" color="fg.muted">
                  +{article.categories.length - MAX_VISIBLE_TAGS}
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
          <Flex alignItems="center" gap={1.5}>
            <Text fontSize="xs" color="fg.muted">
              {scoringPhase === "thinking"
                ? "Thinking…"
                : scoringPhase === "categorizing"
                  ? "Categorizing…"
                  : scoringPhase === "scoring"
                    ? "Scoring…"
                    : scoringPhase === "starting"
                      ? "Starting…"
                      : "Scoring complete"}
            </Text>
            <Spinner
              size="xs"
              colorPalette={
                scoringPhase === "thinking"
                  ? "blue"
                  : scoringPhase === "categorizing" || scoringPhase === "scoring"
                    ? "accent"
                    : scoringPhase
                      ? "gray"
                      : "green"
              }
            />
          </Flex>
        )}
        {(article.scoring_state === "queued" || article.scoring_state === "unscored") && (
          <Flex
            alignItems="center"
            gap={1.5}
            css={{ animation: `${pulsingIcon} 2s ease-in-out infinite` }}
          >
            <Text fontSize="xs" color="fg.muted">Queued</Text>
            <Box color="white" fontSize="sm">
              <LuClock />
            </Box>
          </Flex>
        )}
        {article.scoring_state === "failed" && (
          <Text fontSize="xs" color="red.fg">✕ Failed</Text>
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
});
