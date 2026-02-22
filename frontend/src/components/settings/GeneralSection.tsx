"use client";

import { useState } from "react";
import {
  Box,
  Button,
  createListCollection,
  Flex,
  Input,
  Portal,
  Select,
  Stack,
  Text,
} from "@chakra-ui/react";
import { UseMutationResult } from "@tanstack/react-query";
import { SettingsPanel } from "./SettingsPanel";
import { SettingsPanelHeading } from "./SettingsPanelHeading";
import { SettingsPageHeader } from "./SettingsPageHeader";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchRefreshStatus } from "@/lib/api";
import { usePreferences } from "@/hooks/usePreferences";
import { useCountdown } from "@/hooks/useCountdown";
import { queryKeys } from "@/lib/queryKeys";
import { toaster } from "@/components/ui/toaster";
import { TimeUnit, UserPreferences } from "@/lib/types";
import {
  decomposeInterval,
  toSeconds,
  formatInterval,
  formatCountdown,
} from "@/lib/utils";

const MIN_REFRESH_SECONDS = 60; // 1 minute
const MAX_REFRESH_SECONDS = 14400; // 4 hours

const unitCollection = createListCollection({
  items: [
    { label: "Seconds", value: "seconds" },
    { label: "Minutes", value: "minutes" },
    { label: "Hours", value: "hours" },
  ],
});

export function GeneralSection() {
  const { preferences, isLoading, updatePreferencesMutation } =
    usePreferences();

  const { data: refreshStatus } = useQuery({
    queryKey: queryKeys.feeds.refreshStatus,
    queryFn: fetchRefreshStatus,
    refetchInterval: 60_000,
  });

  const countdown = useCountdown(refreshStatus?.next_refresh_at ?? null);
  const savedInterval = preferences?.feed_refresh_interval ?? 1800;

  if (isLoading) return null;

  return (
    <Stack as="section" aria-label="General" gap={6}>
      <SettingsPageHeader title="General" />

      <RefreshIntervalForm
        key={savedInterval}
        savedInterval={savedInterval}
        countdown={countdown}
        updatePreferencesMutation={updatePreferencesMutation}
      />
    </Stack>
  );
}

function RefreshIntervalForm({
  savedInterval,
  countdown,
  updatePreferencesMutation,
}: {
  savedInterval: number;
  countdown: number | null;
  updatePreferencesMutation: UseMutationResult<
    UserPreferences,
    Error,
    Partial<UserPreferences>
  >;
}) {
  const queryClient = useQueryClient();
  const decomposed = decomposeInterval(savedInterval);
  const [inputValue, setInputValue] = useState(decomposed.value);
  const [inputUnit, setInputUnit] = useState<TimeUnit>(decomposed.unit);

  const currentTotalSeconds = toSeconds(inputValue, inputUnit);
  const isDirty = currentTotalSeconds !== savedInterval;
  const isOutOfRange =
    currentTotalSeconds < MIN_REFRESH_SECONDS ||
    currentTotalSeconds > MAX_REFRESH_SECONDS;

  const handleSave = () => {
    updatePreferencesMutation.mutate(
      { feed_refresh_interval: currentTotalSeconds },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: queryKeys.feeds.refreshStatus,
          });
          toaster.create({
            title: "Refresh schedule updated",
            type: "success",
          });
        },
      },
    );
  };

  return (
    <SettingsPanel>
      <Stack gap={4}>
        <SettingsPanelHeading>Feed Refresh Schedule</SettingsPanelHeading>

        {/* Live countdown */}
        <Box>
          <Text fontSize="sm" color="fg.default">
            {countdown !== null
              ? `Next refresh in ${formatCountdown(countdown)}`
              : "Waiting for schedule..."}
          </Text>
          <Text fontSize="xs" color="fg.muted" mt={0.5}>
            Currently refreshing every {formatInterval(savedInterval)}
          </Text>
        </Box>

        {/* Input controls */}
        <Flex gap={3} alignItems="flex-end">
          <Box flex="1" maxW="120px">
            <Text fontSize="xs" color="fg.muted" mb={1}>
              Interval
            </Text>
            <Input
              size="sm"
              type="number"
              min={1}
              value={inputValue}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v) && v > 0) setInputValue(v);
              }}
            />
          </Box>
          <Box flex="1" maxW="160px">
            <Text fontSize="xs" color="fg.muted" mb={1}>
              Unit
            </Text>
            <Select.Root
              collection={unitCollection}
              size="sm"
              value={[inputUnit]}
              onValueChange={(details) => {
                const selected = details.value[0] as TimeUnit;
                if (selected) setInputUnit(selected);
              }}
              positioning={{ sameWidth: true }}
            >
              <Select.HiddenSelect />
              <Select.Control>
                <Select.Trigger>
                  <Select.ValueText />
                </Select.Trigger>
                <Select.IndicatorGroup>
                  <Select.Indicator />
                </Select.IndicatorGroup>
              </Select.Control>
              <Portal>
                <Select.Positioner>
                  <Select.Content>
                    {unitCollection.items.map((item) => (
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
        </Flex>

        {isOutOfRange && (
          <Text fontSize="xs" color="fg.error">
            Must be between {formatInterval(MIN_REFRESH_SECONDS)} and{" "}
            {formatInterval(MAX_REFRESH_SECONDS)}
          </Text>
        )}

        {/* Save */}
        <Box borderTopWidth="1px" borderColor="border.subtle" pt={4} mt={1}>
          <Button
            colorPalette="accent"
            size="sm"
            disabled={!isDirty || isOutOfRange}
            loading={updatePreferencesMutation.isPending}
            onClick={handleSave}
          >
            Save
          </Button>
        </Box>
      </Stack>
    </SettingsPanel>
  );
}
