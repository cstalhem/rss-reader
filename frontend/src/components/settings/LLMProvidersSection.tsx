"use client";

import { useMemo, useState } from "react";
import { Button, EmptyState, Stack } from "@chakra-ui/react";
import { LuBot, LuPlus } from "react-icons/lu";
import { useProviders } from "@/hooks/useProviders";
import { PROVIDER_REGISTRY } from "./providers/registry";
import type { ProviderPanelProps } from "./providers/types";
import { ProviderPillBar } from "./ProviderPillBar";
import { AddProviderDialog } from "./AddProviderDialog";
import { SystemPrompts } from "./SystemPrompts";
import { SettingsPanel } from "./SettingsPanel";
import { SettingsPageHeader } from "./SettingsPageHeader";
import { SettingsPanelHeading } from "./SettingsPanelHeading";
import { TopLevelModelSelector } from "./TopLevelModelSelector";

export function LLMProvidersSection() {
  const { providers, disconnectMutation } = useProviders();
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [rawPending, setRawPending] = useState<Set<string>>(new Set());

  // Derived: remove pending providers that now exist on the server
  const pendingProviders = useMemo(() => {
    if (!providers) return rawPending;
    const serverIds = new Set(providers.map((p) => p.provider));
    const filtered = new Set<string>();
    for (const id of rawPending) {
      if (!serverIds.has(id)) filtered.add(id);
    }
    return filtered.size === rawPending.size ? rawPending : filtered;
  }, [rawPending, providers]);

  const handleAdd = (providerId: string) => {
    setRawPending((prev) => new Set(prev).add(providerId));
    setExpandedProvider(providerId);
    setShowAddDialog(false);
  };

  const handleCancelSetup = (providerId: string) => {
    setRawPending((prev) => {
      const next = new Set(prev);
      next.delete(providerId);
      return next;
    });
    setExpandedProvider(null);
  };

  const handleDisconnect = (providerId: string) => {
    disconnectMutation.mutate(providerId, {
      onSuccess: () => {
        setExpandedProvider(null);
      },
    });
  };

  const handleToggle = (id: string) => {
    setExpandedProvider((prev) => (prev === id ? null : id));
  };

  const savedProviderIds = providers?.map((p) => p.provider) ?? [];
  const allProviderIds = [
    ...savedProviderIds,
    ...Array.from(pendingProviders).filter(
      (id) => !savedProviderIds.includes(id)
    ),
  ];
  const hasProviders = allProviderIds.length > 0;

  // Resolve the expanded provider's panel dynamically from the registry
  const expandedPlugin = expandedProvider
    ? PROVIDER_REGISTRY.find((p) => p.id === expandedProvider)
    : null;
  const isPending = expandedProvider
    ? pendingProviders.has(expandedProvider)
    : false;

  // Build panel props without importing any provider-specific components
  const panelProps: ProviderPanelProps | null = expandedProvider
    ? {
        onDisconnect: () => handleDisconnect(expandedProvider),
        isNew: isPending,
        onCancelSetup: isPending
          ? () => handleCancelSetup(expandedProvider)
          : undefined,
      }
    : null;

  return (
    <Stack as="section" aria-label="LLM Providers" gap={6}>
      <SettingsPageHeader title="LLM Providers" />

      {!hasProviders ? (
        <EmptyState.Root>
          <EmptyState.Content>
            <EmptyState.Indicator>
              <LuBot size={40} />
            </EmptyState.Indicator>
            <EmptyState.Title>No providers configured</EmptyState.Title>
            <EmptyState.Description>
              Add an LLM provider to enable article scoring and categorization.
            </EmptyState.Description>
            <Button
              size="sm"
              variant="outline"
              colorPalette="accent"
              onClick={() => setShowAddDialog(true)}
            >
              <LuPlus />
              Add Provider
            </Button>
          </EmptyState.Content>
        </EmptyState.Root>
      ) : (
        <>
          <SettingsPanel>
            <SettingsPanelHeading>Model Configuration</SettingsPanelHeading>
            <TopLevelModelSelector />
          </SettingsPanel>

          <ProviderPillBar
            providers={providers ?? []}
            pendingProviders={pendingProviders}
            expandedProvider={expandedProvider}
            onToggle={handleToggle}
            onAddClick={() => setShowAddDialog(true)}
          />

          {expandedPlugin?.Panel && panelProps && (
            <expandedPlugin.Panel {...panelProps} />
          )}
        </>
      )}

      {/* System Prompts -- provider-agnostic, always at bottom */}
      <SettingsPanel>
        <SettingsPanelHeading>System Prompts</SettingsPanelHeading>
        <SystemPrompts />
      </SettingsPanel>

      <AddProviderDialog
        open={showAddDialog}
        onOpenChange={(details) => setShowAddDialog(details.open)}
        onAdd={handleAdd}
        existingProviders={allProviderIds}
      />
    </Stack>
  );
}
