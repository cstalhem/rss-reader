"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Container,
  Heading,
  Stack,
  Textarea,
  Text,
  Flex,
  Spinner,
} from "@chakra-ui/react";
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

export default function SettingsPage() {
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
            description: "Your interest preferences have been updated. Articles will be re-scored shortly.",
            type: "success",
          });
        },
        onError: (error) => {
          toaster.create({
            title: "Failed to save preferences",
            description: error instanceof Error ? error.message : "An error occurred",
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
            description: error instanceof Error ? error.message : "An error occurred",
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
      <Container maxW="2xl" py={8} px={6}>
        <Flex justifyContent="center" alignItems="center" minH="400px">
          <Spinner size="lg" colorPalette="accent" />
        </Flex>
      </Container>
    );
  }

  return (
    <Container maxW="2xl" py={8} px={6}>
      <Stack gap={8}>
        {/* Interest Preferences Section */}
        <Box>
          <Heading size="xl" mb={6}>
            Interest Preferences
          </Heading>
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
          <Heading size="xl" mb={2}>
            Topic Categories
          </Heading>
          <Text color="fg.muted" mb={6}>
            Adjust how strongly each topic affects your article scores
          </Text>

          {categories.length === 0 ? (
            <Box
              p={8}
              bg="bg.subtle"
              borderRadius="md"
              borderWidth="1px"
              borderColor="border.subtle"
              textAlign="center"
            >
              <Text color="fg.muted">
                Categories will appear here once articles are scored by the LLM
              </Text>
            </Box>
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
    </Container>
  );
}
