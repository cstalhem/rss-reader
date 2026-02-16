"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Flex,
  Text,
  Badge,
  IconButton,
  Skeleton,
  Stack,
} from "@chakra-ui/react";
import { LuRss, LuGripVertical, LuTrash2, LuPlus } from "react-icons/lu";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { useFeeds } from "@/hooks/useFeeds";
import {
  useReorderFeeds,
  useDeleteFeed,
} from "@/hooks/useFeedMutations";
import { AddFeedDialog } from "@/components/feed/AddFeedDialog";
import { DeleteFeedDialog } from "@/components/feed/DeleteFeedDialog";
import { toaster } from "@/components/ui/toaster";
import { Feed } from "@/lib/types";

interface SortableFeedRowProps {
  feed: Feed;
  index: number;
  onDelete: (feed: Feed) => void;
}

function SortableFeedRow({ feed, index, onDelete }: SortableFeedRowProps) {
  return (
    <Draggable draggableId={String(feed.id)} index={index}>
      {(provided, snapshot) => (
        <Flex
          ref={provided.innerRef}
          {...provided.draggableProps}
          alignItems="center"
          gap={3}
          p={3}
          bg="bg.subtle"
          borderRadius="md"
          borderWidth="1px"
          borderColor="border.subtle"
          style={{
            ...provided.draggableProps.style,
            opacity: snapshot.isDragging ? 0.5 : 1,
          }}
        >
          {/* Drag handle */}
          <Box
            {...provided.dragHandleProps}
            cursor="grab"
            _active={{ cursor: "grabbing" }}
            color="fg.muted"
            display="flex"
            alignItems="center"
          >
            <LuGripVertical size={18} />
          </Box>

          {/* Feed content */}
          <Flex flex={1} direction="column" gap={1}>
            <Text fontWeight="medium" fontSize="sm">
              {feed.title}
            </Text>
            <Text fontSize="sm" color="fg.muted" truncate>
              {feed.url}
            </Text>
          </Flex>

          {/* Unread count badge */}
          {feed.unread_count > 0 && (
            <Badge colorPalette="accent" size="sm">
              {feed.unread_count}
            </Badge>
          )}

          {/* Delete button */}
          <IconButton
            aria-label="Remove feed"
            size="sm"
            variant="ghost"
            colorPalette="red"
            onClick={() => onDelete(feed)}
          >
            <LuTrash2 size={16} />
          </IconButton>
        </Flex>
      )}
    </Draggable>
  );
}

export function FeedsSection() {
  const { data: feeds, isLoading } = useFeeds();
  const reorderFeeds = useReorderFeeds();
  const deleteFeed = useDeleteFeed();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [feedToDelete, setFeedToDelete] = useState<Feed | null>(null);

  const handleDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (!destination || !feeds) return;
    if (source.index === destination.index) return;

    const reorderedFeeds = Array.from(feeds);
    const [moved] = reorderedFeeds.splice(source.index, 1);
    reorderedFeeds.splice(destination.index, 0, moved);
    reorderFeeds.mutate(reorderedFeeds.map((f) => f.id));
  };

  const handleDelete = (feed: Feed) => {
    setFeedToDelete(feed);
  };

  const handleDeleteConfirm = (feedId: number) => {
    deleteFeed.mutate(feedId, {
      onSuccess: () => {
        toaster.create({
          title: "Feed removed",
          type: "success",
        });
      },
    });
    setFeedToDelete(null);
  };

  return (
    <Box>
      <Flex alignItems="center" justifyContent="space-between" mb={6}>
        <Text fontSize="lg" fontWeight="semibold">
          Feeds
        </Text>
        <Button
          colorPalette="accent"
          size="sm"
          onClick={() => setShowAddDialog(true)}
        >
          <LuPlus size={16} />
          Add Feed
        </Button>
      </Flex>

      {isLoading ? (
        <Stack gap={3}>
          <Skeleton height="80px" variant="shine" />
          <Skeleton height="80px" variant="shine" />
          <Skeleton height="80px" variant="shine" />
        </Stack>
      ) : feeds && feeds.length > 0 ? (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="settings-feeds">
            {(provided) => (
              <Stack gap={3} ref={provided.innerRef} {...provided.droppableProps}>
                {feeds.map((feed, index) => (
                  <SortableFeedRow
                    key={feed.id}
                    feed={feed}
                    index={index}
                    onDelete={handleDelete}
                  />
                ))}
                {provided.placeholder}
              </Stack>
            )}
          </Droppable>
        </DragDropContext>
      ) : (
        <Flex
          direction="column"
          alignItems="center"
          justifyContent="center"
          gap={4}
          py={16}
          px={8}
          bg="bg.subtle"
          borderRadius="md"
          borderWidth="1px"
          borderColor="border.subtle"
        >
          <LuRss size={40} color="var(--chakra-colors-fg-subtle)" />
          <Text fontSize="lg" color="fg.muted" textAlign="center">
            No feeds added yet
          </Text>
          <Text fontSize="sm" color="fg.muted" textAlign="center">
            Add your first RSS feed to get started
          </Text>
          <Button
            colorPalette="accent"
            variant="outline"
            onClick={() => setShowAddDialog(true)}
          >
            <LuPlus size={16} />
            Add Feed
          </Button>
        </Flex>
      )}

      {/* Add Feed Dialog */}
      <AddFeedDialog
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
      />

      {/* Delete confirmation dialog */}
      <DeleteFeedDialog
        feed={feedToDelete}
        onClose={() => setFeedToDelete(null)}
        onConfirm={handleDeleteConfirm}
      />
    </Box>
  );
}
