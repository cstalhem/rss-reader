"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import {
  Badge,
  Button,
  Dialog,
  Flex,
  Spinner,
  Stack,
  Text,
} from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { LuCheck, LuFolder } from "react-icons/lu";
import { useProviders } from "@/hooks/useProviders";
import { useModelAssignments } from "@/hooks/useModelAssignments";
import { useAvailableModels } from "@/hooks/useAvailableModels";
import type { Category, GroupSuggestion } from "@/lib/types";

const COMPLETE_DELAY_MS = 2000;

const scaleIn = keyframes`
  from { transform: scale(0); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
`;

interface AutoGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuggest: (options?: { provider?: string; model?: string }) => void;
  suggestions: GroupSuggestion[] | null;
  isSuggesting: boolean;
  onApply: (groups: GroupSuggestion[]) => void;
  isApplying: boolean;
  allCategories: Category[];
}

export function AutoGroupDialog({
  open,
  onOpenChange,
  onSuggest,
  suggestions,
  isSuggesting,
  onApply,
  isApplying,
  allCategories,
}: AutoGroupDialogProps) {
  const { providers } = useProviders();
  const { taskRoutes } = useModelAssignments();
  const { models } = useAvailableModels();

  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [hasTriggered, setHasTriggered] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const completeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const multipleProviders = (providers?.length ?? 0) > 1;

  // Determine the categorisation model for the resolved provider
  const catRoute = taskRoutes?.find((r) => r.task === "categorization");

  // Auto-trigger suggest when dialog opens with single provider
  useEffect(() => {
    if (open && !multipleProviders && !hasTriggered && suggestions === null && !isSuggesting) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time trigger on dialog open; can't move to handler (controlled prop)
      setHasTriggered(true);
      onSuggest();
    }
  }, [open, multipleProviders, hasTriggered, suggestions, isSuggesting, onSuggest]);

  // Show "complete" phase for 2s when suggestions arrive
  const prevSuggesting = useRef(false);
  useEffect(() => {
    if (prevSuggesting.current && !isSuggesting && suggestions !== null && suggestions.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- transition detector for ephemeral animation state
      setShowComplete(true);
      completeTimer.current = setTimeout(() => setShowComplete(false), COMPLETE_DELAY_MS);
    }
    prevSuggesting.current = isSuggesting;
  }, [isSuggesting, suggestions]);

  // Compute ungrouped categories (those not mentioned in any suggestion)
  const ungroupedCategories = useMemo(() => {
    if (!suggestions) return [];
    const mentioned = new Set<string>();
    for (const group of suggestions) {
      mentioned.add(group.parent.toLowerCase());
      for (const child of group.children) {
        mentioned.add(child.toLowerCase());
      }
    }
    return allCategories
      .filter((c) => !c.is_hidden && !mentioned.has(c.display_name.toLowerCase()))
      .sort((a, b) => a.display_name.localeCompare(b.display_name));
  }, [suggestions, allCategories]);

  // Models filtered to selected provider
  const providerModels = useMemo(() => {
    if (!selectedProvider || !models) return [];
    return models.filter((m) => m.provider === selectedProvider);
  }, [selectedProvider, models]);

  // Whether the selected provider needs a model override
  const needsModelPicker = selectedProvider && selectedProvider !== catRoute?.provider;

  const handleGenerate = () => {
    setHasTriggered(true);
    const options: { provider?: string; model?: string } = {};
    if (selectedProvider) options.provider = selectedProvider;
    if (selectedModel) options.model = selectedModel;
    onSuggest(Object.keys(options).length > 0 ? options : undefined);
  };

  const handleClose = () => {
    setSelectedProvider(null);
    setSelectedModel(null);
    setHasTriggered(false);
    setShowComplete(false);
    if (completeTimer.current) clearTimeout(completeTimer.current);
    onOpenChange(false);
  };

  const handleRegroup = () => {
    onSuggest();
  };

  // --- Render phases ---

  const renderProviderPicker = () => (
    <Stack gap={4}>
      <Text fontSize="sm" color="fg.muted">
        Select which LLM provider to use for grouping suggestions.
      </Text>
      <Stack gap={1}>
        {providers?.map((p) => (
          <Flex
            key={p.provider}
            alignItems="center"
            gap={2}
            px={3}
            py={2}
            borderRadius="sm"
            cursor="pointer"
            bg={selectedProvider === p.provider ? "bg.subtle" : undefined}
            _hover={{ bg: "bg.subtle" }}
            onClick={() => {
              setSelectedProvider(p.provider);
              setSelectedModel(null);
            }}
          >
            <Text fontSize="sm" textTransform="capitalize">
              {p.provider}
            </Text>
            {p.provider === catRoute?.provider && (
              <Badge size="sm" colorPalette="accent">default</Badge>
            )}
          </Flex>
        ))}
      </Stack>

      {needsModelPicker && (
        <Stack gap={1}>
          <Text fontSize="sm" fontWeight="medium">Select model</Text>
          <Stack gap={1} maxH="160px" overflowY="auto">
            {providerModels.map((m) => (
              <Flex
                key={m.name}
                alignItems="center"
                gap={2}
                px={3}
                py={1.5}
                borderRadius="sm"
                cursor="pointer"
                bg={selectedModel === m.name ? "bg.subtle" : undefined}
                _hover={{ bg: "bg.subtle" }}
                onClick={() => setSelectedModel(m.name)}
              >
                <Text fontSize="sm">{m.name}</Text>
              </Flex>
            ))}
          </Stack>
        </Stack>
      )}
    </Stack>
  );

  const renderLoading = () => (
    <Flex direction="column" alignItems="center" justifyContent="center" py={8} gap={3}>
      <Spinner size="lg" colorPalette="accent" />
      <Text fontSize="sm" color="fg.muted">Analyzing categories...</Text>
    </Flex>
  );

  const renderComplete = () => (
    <Flex direction="column" alignItems="center" justifyContent="center" py={8} gap={3}>
      <Flex color="accent.fg" css={{ animation: `${scaleIn} 0.3s ease-out` }}>
        <LuCheck size={32} />
      </Flex>
      <Text fontSize="sm" color="fg.muted">Grouping complete</Text>
    </Flex>
  );

  const renderPreview = () => (
    <Stack gap={3}>
      <Text fontSize="sm" color="fg.muted">
        Review the suggested groupings before applying.
      </Text>
      <Stack gap={1} maxH="320px" overflowY="auto">
        {suggestions?.map((group) => (
          <Stack key={group.parent} gap={0}>
            <Flex alignItems="center" gap={2} px={3} py={2}>
              <LuFolder size={16} />
              <Text fontSize="sm" fontWeight="semibold" flex={1}>
                {group.parent}
              </Text>
              <Text fontSize="xs" color="fg.muted">
                {group.children.length}
              </Text>
            </Flex>
            <Stack gap={0} ml={6} pl={3} borderLeftWidth="1px" borderColor="border.subtle">
              {group.children.map((child) => (
                <Text key={child} fontSize="sm" px={3} py={1}>
                  {child}
                </Text>
              ))}
            </Stack>
          </Stack>
        ))}

        {ungroupedCategories.length > 0 && (
          <Stack gap={0}>
            <Flex
              alignItems="center"
              gap={2}
              px={3}
              py={2}
              borderTopWidth="1px"
              borderColor="border.subtle"
              mt={2}
              pt={2}
            >
              <Text fontSize="sm" fontWeight="semibold" color="fg.muted">
                Ungrouped
              </Text>
              <Text fontSize="xs" color="fg.muted">
                {ungroupedCategories.length}
              </Text>
            </Flex>
            {ungroupedCategories.map((cat) => (
              <Text key={cat.id} fontSize="sm" px={3} py={1}>
                {cat.display_name}
              </Text>
            ))}
          </Stack>
        )}
      </Stack>
    </Stack>
  );

  const renderEmpty = () => (
    <Flex direction="column" alignItems="center" justifyContent="center" py={8}>
      <Text fontSize="sm" color="fg.muted">
        No meaningful groupings found for the current categories.
      </Text>
    </Flex>
  );

  // Determine which phase to render — phases are mutually exclusive
  const showProviderPicker = multipleProviders && !hasTriggered;
  const showLoading = isSuggesting;
  const hasResults = !isSuggesting && suggestions !== null && suggestions.length > 0;
  const showPreview = hasResults && !showComplete;
  const showEmpty = !isSuggesting && suggestions !== null && suggestions.length === 0;

  return (
    <Dialog.Root
      open={open}
      placement="center"
      onOpenChange={(e) => {
        if (!e.open) handleClose();
      }}
    >
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content mx={4}>
          <Dialog.Header>
            <Dialog.Title>
              {showPreview ? "Suggested Groupings" : "Auto-Group Categories"}
            </Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            {showProviderPicker && renderProviderPicker()}
            {showLoading && renderLoading()}
            {showComplete && renderComplete()}
            {showPreview && renderPreview()}
            {showEmpty && !showLoading && renderEmpty()}
          </Dialog.Body>
          <Dialog.Footer>
            {showProviderPicker && (
              <>
                <Button
                  colorPalette="accent"
                  size="sm"
                  onClick={handleGenerate}
                  disabled={needsModelPicker ? !selectedModel : !selectedProvider}
                >
                  Generate
                </Button>
                <Dialog.ActionTrigger asChild>
                  <Button variant="surface" size="sm">Close</Button>
                </Dialog.ActionTrigger>
              </>
            )}
            {showPreview && (
              <>
                <Dialog.ActionTrigger asChild>
                  <Button colorPalette="red" variant="ghost" size="sm">Cancel</Button>
                </Dialog.ActionTrigger>
                <Button
                  variant="outline"
                  colorPalette="accent"
                  size="sm"
                  onClick={handleRegroup}
                  disabled={isApplying}
                >
                  Re-group
                </Button>
                <Button
                  colorPalette="accent"
                  size="sm"
                  onClick={() => onApply(suggestions!)}
                  loading={isApplying}
                >
                  Apply
                </Button>
              </>
            )}
            {!showProviderPicker && !showPreview && (
              <Dialog.ActionTrigger asChild>
                <Button variant="surface" size="sm">Close</Button>
              </Dialog.ActionTrigger>
            )}
          </Dialog.Footer>
          <Dialog.CloseTrigger />
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
