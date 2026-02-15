"use client";

import { useState, useEffect } from "react";
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

export function InterestsSection() {
  const {
    preferences,
    isLoading,
    updatePreferences,
    isUpdating,
  } = usePreferences();

  const [interests, setInterests] = useState("");
  const [antiInterests, setAntiInterests] = useState("");

  // Sync form state from fetched preferences after hydration
  useEffect(() => {
    if (preferences) {
      setInterests(preferences.interests || "");
      setAntiInterests(preferences.anti_interests || "");
    }
  }, [preferences]);

  const handleSave = () => {
    updatePreferences(
      {
        interests,
        anti_interests: antiInterests,
      },
      {
        onSuccess: () => {
          toaster.create({
            title: "Preferences saved",
            description:
              "Your interest preferences have been updated. Articles will be re-scored shortly.",
            type: "success",
          });
        },
        onError: (error: Error) => {
          toaster.create({
            title: "Failed to save preferences",
            description: error.message || "An error occurred",
            type: "error",
          });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <Stack gap={4}>
        <Skeleton height="120px" variant="shine" />
        <Skeleton height="120px" variant="shine" />
      </Stack>
    );
  }

  return (
    <Stack gap={8}>
      <Box>
        <Text fontSize="xl" fontWeight="semibold" mb={6}>
          Interest Preferences
        </Text>
        <Stack gap={6}>
          <Field
            label="Interests"
            helperText="Describe topics you want to see more of in natural language"
          >
            <Textarea
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
              rows={6}
              resize="vertical"
              placeholder="Example: I'm interested in software architecture, distributed systems, and developer productivity tools. I enjoy deep technical articles with code examples, especially about Python, TypeScript, and system design."
            />
          </Field>

          <Field
            label="Anti-interests"
            helperText="Describe topics you want to avoid"
          >
            <Textarea
              value={antiInterests}
              onChange={(e) => setAntiInterests(e.target.value)}
              rows={4}
              resize="vertical"
              placeholder="Example: I'm not interested in cryptocurrency price speculation, celebrity gossip, or marketing growth hacks. I'd rather skip low-effort listicles and SEO-optimized filler content."
            />
          </Field>

          <Button
            colorPalette="accent"
            onClick={handleSave}
            loading={isUpdating}
            alignSelf="flex-start"
          >
            Save Preferences
          </Button>
        </Stack>
      </Box>
    </Stack>
  );
}
