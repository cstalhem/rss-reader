"use client";

import {
  Box,
  Button,
  createListCollection,
  Flex,
  Portal,
  Select,
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

  // Create collection for Chakra Select
  const modelCollection = createListCollection({
    items: models.map((m) => ({
      label: modelLabel(m),
      value: m.name,
    })),
  });

  return (
    <Stack gap={4}>
      {/* Single model selector (or categorization model when split) */}
      <Box>
        <Text fontSize="sm" fontWeight="medium" mb={1.5}>
          {config.use_separate_models ? "Categorization Model" : "Model"}
        </Text>
        <Select.Root
          collection={modelCollection}
          size="sm"
          value={[config.categorization_model]}
          onValueChange={(details) => {
            const selectedValue = details.value[0];
            if (selectedValue) {
              handleModelChange("categorization_model", selectedValue);
            }
          }}
          positioning={{ sameWidth: true }}
        >
          <Select.HiddenSelect />
          <Select.Control>
            <Select.Trigger>
              <Select.ValueText placeholder="Select model" />
            </Select.Trigger>
            <Select.IndicatorGroup>
              <Select.Indicator />
            </Select.IndicatorGroup>
          </Select.Control>
          <Portal>
            <Select.Positioner>
              <Select.Content>
                {modelCollection.items.map((item) => (
                  <Select.Item key={item.value} item={item}>
                    {item.label}
                    <Select.ItemIndicator />
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Positioner>
          </Portal>
        </Select.Root>
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
          <Select.Root
            collection={modelCollection}
            size="sm"
            value={[config.scoring_model]}
            onValueChange={(details) => {
              const selectedValue = details.value[0];
              if (selectedValue) {
                handleModelChange("scoring_model", selectedValue);
              }
            }}
            positioning={{ sameWidth: true }}
          >
            <Select.HiddenSelect />
            <Select.Control>
              <Select.Trigger>
                <Select.ValueText placeholder="Select model" />
              </Select.Trigger>
              <Select.IndicatorGroup>
                <Select.Indicator />
              </Select.IndicatorGroup>
            </Select.Control>
            <Portal>
              <Select.Positioner>
                <Select.Content>
                  {modelCollection.items.map((item) => (
                    <Select.Item key={item.value} item={item}>
                      {item.label}
                      <Select.ItemIndicator />
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Positioner>
            </Portal>
          </Select.Root>

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
