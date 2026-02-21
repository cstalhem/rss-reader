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
import { LuDownload, LuTrash2 } from "react-icons/lu";
import { useQueryClient } from "@tanstack/react-query";
import { deleteOllamaModel } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { toaster } from "@/components/ui/toaster";
import { ModelPullProgress } from "./ModelPullProgress";
import type { OllamaModel, OllamaConfig } from "@/lib/types";
import type { useModelPull } from "@/hooks/useModelPull";

interface ModelManagementProps {
  models: OllamaModel[];
  config: OllamaConfig | undefined;
  pullHook: ReturnType<typeof useModelPull>;
}

interface InstalledModelRowProps {
  name: string;
  sizeLabel?: string;
  canDelete: boolean;
  onDelete: () => void;
  isPulling: boolean;
  progress: ReturnType<typeof useModelPull>["progress"];
  onCancelPull: () => void;
}

function InstalledModelRow({
  name,
  sizeLabel,
  canDelete,
  onDelete,
  isPulling,
  progress,
  onCancelPull,
}: InstalledModelRowProps) {
  return (
    <Box
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
            {name}
          </Text>
          {sizeLabel && (
            <Text fontSize="xs" color="fg.muted">
              {sizeLabel}
            </Text>
          )}
          <Badge size="sm" colorPalette="green" variant="subtle">
            Installed
          </Badge>
        </Flex>
        <Flex alignItems="center" gap={1} ml={2} flexShrink={0}>
          {canDelete && (
            <IconButton
              aria-label={`Delete ${name}`}
              size="xs"
              variant="ghost"
              color="fg.muted"
              onClick={onDelete}
            >
              <LuTrash2 size={14} />
            </IconButton>
          )}
        </Flex>
      </Flex>

      {isPulling && progress && (
        <Box px={3} pb={2.5}>
          <ModelPullProgress
            progress={progress}
            onCancel={onCancelPull}
          />
        </Box>
      )}
    </Box>
  );
}

const CURATED_MODELS = [
  { name: "qwen3:1.7b", size: "~1.0 GB", description: "Smallest, fast on CPU" },
  { name: "qwen3:4b", size: "~2.5 GB", description: "Good balance, best small structured output" },
  { name: "phi4-mini", size: "~2.5 GB", description: "Microsoft, strong reasoning" },
  { name: "qwen3:8b", size: "~4.9 GB", description: "Strong accuracy" },
  { name: "gemma3:12b", size: "~8.1 GB", description: "Google, highest accuracy tier" },
];

export function ModelManagement({
  models,
  config,
  pullHook,
}: ModelManagementProps) {
  const [customModel, setCustomModel] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const pullingModel = pullHook.modelName;

  const installedNames = new Set(models.map((m) => m.name));

  const activeModels = new Set<string>();
  if (config) {
    activeModels.add(config.categorization_model);
    activeModels.add(config.scoring_model);
  }

  const handlePull = useCallback(
    (name: string) => {
      pullHook.startPull(name);
    },
    [pullHook]
  );

  const handleCustomPull = useCallback(() => {
    const trimmed = customModel.trim();
    if (!trimmed) return;
    pullHook.startPull(trimmed);
    setCustomModel("");
  }, [customModel, pullHook]);

  const handleDelete = useCallback(
    async (name: string) => {
      try {
        await deleteOllamaModel(name);
        queryClient.invalidateQueries({ queryKey: queryKeys.ollama.models });
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

  const installedCurated = CURATED_MODELS.filter((c) => installedNames.has(c.name));
  const nonCuratedInstalled = models.filter(
    (m) => !CURATED_MODELS.some((c) => c.name === m.name)
  );
  const hasInstalledModels = installedCurated.length > 0 || nonCuratedInstalled.length > 0;

  const uninstalledCurated = CURATED_MODELS.filter((c) => !installedNames.has(c.name));

  return (
    <Stack gap={4}>
      {/* Sub-section 1: Downloaded Models */}
      <Box>
        <Text fontSize="sm" fontWeight="medium" color="fg.muted" mb={2}>
          Downloaded Models
        </Text>
        {!hasInstalledModels ? (
          <Text fontSize="sm" color="fg.muted">
            No models downloaded yet
          </Text>
        ) : (
          <Stack gap={0}>
            {installedCurated.map((curated) => (
              <InstalledModelRow
                key={curated.name}
                name={curated.name}
                sizeLabel={curated.size}
                canDelete={!activeModels.has(curated.name)}
                onDelete={() => setDeleteTarget(curated.name)}
                isPulling={pullHook.isDownloading && pullingModel === curated.name}
                progress={pullHook.progress}
                onCancelPull={pullHook.cancelPull}
              />
            ))}

            {nonCuratedInstalled.map((m) => (
              <InstalledModelRow
                key={m.name}
                name={m.name}
                canDelete={!activeModels.has(m.name)}
                onDelete={() => setDeleteTarget(m.name)}
                isPulling={pullHook.isDownloading && pullingModel === m.name}
                progress={pullHook.progress}
                onCancelPull={pullHook.cancelPull}
              />
            ))}
          </Stack>
        )}
      </Box>

      {/* Sub-section 2: Download Models */}
      <Box mt={6}>
        <Text fontSize="sm" fontWeight="medium" color="fg.muted" mb={2}>
          Download Models
        </Text>

        {uninstalledCurated.length > 0 && (
          <>
            <Text fontSize="xs" color="fg.muted" mb={3}>
              Suggested models for article scoring:
            </Text>
            <Stack gap={0} mb={3}>
              {uninstalledCurated.map((curated) => {
                const isPulling =
                  pullHook.isDownloading && pullingModel === curated.name;

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
                      <Box flex={1} minWidth={0}>
                        <Flex alignItems="center" gap={2}>
                          <Text fontSize="sm" fontWeight="medium">
                            {curated.name}
                          </Text>
                          <Text fontSize="xs" color="fg.muted">
                            {curated.size}
                          </Text>
                        </Flex>
                        <Text fontSize="xs" color="fg.muted">
                          {curated.description}
                        </Text>
                      </Box>
                      <Flex alignItems="center" gap={1} ml={2} flexShrink={0}>
                        <Button
                          size="xs"
                          variant="ghost"
                          disabled={pullHook.isDownloading}
                          onClick={() => handlePull(curated.name)}
                        >
                          <LuDownload size={14} />
                          Pull
                        </Button>
                      </Flex>
                    </Flex>

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
          </>
        )}

        <Text fontSize="xs" color="fg.muted" mt={2} mb={1.5}>
          Or download a specific model:
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
            <LuDownload size={14} />
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
        <Text fontSize="xs" color="fg.error">
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
