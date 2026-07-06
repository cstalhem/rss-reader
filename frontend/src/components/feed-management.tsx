"use client";

import { useState, type ReactNode } from "react";

import { useAddFeed } from "@/hooks/useAddFeed";
import { useCreateFolder } from "@/hooks/useCreateFolder";
import { useDeleteFeed } from "@/hooks/useDeleteFeed";
import { useDeleteFolder } from "@/hooks/useDeleteFolder";
import { useUpdateFeed } from "@/hooks/useUpdateFeed";
import { useUpdateFolder } from "@/hooks/useUpdateFolder";
import type { Feed, FeedFolder } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ResponsiveModal } from "@/components/responsive-modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

/**
 * The single hoisted modal state for sidebar feed/folder management. Rows
 * fire callbacks that set this at the sidebar level — no per-row modal
 * instances (see the performance rule in `.claude/rules/frontend.md`).
 */
export type ManageModal =
  | { kind: "add-feed" }
  | { kind: "new-folder" }
  | { kind: "edit-feed"; feed: Feed }
  | { kind: "delete-feed"; feed: Feed }
  | { kind: "rename-folder"; folder: FeedFolder }
  | { kind: "delete-folder"; folder: FeedFolder; feedCount: number };

const AGGREGATOR_HINT =
  "Entries link out to external articles — fetched through before scoring.";

/** Radix Select items can't have an empty-string value; sentinel for "no folder". */
const ROOT_SENTINEL = "root";

/** Mutation errors surface via the centralized MutationCache toast — no per-form error UI. */

function FormFooter({
  submitLabel,
  isPending,
  onCancel,
  destructive = false,
}: {
  submitLabel: string;
  isPending: boolean;
  onCancel: () => void;
  destructive?: boolean;
}) {
  return (
    <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
      <Button
        type="button"
        variant="outline"
        className="h-11 sm:h-9"
        onClick={onCancel}
      >
        Cancel
      </Button>
      <Button
        type="submit"
        variant={destructive ? "destructive" : "default"}
        className="h-11 sm:h-9"
        disabled={isPending}
      >
        {submitLabel}
      </Button>
    </div>
  );
}

function AggregatorField({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <Field orientation="horizontal">
      <FieldContent>
        <FieldLabel htmlFor="feed-aggregator">Aggregator feed</FieldLabel>
        <FieldDescription>{AGGREGATOR_HINT}</FieldDescription>
      </FieldContent>
      <Switch
        id="feed-aggregator"
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </Field>
  );
}

function AddFeedForm({ onClose }: { onClose: () => void }) {
  const addFeed = useAddFeed();
  const [url, setUrl] = useState("");
  const [isAggregator, setIsAggregator] = useState(false);

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        addFeed.mutate(
          { url: url.trim(), is_aggregator: isAggregator },
          { onSuccess: onClose },
        );
      }}
    >
      <Field>
        <FieldLabel htmlFor="add-feed-url">Feed URL</FieldLabel>
        <Input
          id="add-feed-url"
          type="url"
          required
          inputMode="url"
          placeholder="https://example.com/feed.xml"
          className="h-11 sm:h-9"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          autoFocus
        />
      </Field>
      <AggregatorField
        checked={isAggregator}
        onCheckedChange={setIsAggregator}
      />
      <FormFooter
        submitLabel="Add feed"
        isPending={addFeed.isPending}
        onCancel={onClose}
      />
    </form>
  );
}

function EditFeedForm({
  feed,
  folders,
  onClose,
}: {
  feed: Feed;
  folders: FeedFolder[];
  onClose: () => void;
}) {
  const updateFeed = useUpdateFeed();
  const [title, setTitle] = useState(feed.title);
  const [isAggregator, setIsAggregator] = useState(feed.is_aggregator);
  const [folderValue, setFolderValue] = useState(
    feed.folder_id === null ? ROOT_SENTINEL : String(feed.folder_id),
  );

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        updateFeed.mutate(
          {
            id: feed.id,
            data: {
              title: title.trim(),
              folder_id:
                folderValue === ROOT_SENTINEL ? null : Number(folderValue),
              is_aggregator: isAggregator,
            },
          },
          { onSuccess: onClose },
        );
      }}
    >
      <Field>
        <FieldLabel htmlFor="edit-feed-title">Title</FieldLabel>
        <Input
          id="edit-feed-title"
          required
          className="h-11 sm:h-9"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="edit-feed-folder">Folder</FieldLabel>
        <Select value={folderValue} onValueChange={setFolderValue}>
          <SelectTrigger id="edit-feed-folder" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ROOT_SENTINEL}>No folder</SelectItem>
            {folders.map((folder) => (
              <SelectItem key={folder.id} value={String(folder.id)}>
                {folder.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <AggregatorField
        checked={isAggregator}
        onCheckedChange={setIsAggregator}
      />
      <FormFooter
        submitLabel="Save"
        isPending={updateFeed.isPending}
        onCancel={onClose}
      />
    </form>
  );
}

function DeleteFeedConfirm({
  feed,
  onClose,
}: {
  feed: Feed;
  onClose: () => void;
}) {
  const deleteFeed = useDeleteFeed();

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        deleteFeed.mutate(feed.id, { onSuccess: onClose });
      }}
    >
      <p className="text-sm">
        Delete <span className="font-medium">{feed.title}</span> and its
        articles? This can&apos;t be undone.
      </p>
      <FormFooter
        submitLabel="Delete feed"
        isPending={deleteFeed.isPending}
        onCancel={onClose}
        destructive
      />
    </form>
  );
}

