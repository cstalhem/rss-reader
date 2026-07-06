"use client";

import { useState } from "react";

import { useCategoryUnseenCount } from "@/hooks/useCategoryUnseenCount";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { ManageTab } from "./manage-tab";
import { TriageTab } from "./triage-tab";

type Tab = "triage" | "manage";

const TABS: { key: Tab; label: string }[] = [
  { key: "triage", label: "Triage" },
  { key: "manage", label: "Manage" },
];

/** The Categories settings section — a lightweight button tab bar hosting the
 * Triage and Manage views (no shadcn Tabs dep). Defaults to Triage. */
export function CategoriesSection() {
  const [tab, setTab] = useState<Tab>("triage");
  const { data: unseen } = useCategoryUnseenCount();
  const triageCount = unseen?.count ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-lg font-semibold">Categories</h2>

      <div
        role="tablist"
        aria-label="Categories views"
        className="border-border flex gap-1 border-b"
      >
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className={cn(
                "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors",
                active
                  ? "border-primary text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              {t.label}
              {t.key === "triage" && triageCount > 0 && (
                <Badge variant="default" className="rounded-full px-1.5">
                  {triageCount}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {tab === "triage" ? <TriageTab /> : <ManageTab />}
    </div>
  );
}
