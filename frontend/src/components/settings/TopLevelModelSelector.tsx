"use client";

import { useEffect, useMemo, useReducer } from "react";
import {
  Box,
  Button,
  Combobox,
  Flex,
  Grid,
  Portal,
  Stack,
  Switch,
  Text,
  useFilter,
  useListCollection,
} from "@chakra-ui/react";
import { LuTriangleAlert } from "react-icons/lu";
import { toaster } from "@/components/ui/toaster";
import { useModelAssignments } from "@/hooks/useModelAssignments";
import { useAvailableModels } from "@/hooks/useAvailableModels";
import { useScoringStatus } from "@/hooks/useScoringStatus";
import { PROVIDER_REGISTRY } from "./providers/registry";
import type { AvailableModel, TaskRoutesUpdate } from "@/lib/types";
import { formatSize } from "@/lib/utils";

// --- Model item type for the collection ---

interface ModelItem {
  label: string;
  value: string;
  provider: string;
  model: string;
}

function buildModelItems(models: AvailableModel[]): ModelItem[] {
  return models.map((m) => {
    const providerPlugin = PROVIDER_REGISTRY.find((p) => p.id === m.provider);
    const providerLabel = providerPlugin?.label ?? m.provider;
    const sizePart = m.size ? ` \u2014 ${formatSize(m.size)}` : "";
    const loadedPart = m.is_loaded ? " (loaded)" : "";
    return {
      label: `${m.name}${sizePart}${loadedPart}`,
      value: `${m.provider}:${m.name}`,
      provider: providerLabel,
      model: m.name,
    };
  });
}

/** Convert a task route (provider + model) to the Combobox value key. */
function routeToValue(
  provider: string | undefined,
  model: string | null | undefined
): string | null {
  if (!provider || !model) return null;
  return `${provider}:${model}`;
}

// --- ModelCombobox sub-component (per-instance filter/collection state) ---

interface ModelComboboxProps {
  models: AvailableModel[];
  value: string | null;
  onChange: (provider: string, model: string) => void;
  label: string;
  disabled?: boolean;
}

function ModelCombobox({
  models,
  value,
  onChange,
  label,
  disabled,
}: ModelComboboxProps) {
  const items = useMemo(() => buildModelItems(models), [models]);
  const { contains } = useFilter({ sensitivity: "base" });
  const { collection, filter, set } = useListCollection({
    initialItems: items,
    filter: contains,
    groupBy: (item: ModelItem) => item.provider,
  });

  // Sync items when models prop changes (initialItems is not reactive)
  useEffect(() => {
    set(buildModelItems(models));
  }, [models, set]);

  return (
    <Box>
      <Text fontSize="sm" fontWeight="medium" mb={1.5}>
        {label}
      </Text>
      <Combobox.Root
        collection={collection}
        onInputValueChange={(e) => filter(e.inputValue)}
        value={value ? [value] : []}
        onValueChange={(details) => {
          const selected = details.value[0];
          if (!selected) return;
          const item = collection.find(selected) as ModelItem | undefined;
          if (item) {
            // Use structured fields -- never parse the value string
            const providerPlugin = PROVIDER_REGISTRY.find(
              (p) => p.label === item.provider
            );
            const providerId = providerPlugin?.id ?? item.provider;
            onChange(providerId, item.model);
          }
        }}
        size="sm"
        disabled={disabled}
        openOnClick
      >
        <Combobox.Control>
          <Combobox.Input placeholder="Search models..." />
          <Combobox.IndicatorGroup>
            <Combobox.ClearTrigger />
            <Combobox.Trigger />
          </Combobox.IndicatorGroup>
        </Combobox.Control>
        <Portal>
          <Combobox.Positioner>
            <Combobox.Content>
              <Combobox.Empty>No models found</Combobox.Empty>
              {collection.group().map(([group, groupItems]) => (
                <Combobox.ItemGroup key={group}>
                  <Combobox.ItemGroupLabel>{group}</Combobox.ItemGroupLabel>
                  {groupItems.map((item) => (
                    <Combobox.Item item={item} key={item.value}>
                      {item.label}
                      <Combobox.ItemIndicator />
                    </Combobox.Item>
                  ))}
                </Combobox.ItemGroup>
              ))}
            </Combobox.Content>
          </Combobox.Positioner>
        </Portal>
      </Combobox.Root>
    </Box>
  );
}

// --- TopLevelModelSelector ---

