"use client";

import { useState } from "react";

import { ResponsiveModal } from "@/components/responsive-modal";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { Category } from "@/lib/types";

export type GroupTarget =
  { kind: "new"; name: string } | { kind: "existing"; id: number };

/** Modal to name a new group or pick an existing one for the selected categories. */
export function GroupModal({
  open,
  count,
  parents,
  isPending,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  count: number;
  parents: Category[];
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (target: GroupTarget) => void;
}) {
  const [name, setName] = useState("");
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setName("");
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={`Group ${count} categor${count === 1 ? "y" : "ies"}`}
    >
      <div className="flex flex-col gap-4">
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim().length > 0) {
              onConfirm({ kind: "new", name: name.trim() });
            }
          }}
        >
          <Field>
            <FieldLabel htmlFor="group-name">New group name</FieldLabel>
            <div className="flex gap-2">
              <Input
                id="group-name"
                autoFocus
                placeholder="e.g. Hardware & Devices"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <Button
                type="submit"
                disabled={isPending || name.trim().length === 0}
              >
                Create
              </Button>
            </div>
          </Field>
        </form>
        {parents.length > 0 && (
          <>
            <Separator />
            <div className="flex flex-col gap-2">
              <span className="text-muted-foreground text-xs font-medium">
                Or add to an existing group
              </span>
              <ul className="flex flex-col">
                {parents.map((parent) => (
                  <li key={parent.id}>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        onConfirm({ kind: "existing", id: parent.id })
                      }
                      className="hover:bg-muted flex w-full items-center rounded-md px-2.5 py-2 text-left text-sm disabled:opacity-50"
                    >
                      {parent.display_name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </ResponsiveModal>
  );
}
