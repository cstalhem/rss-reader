"use client";

import { useCallback, useEffect, useState } from "react";
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

export function LLMProvidersSection() {
  const { providers, disconnectMutation } = useProviders();
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [pendingProviders, setPendingProviders] = useState<Set<string>>(
    new Set()
  );

  // When a pending provider appears in the server list, remove it from pending
  useEffect(() => {
    if (!providers) return;
    const serverIds = new Set(providers.map((p) => p.provider));
    setPendingProviders((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (!serverIds.has(id)) next.add(id);
      }
      if (next.size === prev.size) return prev;
      return next;
    });
  }, [providers]);

  const handleAdd = useCallback((providerId: string) => {
    setPendingProviders((prev) => new Set(prev).add(providerId));
    setExpandedProvider(providerId);
    setShowAddDialog(false);
  }, []);

  const handleCancelSetup = useCallback((providerId: string) => {
    setPendingProviders((prev) => {
      const next = new Set(prev);
      next.delete(providerId);
      return next;
    });
    setExpandedProvider(null);
  }, []);

  const handleDisconnect = useCallback(
    (providerId: string) => {
      disconnectMutation.mutate(providerId, {
        onSuccess: () => {
          setExpandedProvider(null);
        },
      });
    },
    [disconnectMutation.mutate]
  );

  const handleToggle = useCallback(
    (id: string) => {
      setExpandedProvider((prev) => (prev === id ? null : id));
    },
    []
  );

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
