"use client";

import { useState, useCallback } from "react";
import {
  Badge,
  Box,
  Button,
  Dialog,
  Flex,
  IconButton,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
import { LuDownload, LuTrash2, LuServerOff } from "react-icons/lu";
import { useQueryClient } from "@tanstack/react-query";
import { deleteOllamaModel } from "@/lib/api";
import { toaster } from "@/components/ui/toaster";
import { ModelPullProgress } from "./ModelPullProgress";
import type { OllamaModel, OllamaConfig } from "@/lib/types";
import type { useModelPull } from "@/hooks/useModelPull";

interface ModelManagementProps {
  models: OllamaModel[];
  isConnected: boolean;
  config: OllamaConfig | undefined;
  pullHook: ReturnType<typeof useModelPull>;
}

const CURATED_MODELS = [
  { name: "qwen3:1.7b", size: "~1.0 GB", description: "Smallest, fast on CPU" },
  { name: "qwen3:4b", size: "~2.5 GB", description: "Good balance" },
  { name: "qwen3:8b", size: "~4.9 GB", description: "Strong accuracy" },
  { name: "gemma3:4b", size: "~3.3 GB", description: "Google, good at classification" },
  { name: "llama3.2:3b", size: "~2.0 GB", description: "Meta, efficient" },
];

export function ModelManagement({
  models,
  isConnected,
  config,
  pullHook,
}: ModelManagementProps) {
  const [customModel, setCustomModel] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [pullingModel, setPullingModel] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const installedNames = new Set(models.map((m) => m.name));

  const activeModels = new Set<string>();
  if (config) {
    activeModels.add(config.categorization_model);
    activeModels.add(config.scoring_model);
  }

  const handlePull = useCallback(
    (name: string) => {
      setPullingModel(name);
      pullHook.startPull(name);
    },
    [pullHook]
  );

  const handleCustomPull = useCallback(() => {
    const trimmed = customModel.trim();
    if (!trimmed) return;
    setPullingModel(trimmed);
    pullHook.startPull(trimmed);
    setCustomModel("");
  }, [customModel, pullHook]);

  const handleDelete = useCallback(
    async (name: string) => {
      try {
        await deleteOllamaModel(name);
        queryClient.invalidateQueries({ queryKey: ["ollama-models"] });
        toaster.create({ title: `Deleted ${name}`, type: "success" });
      } catch {
        toaster.create({
          title: `Failed to delete ${name}`,
          type: "error",
        });
      }
      setDeleteTarget(null);
    },
    [queryClient]
  );

  // Clear pullingModel when download finishes
  if (!pullHook.isDownloading && pullingModel) {
    setPullingModel(null);
  }

  if (!isConnected) {
    return (
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
        <LuServerOff size={40} color="var(--chakra-colors-fg-subtle)" />
        <Text fontSize="lg" color="fg.muted" textAlign="center">
          Ollama is not connected
        </Text>
        <Text fontSize="sm" color="fg.muted" textAlign="center">
          Start Ollama to manage models
        </Text>
      </Flex>
    );
  }

  return (
    <Stack gap={4}>
      <Text fontSize="sm" fontWeight="medium">
        Available Models
      </Text>

      {/* Curated model list */}
      <Stack gap={0}>
        {CURATED_MODELS.map((curated) => {
          const installed = installedNames.has(curated.name);
          const isPulling =
            pullHook.isDownloading && pullingModel === curated.name;
          const canDelete = installed && !activeModels.has(curated.name);

          return (
            <Box
              key={curated.name}
              borderBottomWidth="1px"
              borderColor="border.subtle"
              _last={{ borderBottomWidth: 0 }}
            >
              <Flex
                alignItems="center"
                justifyContent="space-between"
                py={2.5}
                px={3}
              >
                {/* Left: info */}
                <Box flex={1} minWidth={0}>
                  <Flex alignItems="center" gap={2}>
                    <Text fontSize="sm" fontWeight="medium">
                      {curated.name}
                    </Text>
                    <Text fontSize="xs" color="fg.muted">
                      {curated.size}
                    </Text>
                    {installed && (
                      <Badge
                        size="sm"
                        colorPalette="green"
                        variant="subtle"
                      >
                        Installed
                      </Badge>
                    )}
                  </Flex>
                  <Text fontSize="xs" color="fg.muted">
                    {curated.description}
                  </Text>
                </Box>

                {/* Right: action */}
                <Flex alignItems="center" gap={1} ml={2} flexShrink={0}>
                  {!installed ? (
                    <Button
                      size="xs"
                      variant="ghost"
                      disabled={pullHook.isDownloading}
                      onClick={() => handlePull(curated.name)}
                    >
                      <LuDownload size={14} />
                      Pull
                    </Button>
                  ) : canDelete ? (
                    <IconButton
                      aria-label={`Delete ${curated.name}`}
                      size="xs"
                      variant="ghost"
                      color="fg.muted"
                      onClick={() => setDeleteTarget(curated.name)}
                    >
                      <LuTrash2 size={14} />
                    </IconButton>
                  ) : null}
                </Flex>
              </Flex>

              {/* Progress bar - full width below row */}
              {isPulling && pullHook.progress && (
                <Box px={3} pb={2.5}>
                  <ModelPullProgress
                    progress={pullHook.progress}
                    onCancel={pullHook.cancelPull}
                  />
                </Box>
              )}
            </Box>
          );
        })}
      </Stack>

      {/* Installed models not in curated list */}
      {models
        .filter((m) => !CURATED_MODELS.some((c) => c.name === m.name))
        .map((m) => {
          const canDelete = !activeModels.has(m.name);
          const isPulling =
            pullHook.isDownloading && pullingModel === m.name;

          return (
            <Box
              key={m.name}
              borderBottomWidth="1px"
              borderColor="border.subtle"
              _last={{ borderBottomWidth: 0 }}
            >
              <Flex
                alignItems="center"
                justifyContent="space-between"
                py={2.5}
                px={3}
              >
                <Flex alignItems="center" gap={2}>
                  <Text fontSize="sm" fontWeight="medium">
                    {m.name}
                  </Text>
                  <Badge size="sm" colorPalette="green" variant="subtle">
                    Installed
                  </Badge>
                </Flex>
                <Flex alignItems="center" gap={1} ml={2} flexShrink={0}>
                  {canDelete && (
                    <IconButton
                      aria-label={`Delete ${m.name}`}
                      size="xs"
                      variant="ghost"
                      color="fg.muted"
                      onClick={() => setDeleteTarget(m.name)}
                    >
                      <LuTrash2 size={14} />
                    </IconButton>
                  )}
                </Flex>
              </Flex>

              {/* Progress bar - full width below row */}
              {isPulling && pullHook.progress && (
                <Box px={3} pb={2.5}>
                  <ModelPullProgress
                    progress={pullHook.progress}
                    onCancel={pullHook.cancelPull}
                  />
                </Box>
              )}
            </Box>
          );
        })}

      {/* Custom model input */}
      <Box>
        <Text fontSize="xs" color="fg.muted" mb={1.5}>
          Custom model
        </Text>
        <Flex gap={2}>
          <Input
            size="sm"
            placeholder="e.g., mistral:7b"
            value={customModel}
            onChange={(e) => setCustomModel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCustomPull();
            }}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!customModel.trim() || pullHook.isDownloading}
            onClick={handleCustomPull}
          >
            Pull
          </Button>
        </Flex>
      </Box>

      {/* Active custom pull progress (when pulling a custom model) */}
      {pullHook.isDownloading &&
        pullingModel &&
        !CURATED_MODELS.some((c) => c.name === pullingModel) &&
        !models.some((m) => m.name === pullingModel) &&
        pullHook.progress && (
          <Box px={3}>
            <Text fontSize="xs" color="fg.muted" mb={1}>
              Pulling {pullingModel}...
            </Text>
            <ModelPullProgress
              progress={pullHook.progress}
              onCancel={pullHook.cancelPull}
            />
          </Box>
        )}

      {/* Error display */}
      {pullHook.error && (
        <Text fontSize="xs" color="red.400">
          {pullHook.error}
        </Text>
      )}

      {/* Delete confirmation dialog */}
      <Dialog.Root
        open={!!deleteTarget}
        onOpenChange={({ open }) => !open && setDeleteTarget(null)}
        placement="center"
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Delete Model</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Text>
                Delete <strong>{deleteTarget}</strong>? This will remove the
                model from Ollama. You can re-download it later.
              </Text>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
                  Cancel
                </Button>
              </Dialog.ActionTrigger>
              <Button
                colorPalette="red"
                onClick={() => deleteTarget && handleDelete(deleteTarget)}
              >
                Delete
              </Button>
            </Dialog.Footer>
            <Dialog.CloseTrigger />
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Stack>
  );
}
