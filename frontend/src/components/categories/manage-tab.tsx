"use client";

import { useMemo, useState } from "react";
import { Folder, FolderPlus, Info, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAutoGroupApply } from "@/hooks/useAutoGroupApply";
import { useAutoGroupSuggest } from "@/hooks/useAutoGroupSuggest";
import { useBulkUpdateCategories } from "@/hooks/useBulkUpdateCategories";
import { useCategories } from "@/hooks/useCategories";
import { useGroupCategories } from "@/hooks/useGroupCategories";
import { useUpdateCategory } from "@/hooks/useUpdateCategory";
import { CATEGORY_WEIGHT_LABEL, CATEGORY_WEIGHTS } from "@/lib/constants";
import type {
  Category,
  CategoryWeight,
  GroupSuggestionItem,
} from "@/lib/types";

import { AutoGroupReview } from "./auto-group-review";
import { GroupModal, type GroupTarget } from "./group-modal";
import { WeightControl } from "./weight-controls";

/** One category row (shelves layout). Selection checkbox on every row (batch
 * weight works on any selection); grouped rows also get a remove-from-group X.
 * Weight control is inline right-aligned at md+, own full-width row on mobile. */
function CategoryRow({
  category,
  selected,
  onToggle,
  onSetWeight,
  onRemoveFromGroup,
}: {
  category: Category;
  selected: boolean;
  onToggle: () => void;
  onSetWeight: (weight: CategoryWeight) => void;
  onRemoveFromGroup?: () => void;
}) {
  return (
    <div className="flex items-start gap-2.5 py-2.5">
      <div className="pt-0.5">
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          aria-label={`Select ${category.display_name}`}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:items-center md:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {category.display_name}
          </span>
          <span className="text-muted-foreground text-xs tabular-nums">
            {category.article_count} articles
          </span>
          {onRemoveFromGroup && (
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label={`Remove ${category.display_name} from group`}
              onClick={onRemoveFromGroup}
            >
              <X />
            </Button>
          )}
        </div>
        <WeightControl
          value={category.weight}
          onChange={onSetWeight}
          fullWidth
          className="md:w-auto md:flex-none md:shrink-0"
        />
      </div>
    </div>
  );
}

type AutoPhase = "idle" | "review";

