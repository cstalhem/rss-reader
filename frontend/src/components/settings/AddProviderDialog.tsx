"use client";

import { Badge, Box, Button, Dialog, Grid, Text } from "@chakra-ui/react";
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
              templateColumns={{ base: "1fr", sm: "repeat(2, 1fr)" }}
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
                    display="flex"
                    alignItems="center"
                    borderWidth={alreadyAdded ? "1.5px" : "1px"}
                    borderColor={alreadyAdded ? "orange.500" : "border.subtle"}
                    borderRadius="md"
                    p={4}
                    cursor={canAdd ? "pointer" : "default"}
                    opacity={canAdd || alreadyAdded ? 1 : 0.5}
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
                    {alreadyAdded && (
                      <Badge
                        position="absolute"
                        top={2}
                        right={2}
                        size="sm"
                        variant="subtle"
                        colorPalette="orange"
                      >
                        ✓ Configured
                      </Badge>
                    )}
                    <Box
                      color="fg.default"
                      flexShrink={0}
                      mr={4}
                    >
                      <plugin.Logo width="24" height="24" />
                    </Box>
                    <Box>
                      <Text fontSize="md" fontWeight="medium" color="fg.default">
                        {plugin.label}
                      </Text>
                      <Text fontSize="xs" color="fg.muted">
                        {alreadyAdded ? "Already added" : plugin.hint}
                      </Text>
                    </Box>
                  </Box>
                );
              })}
            </Grid>
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.ActionTrigger asChild>
              <Button variant="ghost">Cancel</Button>
            </Dialog.ActionTrigger>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
