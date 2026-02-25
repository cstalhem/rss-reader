"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  EmptyState,
  Flex,
  IconButton,
  Input,
  Skeleton,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import {
  LuFolder,
  LuFolderInput,
  LuFolderPlus,
  LuGripVertical,
  LuPencil,
  LuPlus,
  LuRss,
  LuTrash2,
} from "react-icons/lu";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SettingsPageHeader } from "./SettingsPageHeader";
import { SettingsPanel } from "./SettingsPanel";
import { SettingsPanelHeading } from "./SettingsPanelHeading";
import { useFeeds } from "@/hooks/useFeeds";
import {
  useDeleteFeed,
  useReorderFeeds,
  useUpdateFeed,
} from "@/hooks/useFeedMutations";
import {
  useCreateFeedFolder,
  useDeleteFeedFolder,
  useFeedFolders,
  useReorderFeedFolders,
} from "@/hooks/useFeedFolders";
import { AddFeedDialog } from "@/components/feed/AddFeedDialog";
import { CreateFolderDialog } from "@/components/feed/CreateFolderDialog";
import { DeleteFeedDialog } from "@/components/feed/DeleteFeedDialog";
import { EditFeedDialog } from "@/components/feed/EditFeedDialog";
import { EditFolderDialog } from "@/components/feed/EditFolderDialog";
import { MoveToFolderDialog } from "@/components/feed/MoveToFolderDialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toaster } from "@/components/ui/toaster";
import { Feed, FeedFolder } from "@/lib/types";

interface SortableFeedRowProps {
  dragId: string;
  feed: Feed;
  onDelete: (feed: Feed) => void;
  onMove: (feed: Feed) => void;
  onRename: (feed: Feed) => void;
  showRenameAction?: boolean;
}

function SortableFeedRow({
  dragId,
  feed,
  onDelete,
  onMove,
  onRename,
  showRenameAction = false,
}: SortableFeedRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: dragId });

  return (
    <Flex
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      alignItems="center"
      gap={3}
      p={3}
      bg="bg.subtle"
      borderRadius="md"
      borderWidth="1px"
      borderColor="border.subtle"
    >
      <Box
        {...attributes}
        {...listeners}
        cursor="grab"
        _active={{ cursor: "grabbing" }}
        color="fg.muted"
        display="flex"
        alignItems="center"
        title="Drag to reorder feed"
      >
        <LuGripVertical size={18} />
      </Box>

      <Flex flex={1} direction="column" gap={1} minW={0}>
        <Text fontWeight="medium" fontSize="sm" truncate>
          {feed.title}
        </Text>
        <Text fontSize="sm" color="fg.muted" truncate>
          {feed.url}
        </Text>
      </Flex>

      {feed.unread_count > 0 && (
        <Badge colorPalette="accent" size="sm">
          {feed.unread_count}
        </Badge>
      )}

      <IconButton
        aria-label="Move feed to folder"
        title="Move feed to folder"
        size="sm"
        variant="ghost"
        onClick={() => onMove(feed)}
      >
        <LuFolderInput size={16} />
      </IconButton>
      {showRenameAction && (
        <IconButton
          aria-label="Rename feed"
          title="Rename feed"
          size="sm"
          variant="ghost"
          onClick={() => onRename(feed)}
        >
          <LuPencil size={16} />
        </IconButton>
      )}
      <IconButton
        aria-label="Remove feed"
        title="Remove feed"
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

interface SortableFolderHeaderProps {
  dragId: string;
  folder: FeedFolder;
  onRename: (folder: FeedFolder) => void;
  onDelete: (folder: FeedFolder) => void;
}

function SortableFolderHeader({
  dragId,
  folder,
  onRename,
  onDelete,
}: SortableFolderHeaderProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: dragId });

  return (
    <Flex
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      alignItems="center"
      gap={2}
      p={3}
      bg="bg.subtle"
      borderRadius="md"
      borderWidth="1px"
      borderColor="border.subtle"
    >
      <Box
        {...attributes}
        {...listeners}
        cursor="grab"
        _active={{ cursor: "grabbing" }}
        color="fg.muted"
        display="flex"
        alignItems="center"
        title="Drag to reorder folder"
      >
        <LuGripVertical size={18} />
      </Box>
      <LuFolder size={16} />
      <Text fontSize="sm" fontWeight="semibold" flex={1} truncate>
        {folder.name}
      </Text>
      {folder.unread_count > 0 && (
        <Badge colorPalette="accent" size="sm">
          {folder.unread_count}
        </Badge>
      )}
      <IconButton
        aria-label="Rename folder"
        title="Rename folder"
        size="sm"
        variant="ghost"
        onClick={() => onRename(folder)}
      >
        <LuPencil size={16} />
      </IconButton>
      <IconButton
        aria-label="Delete folder"
        title="Delete folder"
        size="sm"
        variant="ghost"
        colorPalette="red"
        onClick={() => onDelete(folder)}
      >
        <LuTrash2 size={16} />
      </IconButton>
    </Flex>
  );
}

