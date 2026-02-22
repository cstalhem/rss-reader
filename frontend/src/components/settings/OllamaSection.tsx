"use client";

import { useCallback, useReducer } from "react";
import { EmptyState, Stack, Text } from "@chakra-ui/react";
import { LuServerOff } from "react-icons/lu";
import { toaster } from "@/components/ui/toaster";
import { useOllamaHealth } from "@/hooks/useOllamaHealth";
import { useOllamaModels } from "@/hooks/useOllamaModels";
import { useOllamaConfig } from "@/hooks/useOllamaConfig";
import { useModelPull } from "@/hooks/useModelPull";
import { OllamaHealthBadge } from "./OllamaHealthBadge";
import { ModelSelector } from "./ModelSelector";
import { ModelManagement } from "./ModelManagement";
import { SystemPrompts } from "./SystemPrompts";
import { SettingsPanel } from "./SettingsPanel";
import { SettingsPageHeader } from "./SettingsPageHeader";
import type { OllamaConfig } from "@/lib/types";

export function OllamaSection() {
  const { data: health, isLoading: healthLoading } = useOllamaHealth(true);
  const isConnected = health?.connected ?? false;
  const { data: models } = useOllamaModels(isConnected);
  const { config: serverConfig, isLoading: configLoading, saveMutation, rescoreMutation } =
    useOllamaConfig();
  const pullHook = useModelPull();

  // Track local edits as an overlay on top of server config.
  // Using useReducer to avoid the setState-in-effect pattern.
  // localEdits is null when the user hasn't made any changes yet.
  const [localEdits, setLocalEdits] = useReducer(
    (_prev: OllamaConfig | null, next: OllamaConfig | null) => next,
    null
  );

  // The effective config: local edits if user has touched the form, otherwise server config
  const effectiveConfig = localEdits ?? serverConfig;

  const handleConfigChange = useCallback((config: OllamaConfig) => {
    setLocalEdits(config);
  }, []);

  const handleSave = useCallback(
    (rescore: boolean) => {
      if (!effectiveConfig) return;
      saveMutation.mutate(effectiveConfig, {
        onSuccess: () => {
          // Clear local edits so we fall back to the fresh server config
          setLocalEdits(null);
          if (rescore) {
            // Step 2: trigger rescore as separate call
            rescoreMutation.mutate(undefined, {
              onSuccess: (result) => {
                if (result.rescore_queued > 0) {
                  toaster.create({
                    title: `${result.rescore_queued} articles queued for re-evaluation`,
                    type: "success",
                  });
                }
              },
              onError: () => {
                toaster.create({
                  title: "Config saved but failed to trigger rescore",
                  type: "error",
                });
              },
            });
          } else {
            toaster.create({
              title: "Model configuration saved",
              type: "success",
            });
          }
        },
        onError: () => {
          toaster.create({
            title: "Failed to save configuration",
            type: "error",
          });
        },
      });
    },
    [effectiveConfig, saveMutation, rescoreMutation]
  );

  return (
    <Stack gap={6}>
      {/* Section header */}
      <SettingsPageHeader title="Ollama">
        <OllamaHealthBadge health={health} isLoading={healthLoading} />
      </SettingsPageHeader>

      {!isConnected ? (
        <EmptyState.Root>
          <EmptyState.Content>
            <EmptyState.Indicator>
              <LuServerOff size={40} />
            </EmptyState.Indicator>
            <EmptyState.Description>
              Ollama is not connected. Start Ollama to configure models and prompts.
            </EmptyState.Description>
          </EmptyState.Content>
        </EmptyState.Root>
      ) : (
        <>
          {/* Panel 1: Model Configuration */}
          <SettingsPanel>
            <Text fontSize="lg" fontWeight="semibold" mb={4}>
              Model Configuration
            </Text>
            {!configLoading && effectiveConfig && serverConfig && (
              <ModelSelector
                models={models ?? []}
                config={effectiveConfig}
                savedConfig={serverConfig}
                onConfigChange={handleConfigChange}
                onSave={handleSave}
                isSaving={saveMutation.isPending || rescoreMutation.isPending}
              />
            )}
          </SettingsPanel>

          {/* Panel 2: Model Library */}
          <SettingsPanel>
            <Text fontSize="lg" fontWeight="semibold" mb={4}>
              Model Library
            </Text>
            <ModelManagement
              models={models ?? []}
              config={effectiveConfig}
              pullHook={pullHook}
            />
          </SettingsPanel>

          {/* Panel 3: System Prompts */}
          <SettingsPanel>
            <Text fontSize="lg" fontWeight="semibold" mb={4}>
              System Prompts
            </Text>
            <SystemPrompts />
          </SettingsPanel>
        </>
      )}
    </Stack>
  );
}
