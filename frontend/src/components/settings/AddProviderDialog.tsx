"use client";

import { Badge, Box, Dialog, Grid, Text } from "@chakra-ui/react";
import { PROVIDER_REGISTRY } from "./providers/registry";

interface AddProviderDialogProps {
  open: boolean;
  onOpenChange: (details: { open: boolean }) => void;
  onAdd: (providerId: string) => void;
  existingProviders: string[];
}

export function AddProviderDialog({
  open,
  onOpenChange,
  onAdd,
  existingProviders,
}: AddProviderDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Add Provider</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <Grid
              templateColumns="repeat(auto-fill, minmax(180px, 1fr))"
              gap={3}
            >
              {PROVIDER_REGISTRY.map((plugin) => {
                const alreadyAdded = existingProviders.includes(plugin.id);
                const canAdd = plugin.available && !alreadyAdded;
                const isComingSoon = !plugin.available;

                return (
                  <Box
                    key={plugin.id}
                    position="relative"
                    borderWidth="1px"
                    borderColor="border.subtle"
                    borderRadius="md"
                    p={4}
                    cursor={canAdd ? "pointer" : "default"}
                    opacity={canAdd ? 1 : 0.5}
                    _hover={canAdd ? { borderColor: "border" } : undefined}
                    onClick={canAdd ? () => onAdd(plugin.id) : undefined}
                  >
                    {isComingSoon && (
                      <Badge
                        position="absolute"
                        top={2}
                        right={2}
                        size="sm"
                        variant="subtle"
                      >
                        Coming soon
                      </Badge>
                    )}
                    <Box color="fg.muted" mb={2}>
                      <plugin.Logo width="24" height="24" />
                    </Box>
                    <Text fontSize="sm" fontWeight="medium">
                      {plugin.label}
                    </Text>
                    <Text fontSize="xs" color="fg.muted">
                      {alreadyAdded ? "Already added" : plugin.hint}
                    </Text>
                  </Box>
                );
              })}
            </Grid>
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.CloseTrigger asChild>
              <Box as="button" cursor="pointer">
                <Text fontSize="sm" color="fg.muted">
                  Cancel
                </Text>
              </Box>
            </Dialog.CloseTrigger>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
