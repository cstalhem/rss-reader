"use client";

import { useState } from "react";
import { ArrowRight, Merge } from "lucide-react";
import { toast } from "sonner";

import { ResponsiveModal } from "@/components/responsive-modal";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useMergeCategories } from "@/hooks/useMergeCategories";
import { useUpdateCategory } from "@/hooks/useUpdateCategory";
import { ApiError } from "@/lib/api";
import type { Category } from "@/lib/types";

/**
 * Rename modal. Submits `{ display_name }` via `useUpdateCategory`. That hook
 * handles its own errors (`handlesOwnErrors`), so we use `mutateAsync` + a local
 * try/catch to intercept a 409 name-collision and surface an inline "merge into
 * it instead?" affordance that switches straight to the merge flow with the
 * colliding category preset as the target.
 */
export function RenameModal({
  source,
  allCategories,
  onOpenChange,
  onSwitchToMerge,
}: {
  source: Category | null;
  allCategories: Category[];
  onOpenChange: (open: boolean) => void;
  onSwitchToMerge: (target: Category) => void;
}) {
  const updateCategory = useUpdateCategory();
  const [value, setValue] = useState(source?.display_name ?? "");
  // Collision surfaced by the backend's 409 — a category to merge into instead.
  const [collision, setCollision] = useState<Category | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!source) return;
    const name = value.trim();
    if (name.length === 0 || name === source.display_name) {
      onOpenChange(false);
      return;
    }
    try {
      await updateCategory.mutateAsync({
        id: source.id,
        data: { display_name: name },
      });
      toast.success(`Renamed to "${name}"`);
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        // Find the existing category that owns this name so the merge flow can
        // preset it. Fall back to a no-target switch if we can't resolve it.
        const target =
          allCategories.find(
            (c) =>
              c.id !== source.id &&
              c.display_name.trim().toLowerCase() === name.toLowerCase(),
          ) ?? null;
        setCollision(target);
      }
      // Other errors: useUpdateCategory already showed its own toast.
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="rename-category-input">Name</FieldLabel>
        <Input
          id="rename-category-input"
          autoFocus
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (collision) setCollision(null);
          }}
          aria-invalid={collision !== null}
        />
      </Field>
      {collision && (
        <div className="border-destructive/30 bg-destructive/5 flex flex-col gap-2 rounded-md border p-3 text-sm">
          <p className="text-foreground">
            &ldquo;{collision.display_name}&rdquo; already exists — merge into
            it instead?
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={() => onSwitchToMerge(collision)}
          >
            <Merge /> Merge into {collision.display_name}
          </Button>
        </div>
      )}
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className="h-11 sm:h-9"
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="h-11 sm:h-9"
          disabled={
            updateCategory.isPending ||
            collision !== null ||
            value.trim().length === 0
          }
        >
          Rename
        </Button>
      </div>
    </form>
  );
}

/**
 * Merge flow — two steps in one shell: (1) a `Command` combobox to pick a target
 * category, (2) a consequence pre-confirm ("N articles move to <target>;
 * '<source>' becomes an alias"). No undo on merge.
 */
export function MergeModal({
  open,
  source,
  allCategories,
  presetTarget,
  onOpenChange,
}: {
  open: boolean;
  source: Category | null;
  allCategories: Category[];
  presetTarget: Category | null;
  onOpenChange: (open: boolean) => void;
}) {
  const mergeCategories = useMergeCategories();
  const [target, setTarget] = useState<Category | null>(presetTarget);
  const [prevOpen, setPrevOpen] = useState(open);
  // Reset step state on each fresh open; honor a preset target from the 409.
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setTarget(presetTarget);
  }

  const candidates = allCategories.filter((c) => c.id !== source?.id);

  function handleConfirm() {
    if (!source || !target) return;
    mergeCategories.mutate(
      { source_id: source.id, target_id: target.id },
      {
        onSuccess: () => {
          toast.success(`Merged into "${target.display_name}"`);
          onOpenChange(false);
        },
      },
    );
  }

  if (target) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-center gap-3 text-sm font-medium">
          <span className="text-muted-foreground line-through">
            {source?.display_name}
          </span>
          <ArrowRight className="text-muted-foreground size-4" />
          <span>{target.display_name}</span>
        </div>
        <div className="bg-muted/40 rounded-md p-3 text-sm">
          <p>
            <span className="font-semibold tabular-nums">
              {source?.article_count}
            </span>{" "}
            article{source?.article_count === 1 ? "" : "s"} move to{" "}
            <span className="font-medium">{target.display_name}</span>.
          </p>
          <p className="text-muted-foreground mt-1">
            &ldquo;{source?.display_name}&rdquo; becomes an alias. This
            can&apos;t be undone.
          </p>
        </div>
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="h-11 sm:h-9"
            onClick={() => setTarget(null)}
          >
            Back
          </Button>
          <Button
            type="button"
            className="h-11 sm:h-9"
            disabled={mergeCategories.isPending}
            onClick={handleConfirm}
          >
            <Merge /> Confirm merge
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">
        Merge &ldquo;{source?.display_name}&rdquo; into which category?
      </p>
      <Command className="border-border rounded-md border">
        <CommandInput placeholder="Search categories…" />
        <CommandList>
          <CommandEmpty>No matching categories.</CommandEmpty>
          <CommandGroup>
            {candidates.map((c) => (
              <CommandItem
                key={c.id}
                value={c.display_name}
                onSelect={() => setTarget(c)}
              >
                <span className="flex-1">{c.display_name}</span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {c.article_count}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
      <Separator />
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** The rename/merge modal host — one ResponsiveModal, content chosen by mode. */
export type CategoryModal =
  | { kind: "rename"; source: Category }
  | { kind: "merge"; source: Category; presetTarget: Category | null };

export function CategoryActionModals({
  modal,
  allCategories,
  onClose,
  onSwitchToMerge,
}: {
  modal: CategoryModal | null;
  allCategories: Category[];
  onClose: () => void;
  onSwitchToMerge: (source: Category, target: Category) => void;
}) {
  // Retain the last non-null modal so exit animations run (close by flipping
  // `open`, never by unmounting), and bump a generation on each null→non-null
  // transition so a reopened form/step never reuses stale state.
  const [generation, setGeneration] = useState(0);
  const [prevModal, setPrevModal] = useState(modal);
  const [lastModal, setLastModal] = useState(modal);
  if (modal !== prevModal) {
    setPrevModal(modal);
    if (modal !== null) {
      setLastModal(modal);
      if (prevModal === null) setGeneration(generation + 1);
    }
  }

  const active = modal ?? lastModal;
  if (!active) return null;

  const title = active.kind === "rename" ? "Rename category" : "Merge category";
  const body =
    active.kind === "rename" ? (
      <RenameModal
        key={generation}
        source={active.source}
        allCategories={allCategories}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        onSwitchToMerge={(target) => onSwitchToMerge(active.source, target)}
      />
    ) : (
      <MergeModal
        key={generation}
        open={modal !== null}
        source={active.source}
        allCategories={allCategories}
        presetTarget={active.presetTarget}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      />
    );

  return (
    <ResponsiveModal
      open={modal !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={title}
    >
      {body}
    </ResponsiveModal>
  );
}
