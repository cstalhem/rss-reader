"use client";

import { useState } from "react";
import { Box, Button, Flex, Input, Stack, Text } from "@chakra-ui/react";
import type { GoogleModelItem } from "@/lib/types";

const RECOMMENDED_GEMINI_MODELS = [
  { name: "models/gemini-2.5-flash", description: "Good balance, fast structured output" },
  { name: "models/gemini-2.5-pro", description: "Strong accuracy, best reasoning" },
  { name: "models/gemini-2.5-flash-lite", description: "Smallest, lowest cost" },
  { name: "models/gemini-3.1-flash-lite", description: "Latest gen, fast on simple tasks" },
];

interface GoogleModelManagementProps {
  availableModels: GoogleModelItem[];
  selectedModelNames: string[];
  onSelect: (modelNames: string[]) => void;
  isLoading: boolean;
}

function GoogleModelRow({
  model,
  isSelected,
  onToggle,
}: {
  model: GoogleModelItem;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <Box
      borderBottomWidth="1px"
      borderColor="border.subtle"
      _last={{ borderBottomWidth: 0 }}
    >
      <Flex
        alignItems="center"
        justifyContent="space-between"
        py={2.5}
        px={3}
      >
        <Box flex={1} minWidth={0}>
          <Text fontSize="sm" fontWeight="medium">
            {model.display_name}
          </Text>
          {model.description && (
            <Text fontSize="xs" color="fg.muted">
              {model.description}
            </Text>
          )}
        </Box>
        <Flex alignItems="center" gap={1} ml={2} flexShrink={0}>
          {isSelected ? (
            <Button
              size="xs"
              variant="subtle"
              colorPalette="red"
              onClick={onToggle}
            >
              Deselect
            </Button>
          ) : (
            <Button
              size="xs"
              variant="ghost"
              colorPalette="accent"
              onClick={onToggle}
            >
              Select
            </Button>
          )}
        </Flex>
      </Flex>
    </Box>
  );
}

export function GoogleModelManagement({
  availableModels,
  selectedModelNames,
  onSelect,
  isLoading,
}: GoogleModelManagementProps) {
  const [searchQuery, setSearchQuery] = useState("");

  if (isLoading) {
    return (
      <Text fontSize="sm" color="fg.muted">
        Loading models...
      </Text>
    );
  }

  const selectedSet = new Set(selectedModelNames);
  const availableByName = new Map(availableModels.map((m) => [m.name, m]));

  // Section 1: Selected models, preserving selectedModelNames order
  const selectedModels = selectedModelNames
    .map((name) => availableByName.get(name))
    .filter((m): m is GoogleModelItem => !!m);

  // Section 2: Recommended models that are unselected and available
  const unselectedRecommended = RECOMMENDED_GEMINI_MODELS.filter(
    (r) => !selectedSet.has(r.name) && availableByName.has(r.name)
  ).map((r) => availableByName.get(r.name)!);

  // Section 3: Search results
  const query = searchQuery.trim().toLowerCase();
  const searchResults =
    query.length >= 2
      ? availableModels
          .filter(
            (m) =>
              m.name.toLowerCase().includes(query) ||
              m.display_name.toLowerCase().includes(query)
          )
          .slice(0, 20)
      : [];

  const handleAdd = (name: string) => {
    onSelect([...selectedModelNames, name]);
  };

  const handleRemove = (name: string) => {
    onSelect(selectedModelNames.filter((n) => n !== name));
  };

  return (
    <Stack gap={6}>
      {/* Section 1: Selected Models */}
      <Box>
        <Text fontSize="sm" fontWeight="medium" color="fg.muted" mb={2}>
          Selected Models
        </Text>
        {selectedModels.length === 0 ? (
          <Text fontSize="sm" color="fg.muted">
            No models selected yet
          </Text>
        ) : (
          <Stack gap={0}>
            {selectedModels.map((model) => (
              <GoogleModelRow
                key={model.name}
                model={model}
                isSelected={true}
                onToggle={() => handleRemove(model.name)}
              />
            ))}
          </Stack>
        )}
      </Box>

      {/* Section 2: Recommended Models */}
      {unselectedRecommended.length > 0 && (
        <Box>
          <Text fontSize="sm" fontWeight="medium" color="fg.muted" mb={2}>
            Recommended Models
          </Text>
          <Text fontSize="xs" color="fg.muted" mb={3}>
            Suggested models for article processing:
          </Text>
          <Stack gap={0}>
            {unselectedRecommended.map((model) => (
              <GoogleModelRow
                key={model.name}
                model={model}
                isSelected={false}
                onToggle={() => handleAdd(model.name)}
              />
            ))}
          </Stack>
        </Box>
      )}

      {/* Section 3: All Models (search) */}
      <Box>
        <Text fontSize="sm" fontWeight="medium" color="fg.muted" mb={2}>
          All Models
        </Text>
        <Text fontSize="xs" color="fg.muted" mb={1.5}>
          Search the full model catalog:
        </Text>
        <Input
          size="sm"
          placeholder="Search models..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {query.length >= 2 && (
          <Stack gap={0} mt={2}>
            {searchResults.length === 0 ? (
              <Text fontSize="sm" color="fg.muted">
                No models found
              </Text>
            ) : (
              searchResults.map((model) => (
                <GoogleModelRow
                  key={model.name}
                  model={model}
                  isSelected={selectedSet.has(model.name)}
                  onToggle={() =>
                    selectedSet.has(model.name)
                      ? handleRemove(model.name)
                      : handleAdd(model.name)
                  }
                />
              ))
            )}
          </Stack>
        )}
      </Box>
    </Stack>
  );
}
