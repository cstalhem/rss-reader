"use client";

import { useState } from "react";
import {
  Box,
  Button,
  EmptyState,
  Flex,
  Text,
  Badge,
  IconButton,
  Skeleton,
  Stack,
  VStack,
} from "@chakra-ui/react";
import { LuRss, LuGripVertical, LuTrash2, LuPlus } from "react-icons/lu";
import { SettingsPageHeader } from "./SettingsPageHeader";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
  onDelete: (feed: Feed) => void;
}

function SortableFeedRow({ feed, onDelete }: SortableFeedRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: feed.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Flex
      ref={setNodeRef}
      style={style}
      alignItems="center"
      gap={3}
      p={3}
      bg="bg.subtle"
      borderRadius="md"
      borderWidth="1px"
      borderColor="border.subtle"
    >
      {/* Drag handle */}
      <Box
        {...attributes}
        {...listeners}
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
  );
}

export function FeedsSection() {
  const { data: feeds, isLoading } = useFeeds();
  const reorderFeeds = useReorderFeeds();
  const deleteFeed = useDeleteFeed();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [feedToDelete, setFeedToDelete] = useState<Feed | null>(null);

  // Configure drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Prevent accidental drags on click
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || !feeds || active.id === over.id) return;

    const oldIndex = feeds.findIndex((f) => f.id === active.id);
    const newIndex = feeds.findIndex((f) => f.id === over.id);

    const reorderedFeeds = arrayMove(feeds, oldIndex, newIndex);
    const feedIds = reorderedFeeds.map((f) => f.id);

    reorderFeeds.mutate(feedIds);
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
    <Stack as="section" aria-label="Feeds" gap={6}>
      <SettingsPageHeader title="Feeds">
        <Button
          colorPalette="accent"
          size="sm"
          onClick={() => setShowAddDialog(true)}
        >
          <LuPlus size={16} />
          Add Feed
        </Button>
      </SettingsPageHeader>

      {isLoading ? (
        <Stack gap={3}>
          <Skeleton height="80px" variant="shine" />
          <Skeleton height="80px" variant="shine" />
          <Skeleton height="80px" variant="shine" />
        </Stack>
      ) : feeds && feeds.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={feeds.map((f) => f.id)}
            strategy={verticalListSortingStrategy}
          >
            <Stack gap={3}>
              {feeds.map((feed) => (
                <SortableFeedRow
                  key={feed.id}
                  feed={feed}
                  onDelete={handleDelete}
                />
              ))}
            </Stack>
          </SortableContext>
        </DndContext>
      ) : (
        <EmptyState.Root>
          <EmptyState.Content>
            <EmptyState.Indicator>
              <LuRss size={40} />
            </EmptyState.Indicator>
            <VStack textAlign="center">
              <EmptyState.Title>No feeds added yet</EmptyState.Title>
              <EmptyState.Description>
                Add your first RSS feed to get started
              </EmptyState.Description>
            </VStack>
            <Button
              colorPalette="accent"
              variant="outline"
              onClick={() => setShowAddDialog(true)}
            >
              <LuPlus size={16} />
              Add Feed
            </Button>
          </EmptyState.Content>
        </EmptyState.Root>
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
    </Stack>
  );
}
