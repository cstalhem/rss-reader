"use client";

import { Button, Flex } from "@chakra-ui/react";
import { LuPlus } from "react-icons/lu";
import { PROVIDER_REGISTRY } from "./providers/registry";
import type { ProviderListItem } from "@/lib/types";

interface ProviderPillBarProps {
  providers: ProviderListItem[];
  pendingProviders: Set<string>;
  expandedProvider: string | null;
  onToggle: (id: string) => void;
  onAddClick: () => void;
}

export function ProviderPillBar({
  providers,
  pendingProviders,
  expandedProvider,
  onToggle,
  onAddClick,
}: ProviderPillBarProps) {
  // Merge saved + pending (deduplicated, pending after saved)
  const savedIds = providers.map((p) => p.provider);
  const pendingIds = Array.from(pendingProviders).filter(
    (id) => !savedIds.includes(id)
  );
  const allIds = [...savedIds, ...pendingIds];

  return (
    <Flex gap={2} wrap="wrap" alignItems="center">
      {allIds.map((id) => {
        const plugin = PROVIDER_REGISTRY.find((p) => p.id === id);
        if (!plugin) return null;
        const isActive = expandedProvider === id;
        const isPending = pendingProviders.has(id);

        return (
          <Button
            key={id}
            size="sm"
            variant={isActive ? "subtle" : "outline"}
            colorPalette={isActive ? "accent" : undefined}
            onClick={() => onToggle(id)}
            borderStyle={isPending ? "dashed" : undefined}
          >
            <plugin.Logo />
            {plugin.label}
          </Button>
        );
      })}

      <Button size="sm" variant="ghost" onClick={onAddClick}>
        <LuPlus />
        Add Provider
      </Button>
    </Flex>
  );
}
