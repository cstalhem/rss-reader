"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { useIsMobile } from "@/hooks/use-mobile";
import { SettingsNavBadge } from "@/components/settings-nav-badge";
import { useCategoryUnseenCount } from "@/hooks/useCategoryUnseenCount";
import { SETTINGS_SECTIONS } from "@/lib/settings-sections";

/**
 * `/settings` root content (issue #98 "Option A"). No redirect: mobile
 * renders the section selection list (the drill-in's index), desktop renders
 * an empty-state prompt since the rail already provides selection.
 */
export function SettingsHome() {
  const isMobile = useIsMobile();
  const { data: categoryUnseen } = useCategoryUnseenCount();

  if (!isMobile) {
    return (
      <div className="text-muted-foreground flex min-h-[50vh] items-center justify-center text-sm">
        Select a setting
      </div>
    );
  }

  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Settings</h1>
      <ul className="border-border overflow-hidden rounded-lg border">
        {SETTINGS_SECTIONS.map((section) => (
          <li key={section.id}>
            <Link
              href={section.href}
              className="hover:bg-muted border-border/60 flex w-full items-center gap-3 border-b px-4 py-3.5 text-left last:border-b-0"
            >
              <section.icon className="text-muted-foreground size-4 shrink-0" />
              <span className="flex-1 text-sm font-medium">
                {section.label}
              </span>
              <SettingsNavBadge
                count={
                  section.id === "categories"
                    ? categoryUnseen?.count
                    : undefined
                }
              />
              <ChevronRight className="text-muted-foreground size-4 shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
