"use client";

import {
  Box,
  Button,
  Flex,
  NativeSelect,
  Stack,
  Switch,
  Text,
} from "@chakra-ui/react";
import { LuTriangleAlert } from "react-icons/lu";
import { RescoreButton } from "./RescoreButton";
import type { OllamaConfig, OllamaModel } from "@/lib/types";

interface ModelSelectorProps {
  models: OllamaModel[];
  config: OllamaConfig;
  savedConfig: OllamaConfig;
  isConnected: boolean;
  onConfigChange: (config: OllamaConfig) => void;
  onSave: (rescore: boolean) => void;
  isSaving: boolean;
}

function formatSize(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

function modelLabel(model: OllamaModel): string {
  const size = formatSize(model.size);
  const loaded = model.is_loaded ? " (loaded)" : "";
  return `${model.name} \u2014 ${size}${loaded}`;
}

export function ModelSelector({
  models,
  config,
  savedConfig,
  isConnected,
  onConfigChange,
  onSave,
  isSaving,
}: ModelSelectorProps) {
  if (!isConnected) {
    return (
      <Box py={4}>
        <Text color="fg.muted" fontSize="sm">
          Connect to Ollama to manage models
        </Text>
      </Box>
    );
  }

  const hasMultipleModels = models.length >= 2;
  const isDirty = JSON.stringify(config) !== JSON.stringify(savedConfig);

  const handleModelChange = (field: keyof OllamaConfig, value: string) => {
    const next = { ...config, [field]: value };
    // When in single-model mode, keep both models in sync
    if (!next.use_separate_models && field === "categorization_model") {
      next.scoring_model = value;
    }
    onConfigChange(next);
  };

  const handleToggleSeparate = (checked: boolean) => {
    const next = { ...config, use_separate_models: checked };
    if (!checked) {
      next.scoring_model = next.categorization_model;
    }
    onConfigChange(next);
  };

  return (
    <Stack gap={4}>
      {/* Single model selector (or categorization model when split) */}
      <Box>
        <Text fontSize="sm" fontWeight="medium" mb={1.5}>
          {config.use_separate_models ? "Categorization Model" : "Model"}
        </Text>
        <NativeSelect.Root>
          <NativeSelect.Field
            value={config.categorization_model}
            onChange={(e) =>
              handleModelChange("categorization_model", e.target.value)
            }
          >
            {models.map((m) => (
              <option key={m.name} value={m.name}>
                {modelLabel(m)}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </Box>

      {/* Separate models toggle */}
      {hasMultipleModels && (
        <Switch.Root
          checked={config.use_separate_models}
          onCheckedChange={(e) => handleToggleSeparate(e.checked)}
        >
          <Switch.HiddenInput />
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          <Switch.Label>
            <Text fontSize="sm">Use separate models</Text>
          </Switch.Label>
        </Switch.Root>
      )}

      {/* Scoring model selector (only when split) */}
      {config.use_separate_models && (
        <Box>
          <Text fontSize="sm" fontWeight="medium" mb={1.5}>
            Scoring Model
          </Text>
          <NativeSelect.Root>
            <NativeSelect.Field
              value={config.scoring_model}
              onChange={(e) =>
                handleModelChange("scoring_model", e.target.value)
              }
            >
              {models.map((m) => (
                <option key={m.name} value={m.name}>
                  {modelLabel(m)}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>

          {/* RAM warning */}
          <Flex alignItems="center" gap={2} mt={2}>
            <LuTriangleAlert size={14} color="var(--chakra-colors-orange-400)" />
            <Text fontSize="xs" color="orange.400">
              Both models need to fit in available memory when loaded
              simultaneously.
            </Text>
          </Flex>
        </Box>
      )}

      {/* Save button */}
      <Flex gap={3} alignItems="center">
        <Button
          colorPalette="accent"
          size="sm"
          disabled={!isDirty}
          loading={isSaving}
          onClick={() => onSave(false)}
        >
          Save
        </Button>
      </Flex>

      {/* Rescore button */}
      <RescoreButton
        savedConfig={savedConfig}
        onRescore={() => onSave(true)}
        isRescoring={isSaving}
      />
    </Stack>
  );
}
