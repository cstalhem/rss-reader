"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useIsMobile } from "@/hooks/use-mobile";
import { DEFAULT_SETTINGS_SECTION } from "@/lib/settings-sections";

/**
 * `/settings` root content. On phone, `SettingsShell`'s drill-in already
 * renders the section index list whenever the path is exactly `/settings` —
 * this component renders nothing there. On desktop there's no separate index
 * view (the rail is always visible), so this redirects to the first section
 * so `/settings` isn't a blank content pane.
 */
export function SettingsIndex() {
  const isMobile = useIsMobile();
  const router = useRouter();

  useEffect(() => {
    if (!isMobile) {
      router.replace(DEFAULT_SETTINGS_SECTION.href);
    }
  }, [isMobile, router]);

  return null;
}
