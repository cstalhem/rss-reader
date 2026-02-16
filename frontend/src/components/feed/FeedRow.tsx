"use client";

import { useState, useRef, useEffect } from "react";
import { Box, Flex, Text, Badge, IconButton } from "@chakra-ui/react";
import { LuGripVertical, LuTrash2, LuCheckCheck } from "react-icons/lu";
import { Draggable } from "@hello-pangea/dnd";
import { useSwipeable } from "react-swipeable";
import { Feed } from "@/lib/types";

interface FeedRowProps {
  feed: Feed;
  isSelected: boolean;
  onSelect: (id: number) => void;
  onDelete: (feed: Feed) => void;
  onMarkAllRead: (feedId: number) => void;
  onRename: (id: number, title: string) => void;
  isDraggable?: boolean;
  index?: number;
}

export function FeedRow({
  feed,
  isSelected,
  onSelect,
  onDelete,
  onMarkAllRead,
  onRename,
  isDraggable = true,
  index = 0,
}: FeedRowProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(feed.title);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => setIsRevealed(true),
    onSwipedRight: () => setIsRevealed(false),
    trackMouse: false,
  });

  // Auto-focus input when entering rename mode
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleDoubleClick = () => {
    if (!isDraggable) return; // Only on desktop
    setIsRenaming(true);
  };

  const handleRenameSubmit = () => {
    if (renameValue.trim() && renameValue !== feed.title) {
      onRename(feed.id, renameValue.trim());
    }
    setIsRenaming(false);
  };

  const handleRenameCancel = () => {
    setRenameValue(feed.title);
    setIsRenaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRenameSubmit();
    } else if (e.key === "Escape") {
      handleRenameCancel();
    }
  };

  // Mobile long-press for rename
  const handleTouchStart = () => {
    const timer = setTimeout(() => {
      setIsRenaming(true);
    }, 500);
    setLongPressTimer(timer);
  };

  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleTouchMove = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  // Merge refs for hello-pangea/dnd and swipeable
  const mergedRef = (el: HTMLDivElement | null, dndRef: (el: HTMLElement | null) => void) => {
    dndRef(el);
    if (swipeHandlers.ref) {
      (swipeHandlers.ref as any)(el);
    }
  };

  const content = (provided?: any, snapshot?: any) => {
    const isDragging = snapshot?.isDragging ?? false;

    return (
      <Box
        ref={provided ? (el: HTMLDivElement | null) => mergedRef(el, provided.innerRef) : undefined}
        {...(provided?.draggableProps ?? {})}
        position="relative"
        overflow="hidden"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onMouseDown={swipeHandlers.onMouseDown}
        style={{
          ...(provided?.draggableProps?.style ?? {}),
          opacity: isDragging ? 0.5 : 1,
        }}
      >
        <Flex
          alignItems="center"
          px={isDraggable ? 2 : 4}
          py={3}
          cursor="pointer"
          bg={isSelected ? "colorPalette.subtle" : "transparent"}
          _hover={{ bg: isSelected ? "colorPalette.subtle" : "bg.muted" }}
          onClick={() => !isRenaming && onSelect(feed.id)}
          borderLeftWidth="3px"
          borderLeftColor={isSelected ? "colorPalette.solid" : "transparent"}
          transform={isRevealed ? "translateX(-80px)" : "translateX(0)"}
          transition="transform 0.2s ease"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
        >
          {/* Drag handle (desktop only) */}
          {isDraggable && (
            <Box
              {...(provided?.dragHandleProps ?? {})}
              cursor="grab"
              _active={{ cursor: "grabbing" }}
              color="fg.muted"
              mr={2}
              display="flex"
              alignItems="center"
            >
              <LuGripVertical size={16} />
            </Box>
          )}

        {/* Feed title or rename input */}
        {isRenaming ? (
          <input
            ref={inputRef}
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              fontSize: "0.875rem",
              fontWeight: 500,
              background: "transparent",
              border: "1px solid var(--chakra-colors-border-subtle)",
              borderRadius: "4px",
              padding: "4px 8px",
              marginRight: "8px",
              color: "inherit",
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <Text
            fontSize="sm"
            fontWeight="medium"
            flex={1}
            truncate
            mr={2}
            onDoubleClick={handleDoubleClick}
          >
            {feed.title}
          </Text>
        )}

        {/* Unread count badge */}
        <Box position="relative">
          {feed.unread_count > 0 && (
            <Badge
              colorPalette="accent"
              size="sm"
              opacity={isHovered && isDraggable ? 0 : 1}
              transition="opacity 0.2s ease"
            >
              {feed.unread_count}
            </Badge>
          )}

          {/* Desktop hover actions */}
          {isDraggable && isHovered && (
            <Flex
              position="absolute"
              right={0}
              top="50%"
              transform="translateY(-50%)"
              gap={1}
              bg="bg.subtle"
              borderRadius="md"
              px={1}
              py={0.5}
            >
              <IconButton
                aria-label="Mark all as read"
                size="xs"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkAllRead(feed.id);
                }}
              >
                <LuCheckCheck size={14} />
              </IconButton>
              <IconButton
                aria-label="Remove feed"
                size="xs"
                variant="ghost"
                colorPalette="red"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(feed);
                }}
              >
                <LuTrash2 size={14} />
              </IconButton>
            </Flex>
          )}
        </Box>
      </Flex>

      {/* Mobile swipe actions */}
      {!isDraggable && (
        <Flex
          position="absolute"
          right={0}
          top={0}
          bottom={0}
          width="80px"
          bg="bg.subtle"
          alignItems="center"
          justifyContent="flex-end"
          gap={1}
          pr={2}
        >
          <IconButton
            aria-label="Mark all as read"
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onMarkAllRead(feed.id);
              setIsRevealed(false);
            }}
          >
            <LuCheckCheck size={16} />
          </IconButton>
          <IconButton
            aria-label="Remove feed"
            size="sm"
            variant="ghost"
            colorPalette="red"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(feed);
              setIsRevealed(false);
            }}
          >
            <LuTrash2 size={16} />
          </IconButton>
        </Flex>
      )}
    </Box>
    );
  };

  if (!isDraggable) {
    return content();
  }

  return (
    <Draggable draggableId={String(feed.id)} index={index}>
      {(provided, snapshot) => content(provided, snapshot)}
    </Draggable>
  );
}