export function ManageTab() {
  const { data: categories, isLoading } = useCategories();
  const updateCategory = useUpdateCategory();
  const bulkUpdate = useBulkUpdateCategories();
  const groupCategories = useGroupCategories();
  const autoGroupSuggest = useAutoGroupSuggest();
  const autoGroupApply = useAutoGroupApply();

  // Selection held once here as a hoisted Set<number> — never per-row state.
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [groupModalOpen, setGroupModalOpen] = useState(false);

  const [autoPhase, setAutoPhase] = useState<AutoPhase>("idle");
  const [suggestions, setSuggestions] = useState<GroupSuggestionItem[]>([]);

  const all = useMemo(() => categories ?? [], [categories]);
  const byId = useMemo(() => new Map(all.map((c) => [c.id, c])), [all]);

  // A shelf is a category referenced as a parent by at least one other category.
  const { shelves, ungrouped } = useMemo(() => {
    const childrenByParent = new Map<number, Category[]>();
    for (const category of all) {
      if (category.parent_id !== null) {
        const list = childrenByParent.get(category.parent_id) ?? [];
        list.push(category);
        childrenByParent.set(category.parent_id, list);
      }
    }
    const parentIds = new Set(childrenByParent.keys());
    const shelves = [...childrenByParent.entries()]
      .map(([parentId, children]) => ({
        parent: byId.get(parentId),
        children,
      }))
      .filter(
        (shelf): shelf is { parent: Category; children: Category[] } =>
          shelf.parent !== undefined,
      );
    // Ungrouped: no parent AND not itself a shelf parent.
    const ungrouped = all.filter(
      (c) => c.parent_id === null && !parentIds.has(c.id),
    );
    return { shelves, ungrouped };
  }, [all, byId]);

  const selectionAllUngrouped = useMemo(
    () => [...selected].every((id) => byId.get(id)?.parent_id === null),
    [selected, byId],
  );

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setWeight(id: number, weight: CategoryWeight) {
    updateCategory.mutate({ id, data: { weight } });
  }

  function applyBatchWeight(weight: CategoryWeight) {
    if (selected.size === 0) return;
    bulkUpdate.mutate({ category_ids: [...selected], weight });
    setSelected(new Set());
  }

  function handleGroupConfirm(target: GroupTarget) {
    const category_ids = [...selected];
    const payload =
      target.kind === "new"
        ? { category_ids, new_parent_name: target.name }
        : { category_ids, target_parent_id: target.id };
    groupCategories.mutate(payload, {
      onSuccess: () => {
        setGroupModalOpen(false);
        setSelected(new Set());
        toast.success("Grouped");
      },
    });
  }

  function ungroupChildren(childIds: number[]) {
    if (childIds.length === 0) return;
    groupCategories.mutate({ category_ids: childIds, ungroup: true });
  }

  function startAutoGroup() {
    autoGroupSuggest.mutate(undefined, {
      onSuccess: (response) => {
        setSuggestions(response.groups);
        setAutoPhase("review");
      },
    });
  }

  function applyAutoGroups(groups: GroupSuggestionItem[]) {
    autoGroupApply.mutate(
      { groups },
      {
        onSuccess: () => {
          setAutoPhase("idle");
          toast.success("Applied auto-groups");
        },
      },
    );
  }

  if (autoPhase === "review") {
    return (
      <AutoGroupReview
        suggestions={suggestions}
        isPending={autoGroupApply.isPending}
        onCancel={() => setAutoPhase("idle")}
        onApply={applyAutoGroups}
      />
    );
  }

  // Existing shelf parents, for the "add to existing group" list.
  const parents = shelves.map((shelf) => shelf.parent);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-semibold">Manage categories</h3>
          <p className="text-muted-foreground text-sm">
            Set each category&apos;s weight and organize them into groups.
            Weight is an ordinal scale: Block &lt; Reduce &lt; Normal &lt; Boost
            &lt; Max.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={autoGroupSuggest.isPending}
          onClick={startAutoGroup}
        >
          <Sparkles /> Auto-group
        </Button>
      </div>

      <div className="border-border/60 bg-muted/30 text-muted-foreground flex items-start gap-2 rounded-md border px-3 py-2 text-xs">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Groups are for display only. They organize this list into shelves and{" "}
          <span className="font-medium">never affect weights or filtering</span>
          .
        </span>
      </div>

      {/* Batch toolbar — always present. Group is enabled only when the whole
          selection is ungrouped; batch weight works on any selection. Sticks
          to the top of the scroll area on phone (where the category list is
          long enough to scroll past it); desktop keeps the static in-flow
          toolbar since the rail layout doesn't need it. */}
      <div className="bg-background border-border md:bg-muted/50 sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 max-md:shadow-sm md:static">
        <span className="text-muted-foreground text-sm tabular-nums">
          {selected.size > 0
            ? `${selected.size} selected`
            : "Select categories to edit"}
        </span>
        <div className="flex-1" />
        {selected.size > 0 && (
          <div
            role="group"
            aria-label="Set weight for selected"
            className="border-border flex overflow-hidden rounded-md border"
          >
            {CATEGORY_WEIGHTS.map((weight) => (
              <button
                key={weight}
                type="button"
                disabled={bulkUpdate.isPending}
                onClick={() => applyBatchWeight(weight)}
                className="border-border text-muted-foreground hover:bg-muted border-r px-2 py-1 text-xs transition-colors last:border-r-0 disabled:opacity-50"
              >
                {CATEGORY_WEIGHT_LABEL[weight]}
              </button>
            ))}
          </div>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled={
            selected.size === 0 ||
            !selectionAllUngrouped ||
            groupCategories.isPending
          }
          title={
            selected.size > 0 && !selectionAllUngrouped
              ? "Only ungrouped categories can be grouped"
              : undefined
          }
          onClick={() => setGroupModalOpen(true)}
        >
          <FolderPlus /> Group categories
        </Button>
        {selected.size > 0 && (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Clear selection"
            onClick={() => setSelected(new Set())}
          >
            <X />
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <div className="flex flex-col gap-5">
          {shelves.map((shelf) => (
            <section
              key={shelf.parent.id}
              className="border-border overflow-hidden rounded-lg border"
            >
              <header className="bg-muted border-border/60 flex items-center justify-between gap-2 border-b px-3.5 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <Folder className="text-muted-foreground size-4 shrink-0" />
                  <h4 className="truncate text-sm font-semibold">
                    {shelf.parent.display_name}
                  </h4>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {shelf.children.length}
                  </span>
                </div>
                <Button
                  size="xs"
                  variant="ghost"
                  className="text-muted-foreground shrink-0"
                  disabled={groupCategories.isPending}
                  onClick={() =>
                    ungroupChildren(shelf.children.map((c) => c.id))
                  }
                >
                  Ungroup all
                </Button>
              </header>
              <div className="divide-border/60 divide-y px-3">
                {shelf.children.map((category) => (
                  <CategoryRow
                    key={category.id}
                    category={category}
                    selected={selected.has(category.id)}
                    onToggle={() => toggle(category.id)}
                    onSetWeight={(weight) => setWeight(category.id, weight)}
                    onRemoveFromGroup={() => ungroupChildren([category.id])}
                  />
                ))}
              </div>
            </section>
          ))}

          <section className="flex flex-col gap-1">
            <h4 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Ungrouped
            </h4>
            {ungrouped.length === 0 ? (
              <p className="text-muted-foreground py-2 text-sm">
                Everything is grouped.
              </p>
            ) : (
              <div className="divide-border/60 divide-y">
                {ungrouped.map((category) => (
                  <CategoryRow
                    key={category.id}
                    category={category}
                    selected={selected.has(category.id)}
                    onToggle={() => toggle(category.id)}
                    onSetWeight={(weight) => setWeight(category.id, weight)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      <GroupModal
        open={groupModalOpen}
        count={selected.size}
        parents={parents}
        isPending={groupCategories.isPending}
        onOpenChange={setGroupModalOpen}
        onConfirm={handleGroupConfirm}
      />
    </div>
  );
}
