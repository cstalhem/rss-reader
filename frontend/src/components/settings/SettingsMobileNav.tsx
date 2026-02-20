"use client";

import { usePathname, useRouter } from "next/navigation";
import { NativeSelect } from "@chakra-ui/react";

const SECTIONS = [
  { value: "feeds", label: "Feeds" },
  { value: "interests", label: "Interests" },
  { value: "categories", label: "Categories" },
  { value: "ollama", label: "Ollama" },
  { value: "feedback", label: "Feedback" },
];

export function SettingsMobileNav() {
  const pathname = usePathname();
  const router = useRouter();

  // Extract last segment: /settings/feeds -> "feeds"
  const activeSection = pathname.split("/").pop() ?? "feeds";

  return (
    <NativeSelect.Root size="sm">
      <NativeSelect.Field
        value={activeSection}
        onChange={(e) => router.push(`/settings/${e.target.value}`)}
      >
        {SECTIONS.map((section) => (
          <option key={section.value} value={section.value}>
            {section.label}
          </option>
        ))}
      </NativeSelect.Field>
      <NativeSelect.Indicator />
    </NativeSelect.Root>
  );
}