export function FeedsSection() {
  const { data: feeds, isLoading: isFeedsLoading } = useFeeds();
  const { data: folders, isLoading: isFoldersLoading } = useFeedFolders();
  const reorderFeeds = useReorderFeeds();
  const reorderFolders = useReorderFeedFolders();
  const updateFeed = useUpdateFeed();
  const createFolder = useCreateFeedFolder();
  const deleteFeed = useDeleteFeed();
  const deleteFolder = useDeleteFeedFolder();

  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showCreateFolderDialog, setShowCreateFolderDialog] = useState(false);
  const [feedToDelete, setFeedToDelete] = useState<Feed | null>(null);
  const [feedToRename, setFeedToRename] = useState<Feed | null>(null);
  const [feedToMove, setFeedToMove] = useState<Feed | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<FeedFolder | null>(null);
  const [folderToRename, setFolderToRename] = useState<FeedFolder | null>(null);
  const [deleteFolderFeedsToo, setDeleteFolderFeedsToo] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const orderedFolders = useMemo(
    () =>
      [...(folders ?? [])].sort(
        (a, b) => a.display_order - b.display_order || a.id - b.id
      ),
    [folders]
  );

  const groupedFeeds = useMemo(() => {
    const byFolder = new Map<number, Feed[]>();
    const rootFeeds: Feed[] = [];

    for (const feed of feeds ?? []) {
      if (feed.folder_id === null) {
        rootFeeds.push(feed);
        continue;
      }

      const bucket = byFolder.get(feed.folder_id) ?? [];
      bucket.push(feed);
      byFolder.set(feed.folder_id, bucket);
    }

    rootFeeds.sort((a, b) => a.display_order - b.display_order || a.id - b.id);

    for (const bucket of byFolder.values()) {
      bucket.sort((a, b) => a.display_order - b.display_order || a.id - b.id);
    }

    return { byFolder, rootFeeds };
  }, [feeds]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const feedMatchesSearch = useCallback(
    (feed: Feed) => {
      if (!normalizedQuery) return true;
      return (
        feed.title.toLowerCase().includes(normalizedQuery) ||
        feed.url.toLowerCase().includes(normalizedQuery)
      );
    },
    [normalizedQuery]
  );

  const filteredRootFeeds = useMemo(
    () => groupedFeeds.rootFeeds.filter((feed) => feedMatchesSearch(feed)),
    [groupedFeeds.rootFeeds, feedMatchesSearch]
  );

  const filteredFolderBlocks = useMemo(
    () =>
      orderedFolders
        .map((folder) => {
          const folderFeeds = groupedFeeds.byFolder.get(folder.id) ?? [];
          const folderMatches = folder.name
            .toLowerCase()
            .includes(normalizedQuery);

          const visibleFeeds = normalizedQuery
            ? folderMatches
              ? folderFeeds
              : folderFeeds.filter((feed) => feedMatchesSearch(feed))
            : folderFeeds;

          if (!folderMatches && visibleFeeds.length === 0) return null;
          return { folder, feeds: visibleFeeds };
        })
        .filter((entry): entry is { folder: FeedFolder; feeds: Feed[] } => entry !== null),
    [orderedFolders, groupedFeeds.byFolder, feedMatchesSearch, normalizedQuery]
  );

  const isLoading = isFeedsLoading || isFoldersLoading;
  const hasAnyItems = (feeds?.length ?? 0) + (folders?.length ?? 0) > 0;

  const handleRootDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = filteredRootFeeds.findIndex(
      (feed) => `root-feed-${feed.id}` === active.id
    );
    const newIndex = filteredRootFeeds.findIndex(
      (feed) => `root-feed-${feed.id}` === over.id
    );
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(filteredRootFeeds, oldIndex, newIndex);
    reorderFeeds.mutate({
      feedIds: reordered.map((feed) => feed.id),
      folderId: null,
    });
  };

  const handleFolderDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = filteredFolderBlocks.findIndex(
      (entry) => `folder-${entry.folder.id}` === active.id
    );
    const newIndex = filteredFolderBlocks.findIndex(
      (entry) => `folder-${entry.folder.id}` === over.id
    );
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(filteredFolderBlocks, oldIndex, newIndex);
    reorderFolders.mutate(reordered.map((entry) => entry.folder.id));
  };

  const handleFolderFeedDragEnd = (folderId: number, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const folderFeeds = groupedFeeds.byFolder.get(folderId) ?? [];

    const oldIndex = folderFeeds.findIndex(
      (feed) => `folder-${folderId}-feed-${feed.id}` === active.id
    );
    const newIndex = folderFeeds.findIndex(
      (feed) => `folder-${folderId}-feed-${feed.id}` === over.id
    );
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(folderFeeds, oldIndex, newIndex);
    reorderFeeds.mutate({
      feedIds: reordered.map((feed) => feed.id),
      folderId,
    });
  };

  const handleRenameFolder = (folder: FeedFolder) => {
    setFolderToRename(folder);
  };

  const handleRenameFeed = (feed: Feed) => {
    setFeedToRename(feed);
  };

  const handleDeleteFeedConfirm = (feedId: number) => {
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

  const handleMoveFeed = (folderId: number | null) => {
    if (!feedToMove) return;

    updateFeed.mutate({
      id: feedToMove.id,
      data: { folder_id: folderId },
    });
    setFeedToMove(null);
  };

  const handleCreateFolderAndMove = async (folderName: string) => {
    if (!feedToMove) return;

    try {
      await createFolder.mutateAsync({
        name: folderName,
        feedIds: [feedToMove.id],
      });
      setFeedToMove(null);
    } catch {
      // Global mutation error handling shows feedback.
    }
  };

  const handleConfirmDeleteFolder = () => {
    if (!folderToDelete) return;

    deleteFolder.mutate(
      {
        id: folderToDelete.id,
        deleteFeeds: deleteFolderFeedsToo,
      },
      {
        onSuccess: () => {
          toaster.create({
            title: deleteFolderFeedsToo
              ? "Folder and feeds deleted"
              : "Folder deleted and feeds ungrouped",
            type: "success",
          });
        },
      }
    );

    setFolderToDelete(null);
    setDeleteFolderFeedsToo(false);
  };

  const hasVisibleRows =
    filteredFolderBlocks.length > 0 || filteredRootFeeds.length > 0;

  return (
    <Stack as="section" aria-label="Feeds" gap={6}>
      <SettingsPageHeader title="Feeds">
        <Flex gap={2}>
          <Button
            colorPalette="accent"
            size="sm"
            variant="outline"
            onClick={() => setShowCreateFolderDialog(true)}
          >
            <LuFolderPlus size={16} />
            Create Folder
          </Button>
          <Button
            colorPalette="accent"
            size="sm"
            onClick={() => setShowAddDialog(true)}
          >
            <LuPlus size={16} />
            Add Feed
          </Button>
        </Flex>
      </SettingsPageHeader>

      {isLoading ? (
        <Stack gap={3}>
          <Skeleton height="80px" variant="shine" />
          <Skeleton height="80px" variant="shine" />
          <Skeleton height="80px" variant="shine" />
        </Stack>
      ) : hasAnyItems ? (
        <SettingsPanel>
          <Stack gap={4}>
            <SettingsPanelHeading>Folders and feeds</SettingsPanelHeading>

            <Input
              placeholder="Filter folders and feeds..."
              size="sm"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />

            {hasVisibleRows ? (
              <Stack gap={3}>
                {filteredFolderBlocks.length > 0 && (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleFolderDragEnd}
                  >
                    <SortableContext
                      items={filteredFolderBlocks.map(
                        ({ folder }) => `folder-${folder.id}`
                      )}
                      strategy={verticalListSortingStrategy}
                    >
                      <Stack gap={3}>
                        {filteredFolderBlocks.map(
                          ({ folder, feeds: visibleFeeds }) => (
                            <Stack key={`folder-block-${folder.id}`} gap={2}>
                              <SortableFolderHeader
                                dragId={`folder-${folder.id}`}
                                folder={folder}
                                onRename={handleRenameFolder}
                                onDelete={(nextFolder) => {
                                  setFolderToDelete(nextFolder);
                                  setDeleteFolderFeedsToo(false);
                                }}
                              />

                              <Box pl={4}>
                                {visibleFeeds.length > 0 ? (
                                  <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCenter}
                                    onDragEnd={(event) =>
                                      handleFolderFeedDragEnd(folder.id, event)
                                    }
                                  >
                                    <SortableContext
                                      items={visibleFeeds.map(
                                        (feed) =>
                                          `folder-${folder.id}-feed-${feed.id}`
                                      )}
                                      strategy={verticalListSortingStrategy}
                                    >
                                      <Stack gap={2}>
                                        {visibleFeeds.map((feed) => (
                                          <SortableFeedRow
                                            key={`folder-${folder.id}-feed-${feed.id}`}
                                            dragId={`folder-${folder.id}-feed-${feed.id}`}
                                            feed={feed}
                                            onDelete={setFeedToDelete}
                                            onMove={setFeedToMove}
                                            onRename={handleRenameFeed}
                                            showRenameAction={true}
                                          />
                                        ))}
                                      </Stack>
                                    </SortableContext>
                                  </DndContext>
                                ) : (
                                  <Text fontSize="sm" color="fg.muted" py={2}>
                                    No feeds in this folder
                                  </Text>
                                )}
                              </Box>
                            </Stack>
                          )
                        )}
                      </Stack>
                    </SortableContext>
                  </DndContext>
                )}

                {filteredRootFeeds.length > 0 && (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleRootDragEnd}
                  >
                    <SortableContext
                      items={filteredRootFeeds.map((feed) => `root-feed-${feed.id}`)}
                      strategy={verticalListSortingStrategy}
                    >
                      <Stack gap={2}>
                        {filteredRootFeeds.map((feed) => (
                          <SortableFeedRow
                            key={`root-feed-${feed.id}`}
                            dragId={`root-feed-${feed.id}`}
                            feed={feed}
                            onDelete={setFeedToDelete}
                            onMove={setFeedToMove}
                            onRename={handleRenameFeed}
                          />
                        ))}
                      </Stack>
                    </SortableContext>
                  </DndContext>
                )}
              </Stack>
            ) : (
              <Text fontSize="sm" color="fg.muted">
                No folders or feeds match your filter
              </Text>
            )}
          </Stack>
        </SettingsPanel>
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

      <AddFeedDialog isOpen={showAddDialog} onClose={() => setShowAddDialog(false)} />
      <CreateFolderDialog
        isOpen={showCreateFolderDialog}
        onClose={() => setShowCreateFolderDialog(false)}
      />
      <MoveToFolderDialog
        open={!!feedToMove}
        onOpenChange={(open) => {
          if (!open) setFeedToMove(null);
        }}
        folders={orderedFolders}
        onMove={handleMoveFeed}
        onCreateAndMove={handleCreateFolderAndMove}
      />

      <DeleteFeedDialog
        feed={feedToDelete}
        onClose={() => setFeedToDelete(null)}
        onConfirm={handleDeleteFeedConfirm}
      />
      {feedToRename && (
        <EditFeedDialog
          key={feedToRename.id}
          feed={feedToRename}
          onClose={() => setFeedToRename(null)}
        />
      )}
      {folderToRename && (
        <EditFolderDialog
          key={folderToRename.id}
          folder={folderToRename}
          onClose={() => setFolderToRename(null)}
        />
      )}

      <ConfirmDialog
        open={!!folderToDelete}
        onOpenChange={({ open }) => {
          if (!open) {
            setFolderToDelete(null);
            setDeleteFolderFeedsToo(false);
          }
        }}
        title="Delete folder"
        body={
          <Stack gap={3}>
            <Text>
              Delete <strong>{folderToDelete?.name}</strong>.
            </Text>
            <Stack gap={2}>
              <Button
                variant={deleteFolderFeedsToo ? "outline" : "solid"}
                colorPalette="accent"
                justifyContent="flex-start"
                onClick={() => setDeleteFolderFeedsToo(false)}
              >
                Delete folder and ungroup feeds
              </Button>
              <Button
                variant={deleteFolderFeedsToo ? "solid" : "outline"}
                colorPalette="red"
                justifyContent="flex-start"
                onClick={() => setDeleteFolderFeedsToo(true)}
              >
                Delete folder and delete all folder feeds
              </Button>
            </Stack>
          </Stack>
        }
        confirmLabel="Delete folder"
        confirmColorPalette="red"
        onConfirm={handleConfirmDeleteFolder}
      />
    </Stack>
  );
}
