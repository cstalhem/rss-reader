"use client";

import { useCallback, useReducer } from "react";
import { Box, Flex, Stack, Text } from "@chakra-ui/react";
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
import type { OllamaConfig } from "@/lib/types";

interface OllamaSectionProps {
  isVisible: boolean;
}

export function OllamaSection({ isVisible }: OllamaSectionProps) {
  const { data: health, isLoading: healthLoading } = useOllamaHealth(isVisible);
  const isConnected = health?.connected ?? false;
  const { data: models } = useOllamaModels(isConnected);
  const { config: serverConfig, isLoading: configLoading, saveMutation } =
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

      {!isConnected ? (
        <Flex
          direction="column"
          alignItems="center"
          justifyContent="center"
          gap={4}
          py={16}
          px={8}
          bg="bg.subtle"
          borderRadius="md"
          borderWidth="1px"
          borderColor="border.subtle"
        >
          <Box color="fg.subtle"><LuServerOff size={40} /></Box>
          <Text fontSize="lg" color="fg.muted" textAlign="center">
            Ollama is not connected
          </Text>
          <Text fontSize="sm" color="fg.muted" textAlign="center">
            Start Ollama to configure models and prompts
          </Text>
        </Flex>
      ) : (
        <>
          {/* Panel 1: Model Configuration */}
          <Box bg="bg.subtle" borderRadius="md" borderWidth="1px" borderColor="border.subtle" p={6}>
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
                isSaving={saveMutation.isPending}
              />
            )}
          </Box>

          {/* Panel 2: Model Library */}
          <Box bg="bg.subtle" borderRadius="md" borderWidth="1px" borderColor="border.subtle" p={6}>
            <Text fontSize="lg" fontWeight="semibold" mb={4}>
              Model Library
            </Text>
            <ModelManagement
              models={models ?? []}
              config={effectiveConfig}
              pullHook={pullHook}
            />
          </Box>

          {/* Panel 3: System Prompts */}
          <Box bg="bg.subtle" borderRadius="md" borderWidth="1px" borderColor="border.subtle" p={6}>
            <Text fontSize="lg" fontWeight="semibold" mb={4}>
              System Prompts
            </Text>
            <SystemPrompts />
          </Box>
        </>
      )}
    </Stack>
  );
}
