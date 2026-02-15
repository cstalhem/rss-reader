"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Stack,
  Textarea,
  Text,
  Flex,
  Skeleton,
} from "@chakra-ui/react";
import { LuTag } from "react-icons/lu";
import { Field } from "@/components/ui/field";
import { toaster } from "@/components/ui/toaster";
import { usePreferences } from "@/hooks/usePreferences";

const WEIGHT_OPTIONS = [
  { value: "blocked", label: "Blocked" },
  { value: "low", label: "Low" },
  { value: "neutral", label: "Neutral" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export function InterestsSection() {
  const {
    preferences,
    categories,
    isLoading,
    updatePreferences,
    updateCategoryWeight,
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
        onError: (error) => {
          toaster.create({
            title: "Failed to save preferences",
            description:
              error instanceof Error ? error.message : "An error occurred",
            type: "error",
          });
        },
      }
    );
  };

  const handleWeightChange = (category: string, weight: string) => {
    updateCategoryWeight(
      { category, weight },
      {
        onSuccess: () => {
          toaster.create({
            title: "Category weight updated",
            description: `${category} set to ${weight}`,
            type: "success",
          });
        },
        onError: (error) => {
          toaster.create({
            title: "Failed to update weight",
            description:
              error instanceof Error ? error.message : "An error occurred",
            type: "error",
          });
        },
      }
    );
  };

  const getCategoryWeight = (category: string): string => {
    return preferences?.topic_weights?.[category] || "neutral";
  };

  if (isLoading) {
    return (
      <Stack gap={4}>
        <Skeleton height="120px" variant="shine" />
        <Skeleton height="120px" variant="shine" />
        <Skeleton height="200px" variant="shine" />
      </Stack>
    );
  }

  return (
    <Stack gap={8}>
      {/* Interest Preferences Section */}
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

      {/* Topic Categories Section */}
      <Box>
        <Text fontSize="xl" fontWeight="semibold" mb={2}>
          Topic Categories
        </Text>
        <Text color="fg.muted" mb={6}>
          Adjust how strongly each topic affects your article scores
        </Text>

        {categories.length === 0 ? (
          <Flex
            direction="column"
            alignItems="center"
            justifyContent="center"
            gap={4}
            p={8}
            bg="bg.subtle"
            borderRadius="md"
            borderWidth="1px"
            borderColor="border.subtle"
          >
            <LuTag size={40} color="var(--chakra-colors-fg-subtle)" />
            <Text color="fg.muted" textAlign="center">
              Categories will appear here once articles are scored by the LLM
            </Text>
          </Flex>
        ) : (
          <Stack gap={3}>
            {categories.map((category) => (
              <Flex
                key={category}
                alignItems="center"
                justifyContent="space-between"
                p={3}
                bg="bg.subtle"
                borderRadius="md"
                borderWidth="1px"
                borderColor="border.subtle"
              >
                <Text fontWeight="medium" textTransform="capitalize">
                  {category}
                </Text>
                <Flex gap={1}>
                  {WEIGHT_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      size="sm"
                      variant={
                        getCategoryWeight(category) === option.value
                          ? "solid"
                          : "ghost"
                      }
                      colorPalette={
                        getCategoryWeight(category) === option.value
                          ? "accent"
                          : undefined
                      }
                      onClick={() =>
                        handleWeightChange(category, option.value)
                      }
                    >
                      {option.label}
                    </Button>
                  ))}
                </Flex>
              </Flex>
            ))}
          </Stack>
        )}
      </Box>
    </Stack>
  );
}
