"use client";

import { useState } from "react";
import { Button, Text, Stack } from "@chakra-ui/react";
import { useScoringStatus } from "@/hooks/useScoringStatus";
import type { OllamaConfig } from "@/lib/types";

interface RescoreButtonProps {
  savedConfig: OllamaConfig;
  onRescore: () => void;
  isRescoring: boolean;
}

export function RescoreButton({
  savedConfig,
  onRescore,
  isRescoring,
}: RescoreButtonProps) {
  // Capture initial config on first render -- useState initializer runs once
  const [initialConfig] = useState(() => JSON.stringify(savedConfig));
  const [hasRescored, setHasRescored] = useState(false);
  const { data: scoringStatus } = useScoringStatus();

  const configChanged = JSON.stringify(savedConfig) !== initialConfig;
  const canRescore = configChanged && !hasRescored && !isRescoring;

  const isScoring =
    scoringStatus &&
    (scoringStatus.queued > 0 || scoringStatus.scoring > 0);

  const handleRescore = () => {
    setHasRescored(true);
    onRescore();
  };

  return (
    <Stack gap={2}>
      <Button
        variant="outline"
        size="sm"
        disabled={!canRescore}
        loading={isRescoring}
        onClick={handleRescore}
      >
        Re-evaluate unread articles
      </Button>
      {isScoring && configChanged && (
        <Text fontSize="xs" color="fg.muted">
          Model change will take effect after current batch completes.
        </Text>
      )}
    </Stack>
  );
}
