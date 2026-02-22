"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Stack,
  Textarea,
  Text,
  Skeleton,
} from "@chakra-ui/react";
import { Field } from "@/components/ui/field";
import { toaster } from "@/components/ui/toaster";
import { usePreferences } from "@/hooks/usePreferences";
import { SettingsPanel } from "./SettingsPanel";
import { SettingsPageHeader } from "./SettingsPageHeader";
import { UserPreferences } from "@/lib/types";

interface InterestsFormProps {
  preferences: UserPreferences;
  updatePreferencesMutation: ReturnType<typeof usePreferences>["updatePreferencesMutation"];
}

/** Form initialized from preferences on mount; refetches never overwrite edits. */
function InterestsForm({ preferences, updatePreferencesMutation }: InterestsFormProps) {
  const [interests, setInterests] = useState(preferences.interests || "");
  const [antiInterests, setAntiInterests] = useState(preferences.anti_interests || "");

  const handleSave = () => {
    const payload = {
      interests,
      anti_interests: antiInterests,
    };
    updatePreferencesMutation.mutate(payload, {
      onSuccess: () => {
        setInterests(payload.interests);
        setAntiInterests(payload.anti_interests);
        toaster.create({
          title: "Preferences saved",
          description:
            "Your interest preferences have been updated. Articles will be re-scored shortly.",
          type: "success",
        });
      },
    });
  };

  return (
    <SettingsPanel>
      <Stack gap={6}>
        <Box>
          <Text fontSize="lg" fontWeight="semibold" mb={4}>
            Interests
          </Text>
          <Field helperText="Describe topics you want to see more of in natural language">
            <Textarea
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
              rows={6}
              resize="vertical"
              placeholder="Example: I'm interested in software architecture, distributed systems, and developer productivity tools. I enjoy deep technical articles with code examples, especially about Python, TypeScript, and system design."
            />
          </Field>
        </Box>

        <Box>
          <Text fontSize="lg" fontWeight="semibold" mb={4}>
            Anti-interests
          </Text>
          <Field helperText="Describe topics you want to avoid">
            <Textarea
              value={antiInterests}
              onChange={(e) => setAntiInterests(e.target.value)}
              rows={4}
              resize="vertical"
              placeholder="Example: I'm not interested in cryptocurrency price speculation, celebrity gossip, or marketing growth hacks. I'd rather skip low-effort listicles and SEO-optimized filler content."
            />
          </Field>
        </Box>

        <Button
          colorPalette="accent"
          onClick={handleSave}
          loading={updatePreferencesMutation.isPending}
          alignSelf="flex-start"
        >
          Save Preferences
        </Button>
      </Stack>
    </SettingsPanel>
  );
}

export function InterestsSection() {
  const {
    preferences,
    isLoading,
    updatePreferencesMutation,
  } = usePreferences();

  if (isLoading || !preferences) {
    return (
      <Stack gap={4}>
        <Skeleton height="120px" variant="shine" />
        <Skeleton height="120px" variant="shine" />
      </Stack>
    );
  }

  return (
    <Stack as="section" aria-label="Interests" gap={6}>
      <SettingsPageHeader title="Interest Preferences" />

      <InterestsForm
        preferences={preferences}
        updatePreferencesMutation={updatePreferencesMutation}
      />
    </Stack>
  );
}
