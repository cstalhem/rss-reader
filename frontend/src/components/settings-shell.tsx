"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { SettingsNavBadge } from "@/components/settings-nav-badge";
import { SETTINGS_SECTIONS } from "@/lib/settings-sections";
import { cn } from "@/lib/utils";

/**
 * Settings chrome (issue #98 "Shell B" decision, approved via
 * `app/prototype/categories/shell-b.tsx`): desktop md+ is a persistent left
 * nav rail beside a content pane; phone <md is an iOS-style index list that
 * drills into a full-width section page with a back affordance. Breakpoint
 * driven, not a user toggle.
 *
 * Rendered once by `app/settings/layout.tsx`; `children` is the active
 * section's page content (a route segment, not local state).
 *
 * TODO(#98 phase 4): accept a `badgeCounts?: Partial<Record<string, number>>`
 * prop (keyed by section id) once `useCategories` exists, and pass
 * `badgeCounts?.[section.id]` into `SettingsNavBadge` below instead of the
 * hardcoded `undefined`.
 */
export function SettingsShell({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  return isMobile ? (
    <PhoneDrillIn>{children}</PhoneDrillIn>
  ) : (
    <DesktopRail>{children}</DesktopRail>
  );
}

function DesktopRail({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex w-full max-w-5xl gap-8 px-4 py-8">
      <nav className="w-56 shrink-0">
        <h1 className="text-muted-foreground mb-3 px-2.5 text-xs font-semibold tracking-wider uppercase">
          Settings
        </h1>
        <ul className="flex flex-col gap-0.5">
          {SETTINGS_SECTIONS.map((section) => {
            const isActive = pathname.startsWith(section.href);
            return (
              <li key={section.id}>
                <Link
                  href={section.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative flex w-full items-center gap-2.5 rounded-md py-2 pr-2.5 pl-4 text-left text-sm transition-colors",
                    isActive
                      ? "bg-muted text-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  {isActive && (
                    <span
                      className="bg-primary absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full"
                      aria-hidden
                    />
                  )}
                  <section.icon className="size-4 shrink-0" />
                  <span className="flex-1">{section.label}</span>
                  {/* TODO(#98 phase 4): wire triage count from useCategories */}
                  {section.id === "categories" && (
                    <SettingsNavBadge count={undefined} />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}

function PhoneDrillIn({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isIndex = pathname === "/settings";
  const activeSection = SETTINGS_SECTIONS.find((s) =>
    pathname.startsWith(s.href),
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      {isIndex ? (
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
                  {/* TODO(#98 phase 4): wire triage count from useCategories */}
                  {section.id === "categories" && (
                    <SettingsNavBadge count={undefined} />
                  )}
                  <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="flex flex-col gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 self-start"
            onClick={() => router.push("/settings")}
          >
            <ChevronLeft /> {activeSection?.label}
          </Button>
          {children}
        </div>
      )}
    </div>
  );
}