/** Shared by "new folder" and "rename folder" — same single-field form. */
function FolderNameForm({
  initialName = "",
  submitLabel,
  isPending,
  onSubmit,
  onCancel,
}: {
  initialName?: string;
  submitLabel: string;
  isPending: boolean;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(name.trim());
      }}
    >
      <Field>
        <FieldLabel htmlFor="folder-name">Folder name</FieldLabel>
        <Input
          id="folder-name"
          required
          className="h-11 sm:h-9"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </Field>
      <FormFooter
        submitLabel={submitLabel}
        isPending={isPending}
        onCancel={onCancel}
      />
    </form>
  );
}

function NewFolderForm({ onClose }: { onClose: () => void }) {
  const createFolder = useCreateFolder();
  return (
    <FolderNameForm
      submitLabel="Create folder"
      isPending={createFolder.isPending}
      onSubmit={(name) => createFolder.mutate({ name }, { onSuccess: onClose })}
      onCancel={onClose}
    />
  );
}

function RenameFolderForm({
  folder,
  onClose,
}: {
  folder: FeedFolder;
  onClose: () => void;
}) {
  const updateFolder = useUpdateFolder();
  return (
    <FolderNameForm
      initialName={folder.name}
      submitLabel="Rename"
      isPending={updateFolder.isPending}
      onSubmit={(name) =>
        updateFolder.mutate(
          { id: folder.id, data: { name } },
          { onSuccess: onClose },
        )
      }
      onCancel={onClose}
    />
  );
}

function DeleteFolderConfirm({
  folder,
  feedCount,
  onClose,
}: {
  folder: FeedFolder;
  feedCount: number;
  onClose: () => void;
}) {
  const deleteFolder = useDeleteFolder();
  const confirm = (deleteFeeds: boolean) =>
    deleteFolder.mutate({ id: folder.id, deleteFeeds }, { onSuccess: onClose });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        Delete <span className="font-medium">{folder.name}</span>?
        {feedCount > 0 && (
          <>
            {" "}
            It contains {feedCount} {feedCount === 1 ? "feed" : "feeds"}.
          </>
        )}
      </p>
      <div className="flex flex-col gap-2">
        {feedCount > 0 ? (
          <>
            <Button
              type="button"
              className="h-11 justify-start sm:h-9"
              disabled={deleteFolder.isPending}
              onClick={() => confirm(false)}
            >
              Ungroup feeds to root
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-11 justify-start sm:h-9"
              disabled={deleteFolder.isPending}
              onClick={() => confirm(true)}
            >
              Also delete {feedCount} {feedCount === 1 ? "feed" : "feeds"}
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="destructive"
            className="h-11 sm:h-9"
            disabled={deleteFolder.isPending}
            onClick={() => confirm(false)}
          >
            Delete folder
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          className="h-11 sm:h-9"
          onClick={onClose}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

/**
 * Renders the currently-open management modal (or nothing). Mounts fresh per
 * open, so each form's `useState` initializers capture the target feed/folder
 * at open time — no sync effects needed.
 */
export function FeedManagementModal({
  modal,
  folders,
  onClose,
}: {
  modal: ManageModal | null;
  folders: FeedFolder[];
  onClose: () => void;
}) {
  if (!modal) return null;

  let title: string;
  let body: ReactNode;
  switch (modal.kind) {
    case "add-feed":
      title = "Add feed";
      body = <AddFeedForm onClose={onClose} />;
      break;
    case "new-folder":
      title = "New folder";
      body = <NewFolderForm onClose={onClose} />;
      break;
    case "edit-feed":
      title = "Edit feed";
      body = (
        <EditFeedForm feed={modal.feed} folders={folders} onClose={onClose} />
      );
      break;
    case "delete-feed":
      title = "Delete feed";
      body = <DeleteFeedConfirm feed={modal.feed} onClose={onClose} />;
      break;
    case "rename-folder":
      title = "Rename folder";
      body = <RenameFolderForm folder={modal.folder} onClose={onClose} />;
      break;
    case "delete-folder":
      title = "Delete folder";
      body = (
        <DeleteFolderConfirm
          folder={modal.folder}
          feedCount={modal.feedCount}
          onClose={onClose}
        />
      );
      break;
  }

  return (
    <ResponsiveModal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={title}
    >
      {body}
    </ResponsiveModal>
  );
}
