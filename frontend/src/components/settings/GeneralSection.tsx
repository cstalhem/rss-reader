"use client";

import { useState, useEffect, useRef } from "react";
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
import { SettingsPanel } from "./SettingsPanel";
import { SettingsPanelHeading } from "./SettingsPanelHeading";
import { SettingsPageHeader } from "./SettingsPageHeader";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchRefreshStatus } from "@/lib/api";
import { usePreferences } from "@/hooks/usePreferences";
import { queryKeys } from "@/lib/queryKeys";
import { toaster } from "@/components/ui/toaster";

type TimeUnit = "seconds" | "minutes" | "hours";

const unitCollection = createListCollection({
  items: [
    { label: "Seconds", value: "seconds" },
    { label: "Minutes", value: "minutes" },
    { label: "Hours", value: "hours" },
  ],
});

/** Decompose total seconds into the most natural unit. */
function decomposeInterval(totalSeconds: number): { value: number; unit: TimeUnit } {
  if (totalSeconds % 3600 === 0) return { value: totalSeconds / 3600, unit: "hours" };
  if (totalSeconds % 60 === 0) return { value: totalSeconds / 60, unit: "minutes" };
  return { value: totalSeconds, unit: "seconds" };
}

/** Convert value + unit back to total seconds. */
function toSeconds(value: number, unit: TimeUnit): number {
  if (unit === "hours") return value * 3600;
  if (unit === "minutes") return value * 60;
  return value;
}

/** Format seconds as a human-readable string. */
function formatInterval(totalSeconds: number): string {
  const { value, unit } = decomposeInterval(totalSeconds);
  const label = value === 1 ? unit.slice(0, -1) : unit;
  return `${value} ${label}`;
}

/** Format remaining seconds as "Xm Ys" countdown string. */
function formatCountdown(remainingSeconds: number): string {
  if (remainingSeconds <= 0) return "Refreshing now...";
  const m = Math.floor(remainingSeconds / 60);
  const s = remainingSeconds % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function GeneralSection() {
  const queryClient = useQueryClient();
  const { preferences, isLoading, updatePreferencesMutation } = usePreferences();

  // Refresh status query for countdown
  const { data: refreshStatus } = useQuery({
    queryKey: queryKeys.feeds.refreshStatus,
    queryFn: fetchRefreshStatus,
    refetchInterval: 60_000, // re-fetch the target time every minute
  });

  // Local form state — reset when the saved value changes
  const savedInterval = preferences?.feed_refresh_interval ?? 1800;
  const prevSavedRef = useRef(savedInterval);
  const decomposed = decomposeInterval(savedInterval);
  const [inputValue, setInputValue] = useState<number>(decomposed.value);
  const [inputUnit, setInputUnit] = useState<TimeUnit>(decomposed.unit);

  // Reset local state during render when the underlying saved value changes
  if (prevSavedRef.current !== savedInterval) {
    prevSavedRef.current = savedInterval;
    setInputValue(decomposed.value);
    setInputUnit(decomposed.unit);
  }

  const currentTotalSeconds = toSeconds(inputValue, inputUnit);
  const isDirty = currentTotalSeconds !== savedInterval;

  // Live countdown — subscribes to a 1-second interval timer (external system).
  // The countdown state is null when no refresh is scheduled, and a number (seconds) otherwise.
  const nextRefreshAt = refreshStatus?.next_refresh_at ?? null;
  const [countdown, setCountdown] = useState<number | null>(null);
  const prevTargetRef = useRef(nextRefreshAt);

  // Reset to null during render when target disappears
  if (nextRefreshAt !== prevTargetRef.current) {
    prevTargetRef.current = nextRefreshAt;
    if (!nextRefreshAt) setCountdown(null);
  }

  useEffect(() => {
    if (!nextRefreshAt) return;

    const target = new Date(nextRefreshAt).getTime();
    const tick = () => setCountdown(Math.max(0, Math.round((target - Date.now()) / 1000)));

    tick(); // initial sync — intentional since this is subscribing to the system clock
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextRefreshAt]);

  const handleSave = () => {
    updatePreferencesMutation.mutate(
      { feed_refresh_interval: currentTotalSeconds },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.feeds.refreshStatus });
          toaster.create({
            title: "Refresh schedule updated",
            type: "success",
          });
        },
      }
    );
  };

  if (isLoading) return null;

  return (
    <Stack as="section" aria-label="General" gap={6}>
      <SettingsPageHeader title="General" />

      {/* Feed Refresh Schedule */}
      <SettingsPanel>
        <Stack gap={4}>
          <SettingsPanelHeading>
            Feed Refresh Schedule
          </SettingsPanelHeading>

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

          {/* Save */}
          <Box borderTopWidth="1px" borderColor="border.subtle" pt={4} mt={1}>
            <Button
              colorPalette="accent"
              size="sm"
              disabled={!isDirty}
              loading={updatePreferencesMutation.isPending}
              onClick={handleSave}
            >
              Save
            </Button>
          </Box>
        </Stack>
      </SettingsPanel>
    </Stack>
  );
}