export function TopLevelModelSelector() {
  const {
    taskRoutes,
    useSeparateModels,
    saveMutation,
    rescoreMutation,
  } = useModelAssignments();
  const { models } = useAvailableModels();
  const { data: scoringStatus } = useScoringStatus();

  // Derive server values
  const serverCat = useMemo(() => {
    const r = taskRoutes?.find((r) => r.task === "categorization");
    return routeToValue(r?.provider, r?.model);
  }, [taskRoutes]);
  const serverScore = useMemo(() => {
    const r = taskRoutes?.find((r) => r.task === "scoring");
    return routeToValue(r?.provider, r?.model);
  }, [taskRoutes]);
  const serverSeparate = useSeparateModels ?? false;

  // Local edits overlay: null = no user edits yet, falls back to server state
  interface LocalEdits {
    cat: string | null;
    score: string | null;
    separate: boolean;
  }
  const [localEdits, setLocalEdits] = useReducer(
    (_prev: LocalEdits | null, next: LocalEdits | null) => next,
    null
  );

  // Effective values: local edits if user has touched, otherwise server
  const localCat = localEdits?.cat ?? serverCat;
  const localScore = localEdits?.score ?? serverScore;
  const localSeparate = localEdits?.separate ?? serverSeparate;

  const isDirty =
    localCat !== serverCat ||
    localScore !== serverScore ||
    localSeparate !== serverSeparate;

  const isScoring =
    scoringStatus &&
    (scoringStatus.queued > 0 || scoringStatus.scoring > 0);

  // Parse local value back to provider + model for save payload
  const parseValue = (
    val: string | null
  ): { provider: string; model: string } | null => {
    if (!val) return null;
    const allItems = buildModelItems(models ?? []);
    const item = allItems.find((i) => i.value === val);
    if (item) {
      const providerPlugin = PROVIDER_REGISTRY.find(
        (p) => p.label === item.provider
      );
      return {
        provider: providerPlugin?.id ?? item.provider,
        model: item.model,
      };
    }
    // Fallback: parse the value key (provider:model)
    const colonIdx = val.indexOf(":");
    if (colonIdx > 0) {
      return { provider: val.slice(0, colonIdx), model: val.slice(colonIdx + 1) };
    }
    return null;
  };

  const handleSave = () => {
    const catParsed = parseValue(localCat);
    const scoreParsed = parseValue(localSeparate ? localScore : localCat);
    if (!catParsed || !scoreParsed) return;

    const payload: TaskRoutesUpdate = {
      categorization: catParsed,
      scoring: scoreParsed,
      use_separate_models: localSeparate,
    };

    saveMutation.mutate(payload, {
      onSuccess: () => {
        // Clear local edits so we fall back to the fresh server state
        setLocalEdits(null);
        toaster.create({
          title: "Model assignments saved",
          type: "success",
        });
      },
    });
  };

  const handleRescore = () => {
    rescoreMutation.mutate(undefined, {
      onSuccess: (result) => {
        if (result.rescore_queued > 0) {
          toaster.create({
            title: `${result.rescore_queued} articles queued for re-evaluation`,
            type: "success",
          });
        }
      },
    });
  };

  const handleToggleSeparate = (checked: boolean) => {
    setLocalEdits({
      cat: localCat,
      score: checked ? localScore : localCat,
      separate: checked,
    });
  };

  const handleCatChange = (provider: string, model: string) => {
    const val = `${provider}:${model}`;
    setLocalEdits({
      cat: val,
      score: localSeparate ? localScore : val,
      separate: localSeparate,
    });
  };

  const handleScoreChange = (provider: string, model: string) => {
    setLocalEdits({
      cat: localCat,
      score: `${provider}:${model}`,
      separate: localSeparate,
    });
  };

  const noModels = !models || models.length === 0;
  const hasMultipleModels = (models?.length ?? 0) >= 2;

  return (
    <Stack gap={4}>
      {/* Separate models toggle */}
      {hasMultipleModels && (
        <Switch.Root
          checked={localSeparate}
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

      {/* Model Combobox(es) */}
      {localSeparate ? (
        <>
          <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
            <ModelCombobox
              models={models ?? []}
              value={localCat}
              onChange={handleCatChange}
              label="Categorization"
              disabled={noModels}
            />
            <ModelCombobox
              models={models ?? []}
              value={localScore}
              onChange={handleScoreChange}
              label="Scoring"
              disabled={noModels}
            />
          </Grid>
          <Flex alignItems="center" gap={2} color="fg.warning">
            <LuTriangleAlert size={14} />
            <Text fontSize="xs">
              Both models need to fit in available memory when loaded
              simultaneously.
            </Text>
          </Flex>
        </>
      ) : (
        <ModelCombobox
          models={models ?? []}
          value={localCat}
          onChange={handleCatChange}
          label="Model"
          disabled={noModels}
        />
      )}

      {/* Save / Re-evaluate actions */}
      <Box borderTopWidth="1px" borderColor="border.subtle" pt={4} mt={1}>
        <Flex gap={3} alignItems="center">
          <Button
            colorPalette="accent"
            size="sm"
            disabled={!isDirty}
            loading={saveMutation.isPending}
            onClick={handleSave}
          >
            Save
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={saveMutation.isPending}
            loading={rescoreMutation.isPending}
            onClick={handleRescore}
          >
            Re-evaluate unread articles
          </Button>
        </Flex>
        {isScoring && (
          <Text fontSize="xs" color="fg.muted" mt={2}>
            Model change will take effect after current batch completes.
          </Text>
        )}
      </Box>
    </Stack>
  );
}
