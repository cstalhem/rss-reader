"use client";

import React, { useState } from "react";
import { Box, Flex, Text, Spinner, IconButton } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { LuClock, LuSparkles, LuExternalLink, LuChevronUp, LuChevronDown, LuX } from "react-icons/lu";
import { ArticleListItem } from "@/lib/types";
import { formatRelativeDate } from "@/lib/utils";
import { TagChip } from "./TagChip";
import { ScoreBadge } from "./ScoreBadge";
import { ArticleRowContextMenu } from "./ArticleRowContextMenu";

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
  onRescore?: (article: ArticleListItem) => void;
  isCompleting?: boolean;
  scoringPhase?: string;
  isExpanded?: boolean;
  onClose?: () => void;
  onOpenOriginal?: () => void;
  onNavigatePrev?: (() => void) | null;
  onNavigateNext?: (() => void) | null;
}

export const ArticleRow = React.memo(React.forwardRef<HTMLDivElement, ArticleRowProps>(
  function ArticleRow({ article, feedName, onSelect, onToggleRead, onRescore, isCompleting = false, scoringPhase, isExpanded, onClose, onOpenOriginal, onNavigatePrev, onNavigateNext }: ArticleRowProps, ref) {
  const [isHovered, setIsHovered] = useState(false);

  // Determine summary/preview text
  const previewText = article.score_reasoning || article.summary_preview;
  const isAiGenerated = !!article.score_reasoning;

  return (
    <Flex
      ref={ref}
      as="article"
      px={4}
      gap={3}
      borderBottom="1px solid"
      borderColor="border.subtle"
      onClick={() => onSelect(article)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...(isExpanded ? {
        position: "sticky" as const,
        top: 0,
        zIndex: 10,
        py: 2,
        bg: "bg",
        cursor: "default",
      } : {
        py: 3,
        cursor: "pointer",
        bg: !article.is_read ? "bg.subtle" : undefined,
        _hover: { bg: "bg.subtle" },
        css: isCompleting ? { animation: `${scoreReveal} 3s ease-out forwards` } : undefined,
      })}
    >
      {/* Read/unread toggle dot - only render for unread articles */}
      {!article.is_read && (
        <Box
          overflow="hidden"
          transition="max-height 0.2s ease, opacity 0.15s ease"
          {...(isExpanded ? { maxH: 0, opacity: 0 } : { maxH: "10", opacity: 1 })}
        >
          <Box
            flexShrink={0}
            alignSelf="center"
            px={2}
            cursor="pointer"
            onClick={(e) => {
              e.stopPropagation();
              onToggleRead(article);
            }}
            title="Mark as read"
          >
            <Box
              w="10px"
              h="10px"
              borderRadius="full"
              bg="accent.solid"
            />
          </Box>
        </Box>
      )}

      {/* Main content */}
      <Flex flex={1} direction="column" gap={1} minW={0}>
        {/* Title - truncated */}
        <Text
          fontSize={isExpanded ? "sm" : "md"}
          fontWeight={isExpanded ? "medium" : (article.is_read ? "normal" : "semibold")}
          color="fg.default"
          whiteSpace="nowrap"
          overflow="hidden"
          textOverflow="ellipsis"
        >
          {article.title}
        </Text>

        {/* Source, date, and category tags */}
        <Box
          overflow="hidden"
          transition="max-height 0.2s ease, opacity 0.15s ease"
          {...(isExpanded ? { maxH: 0, opacity: 0 } : { maxH: "10", opacity: 1 })}
        >
          <Flex gap={2} alignItems="center" flexWrap="wrap">
            <Text fontSize="sm" color="fg.muted" flexShrink={0}>
              {feedName ? `${feedName} \u2022 ` : ""}{formatRelativeDate(article.published_at)}
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
        </Box>

        {/* Summary/preview line */}
        <Box
          overflow="hidden"
          transition="max-height 0.2s ease, opacity 0.15s ease"
          {...(isExpanded ? { maxH: 0, opacity: 0 } : { maxH: "10", opacity: 1 })}
        >
          {previewText && (
            <Flex gap={1} alignItems="flex-start">
              {isAiGenerated && (
                <Box flexShrink={0} color="fg.muted" mt="2px">
                  <LuSparkles size={14} />
                </Box>
              )}
              <Text
                fontSize="sm"
                color="fg.muted"
                css={{
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  display: "-webkit-box",
                  overflow: "hidden",
                }}
              >
                {previewText}
              </Text>
            </Flex>
          )}
        </Box>
      </Flex>

      {/* Right side: scoring indicators or expanded nav */}
      {!isExpanded && (
        <Flex flexShrink={0} alignItems="center" gap={2}
          transition="opacity 0.15s ease"
          opacity={1}
        >
          {/* Scoring state indicators for non-scored states */}
          {article.scoring_state === "scoring" && (
            <Flex alignItems="center" gap={1.5}>
              <Text fontSize="xs" color="fg.muted">
                {scoringPhase === "thinking"
                  ? "Thinking\u2026"
                  : scoringPhase === "categorizing"
                    ? "Categorizing\u2026"
                    : scoringPhase === "scoring"
                      ? "Scoring\u2026"
                      : scoringPhase === "starting"
                        ? "Starting\u2026"
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
            <Text fontSize="xs" color="red.fg">&#10005; Failed</Text>
          )}

          {/* Score badge for scored articles */}
          <ScoreBadge
            score={article.composite_score}
            scoringState={article.scoring_state}
            size="sm"
          />

          {/* Context menu for read articles (hover-reveal) */}
          {isHovered && article.is_read && onRescore && (
            <ArticleRowContextMenu
              article={article}
              onMarkUnread={() => onToggleRead(article)}
              onRescore={() => onRescore(article)}
            />
          )}
        </Flex>
      )}
      {isExpanded && (
        <Flex flexShrink={0} alignItems="center" gap={1}>
          <IconButton
            aria-label="Open original"
            title="Open original"
            size="sm"
            variant="ghost"
            onClick={(e) => { e.stopPropagation(); onOpenOriginal?.(); }}
          >
            <LuExternalLink />
          </IconButton>
          <IconButton
            aria-label="Previous article"
            title="Previous article"
            size="sm"
            variant="ghost"
            disabled={!onNavigatePrev}
            onClick={(e) => { e.stopPropagation(); onNavigatePrev?.(); }}
          >
            <LuChevronUp />
          </IconButton>
          <IconButton
            aria-label="Next article"
            title="Next article"
            size="sm"
            variant="ghost"
            disabled={!onNavigateNext}
            onClick={(e) => { e.stopPropagation(); onNavigateNext?.(); }}
          >
            <LuChevronDown />
          </IconButton>
          <IconButton
            aria-label="Close reader"
            title="Close reader"
            size="sm"
            variant="ghost"
            onClick={(e) => { e.stopPropagation(); onClose?.(); }}
          >
            <LuX />
          </IconButton>
        </Flex>
      )}
    </Flex>
  );
}));
