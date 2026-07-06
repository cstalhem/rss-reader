"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";

import { useIsMobile } from "@/hooks/use-mobile";
import { useCategoryUnseenCount } from "@/hooks/useCategoryUnseenCount";
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
 * The nav badge counts are keyed by section id (`badgeCounts[section.id]`).
 * The shell is a client component, so it fetches the counts itself rather than
 * threading a prop down from the server `layout.tsx`.
 */
type BadgeCounts = Partial<Record<string, number>>;

export function SettingsShell({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const { data: categoryUnseen } = useCategoryUnseenCount();
  const badgeCounts: BadgeCounts = { categories: categoryUnseen?.count };

  return isMobile ? (
    <PhoneDrillIn badgeCounts={badgeCounts}>{children}</PhoneDrillIn>
  ) : (
    <DesktopRail badgeCounts={badgeCounts}>{children}</DesktopRail>
  );
}

function DesktopRail({
  children,
  badgeCounts,
}: {
  children: React.ReactNode;
  badgeCounts: BadgeCounts;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen w-full items-stretch justify-center">
      <nav className="bg-sidebar border-sidebar-border w-56 shrink-0 border-r px-4 py-8">
        <Link
          href="/"
          className="text-muted-foreground hover:bg-muted/50 hover:text-foreground mb-4 flex items-center gap-2.5 rounded-md py-2 pr-2.5 pl-4 text-left text-sm transition-colors"
        >
          <ArrowLeft className="size-4 shrink-0" />
          <span>Back to reading</span>
        </Link>
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
                  <SettingsNavBadge count={badgeCounts[section.id]} />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <main className="max-w-3xl min-w-0 flex-1 px-4 py-8">{children}</main>
    </div>
  );
}

function PhoneDrillIn({
  children,
  badgeCounts,
}: {
  children: React.ReactNode;
  badgeCounts: BadgeCounts;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isIndex = pathname === "/settings";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      {isIndex ? (
        <>
          <Link
            href="/"
            className="text-muted-foreground hover:bg-muted/50 hover:text-foreground mb-4 -ml-2 flex w-fit items-center gap-2.5 rounded-md py-2 pr-2.5 pl-2 text-left text-sm transition-colors"
          >
            <ArrowLeft className="size-4 shrink-0" />
            <span>Back to reading</span>
          </Link>
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
                  <SettingsNavBadge count={badgeCounts[section.id]} />
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
            <ChevronLeft /> Back
          </Button>
          {children}
        </div>
      )}
    </div>
  );
}
