"use client";

import { useState } from "react";
import {
  Box,
  Button,
  createListCollection,
  Flex,
  Grid,
  Portal,
  Select,
  Stack,
  Switch,
  Text,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { LuTriangleAlert } from "react-icons/lu";
import { useScoringStatus } from "@/hooks/useScoringStatus";
import { fetchDownloadStatus } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type { DownloadStatus, OllamaConfig, OllamaModel } from "@/lib/types";
import { formatSize } from "@/lib/utils";

interface ModelSelectorProps {
  models: OllamaModel[];
  config: OllamaConfig;
  savedConfig: OllamaConfig;
  onConfigChange: (config: OllamaConfig) => void;
  onSave: (rescore: boolean) => void;
  isSaving: boolean;
}

function modelLabel(model: OllamaModel): string {
  const size = formatSize(model.size);
  const loaded = model.is_loaded ? " (loaded)" : "";
  return `${model.name} \u2014 ${size}${loaded}`;
}

function ModelSelect({
  collection,
  value,
  onChange,
  disabled,
  placeholder = "Select model",
}: {
  collection: ReturnType<typeof createListCollection<{ label: string; value: string }>>;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <Select.Root
      collection={collection}
      size="sm"
      value={[value]}
      onValueChange={(details) => {
        const selected = details.value[0];
        if (selected) onChange(selected);
      }}
      positioning={{ sameWidth: true }}
      disabled={disabled}
    >
      <Select.HiddenSelect />
      <Select.Control>
        <Select.Trigger>
          <Select.ValueText placeholder={placeholder} />
        </Select.Trigger>
        <Select.IndicatorGroup>
          <Select.Indicator />
        </Select.IndicatorGroup>
      </Select.Control>
      <Portal>
        <Select.Positioner>
          <Select.Content>
            {collection.items.map((item) => (
              <Select.Item key={item.value} item={item}>
                {item.label}
                <Select.ItemIndicator />
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Positioner>
      </Portal>
    </Select.Root>
  );
}

export function ModelSelector({
  models,
  config,
  savedConfig,
  onConfigChange,
  onSave,
  isSaving,
}: ModelSelectorProps) {
  const noModels = models.length === 0;
  const hasMultipleModels = models.length >= 2;
  const isDirty = JSON.stringify(config) !== JSON.stringify(savedConfig);

  // Download status from shared cache
  const { data: downloadStatus } = useQuery<DownloadStatus>({
    queryKey: queryKeys.ollama.downloadStatus,
    queryFn: fetchDownloadStatus,
  });
  const downloadingModel = downloadStatus?.active ? downloadStatus.model : null;
  const downloadPct =
    downloadStatus?.active && downloadStatus.total > 0
      ? Math.round((downloadStatus.completed / downloadStatus.total) * 100)
      : null;

  // Rescore state
  const [initialConfig] = useState(() => JSON.stringify(savedConfig));
  const [hasRescored, setHasRescored] = useState(false);
  const { data: scoringStatus } = useScoringStatus();

  const configChanged = JSON.stringify(savedConfig) !== initialConfig;
  const canRescore = configChanged && !hasRescored && !isSaving;
  const isScoring =
    scoringStatus &&
    (scoringStatus.queued > 0 || scoringStatus.scoring > 0);

  const handleRescore = () => {
    setHasRescored(true);
    onSave(true);
  };

  const handleModelChange = (field: "categorization_model" | "scoring_model", value: string) => {
    const next = { ...config, [field]: value || null };
    if (!next.use_separate_models && field === "categorization_model") {
      next.scoring_model = value || null;
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

  const modelCollection = createListCollection({
    items: models.map((m) => ({
      label: modelLabel(m),
      value: m.name,
    })),
  });

  return (
    <Stack gap={4}>
      {/* Sub-section heading */}
      <Text fontSize="sm" fontWeight="medium" color="fg.muted">
        Active Model
      </Text>

      {/* Mode toggle — before dropdowns so it acts as a mode switch */}
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

      {/* Model dropdown(s) */}
      {config.use_separate_models ? (
        <>
          <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
            <Box>
              <Text fontSize="sm" fontWeight="medium" mb={1.5}>
                Categorization
              </Text>
              <ModelSelect
                collection={modelCollection}
                value={config.categorization_model ?? ""}
                onChange={(v) => handleModelChange("categorization_model", v)}
                disabled={noModels}
                placeholder={noModels ? "No models available" : "Select model"}
              />
              {downloadingModel === config.categorization_model && (
                <Box mt={1.5}>
                  <Box height="4px" bg="bg.subtle" borderRadius="full" overflow="hidden" mb={0.5}>
                    <Box height="100%" bg="accent.solid" borderRadius="full" width={`${downloadPct ?? 0}%`} transition="width 0.3s ease" />
                  </Box>
                  <Text fontSize="xs" color="fg.muted">
                    Downloading... {downloadPct != null ? `${downloadPct}%` : ""}
                  </Text>
                </Box>
              )}
            </Box>
            <Box>
              <Text fontSize="sm" fontWeight="medium" mb={1.5}>
                Scoring
              </Text>
              <ModelSelect
                collection={modelCollection}
                value={config.scoring_model ?? ""}
                onChange={(v) => handleModelChange("scoring_model", v)}
                disabled={noModels}
                placeholder={noModels ? "No models available" : "Select model"}
              />
              {downloadingModel === config.scoring_model && config.scoring_model !== config.categorization_model && (
                <Box mt={1.5}>
                  <Box height="4px" bg="bg.subtle" borderRadius="full" overflow="hidden" mb={0.5}>
                    <Box height="100%" bg="accent.solid" borderRadius="full" width={`${downloadPct ?? 0}%`} transition="width 0.3s ease" />
                  </Box>
                  <Text fontSize="xs" color="fg.muted">
                    Downloading... {downloadPct != null ? `${downloadPct}%` : ""}
                  </Text>
                </Box>
              )}
            </Box>
          </Grid>
          <Flex alignItems="center" gap={2} color="fg.warning">
            <LuTriangleAlert size={14} />
            <Text fontSize="xs">
              Both models need to fit in available memory when loaded simultaneously.
            </Text>
          </Flex>
        </>
      ) : (
        <Box>
          <Text fontSize="sm" fontWeight="medium" mb={1.5}>
            Model
          </Text>
          <ModelSelect
            collection={modelCollection}
            value={config.categorization_model ?? ""}
            onChange={(v) => handleModelChange("categorization_model", v)}
            disabled={noModels}
            placeholder={noModels ? "No models available" : "Select model"}
          />
          {downloadingModel === config.categorization_model && (
            <Box mt={1.5}>
              <Box height="4px" bg="bg.subtle" borderRadius="full" overflow="hidden" mb={0.5}>
                <Box height="100%" bg="accent.solid" borderRadius="full" width={`${downloadPct ?? 0}%`} transition="width 0.3s ease" />
              </Box>
              <Text fontSize="xs" color="fg.muted">
                Downloading... {downloadPct != null ? `${downloadPct}%` : ""}
              </Text>
            </Box>
          )}
        </Box>
      )}

      {/* Extended thinking toggle */}
      <Switch.Root
        checked={config.thinking}
        onCheckedChange={(e) => onConfigChange({ ...config, thinking: e.checked })}
      >
        <Switch.HiddenInput />
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <Switch.Label>
          <Text fontSize="sm">Enable extended thinking</Text>
        </Switch.Label>
      </Switch.Root>

      {/* Actions — separated from form fields */}
      <Box borderTopWidth="1px" borderColor="border.subtle" pt={4} mt={1}>
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
          <Button
            variant="outline"
            size="sm"
            disabled={!canRescore}
            loading={isSaving}
            onClick={handleRescore}
          >
            Re-evaluate unread articles
          </Button>
        </Flex>
        {isScoring && configChanged && (
          <Text fontSize="xs" color="fg.muted" mt={2}>
            Model change will take effect after current batch completes.
          </Text>
        )}
      </Box>
    </Stack>
  );
}
