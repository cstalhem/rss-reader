"use client";

import { useCallback, useReducer } from "react";
import { Flex, Stack, Text } from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
import { useOllamaHealth } from "@/hooks/useOllamaHealth";
import { useOllamaModels } from "@/hooks/useOllamaModels";
import { useOllamaConfig } from "@/hooks/useOllamaConfig";
import { OllamaHealthBadge } from "./OllamaHealthBadge";
import { ModelSelector } from "./ModelSelector";
import { SystemPrompts } from "./SystemPrompts";
import type { OllamaConfig } from "@/lib/types";

interface OllamaSectionProps {
  isVisible: boolean;
}

export function OllamaSection({ isVisible }: OllamaSectionProps) {
  const { data: health, isLoading: healthLoading } = useOllamaHealth(isVisible);
  const isConnected = health?.connected ?? false;
  const { data: models } = useOllamaModels(isConnected);
  const { config: serverConfig, savedConfig, isLoading: configLoading, saveMutation } =
    useOllamaConfig();

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
      saveMutation.mutate(
        { ...effectiveConfig, rescore },
        {
          onSuccess: (result) => {
            // Clear local edits so we fall back to the fresh server config
            setLocalEdits(null);
            if (rescore && result.rescore_queued > 0) {
              toaster.create({
                title: `${result.rescore_queued} articles queued for re-evaluation`,
                type: "success",
              });
            } else if (!rescore) {
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
        }
      );
    },
    [effectiveConfig, saveMutation]
  );

  return (
    <Stack gap={6}>
      {/* Section header */}
      <Flex alignItems="center" justifyContent="space-between">
        <Text fontSize="xl" fontWeight="semibold">
          Ollama
        </Text>
        <OllamaHealthBadge health={health} isLoading={healthLoading} />
      </Flex>

      {/* Model selector */}
      {!configLoading && effectiveConfig && savedConfig && (
        <ModelSelector
          models={models ?? []}
          config={effectiveConfig}
          savedConfig={savedConfig}
          isConnected={isConnected}
          onConfigChange={handleConfigChange}
          onSave={handleSave}
          isSaving={saveMutation.isPending}
        />
      )}

      {/* System prompts */}
      <SystemPrompts />
    </Stack>
  );
}
