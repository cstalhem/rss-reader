"use client";

import { useCallback, useState } from "react";
import {
  Box,
  Button,
  Flex,
  Grid,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useQueryClient } from "@tanstack/react-query";
import { useOllamaHealth } from "@/hooks/useOllamaHealth";
import { useOllamaModels } from "@/hooks/useOllamaModels";
import { useOllamaConfig } from "@/hooks/useOllamaConfig";
import { useModelPull } from "@/hooks/useModelPull";
import { toaster } from "@/components/ui/toaster";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { SettingsPanelHeading } from "@/components/settings/SettingsPanelHeading";
import { OllamaHealthBadge } from "@/components/settings/OllamaHealthBadge";
import { ModelManagement } from "@/components/settings/ModelManagement";
import { queryKeys } from "@/lib/queryKeys";
import type { OllamaConfig } from "@/lib/types";
import type { ProviderPanelProps } from "../types";

const DEFAULT_HOST = "localhost";
const DEFAULT_PORT = 11434;

export function OllamaProviderPanel({
  onDisconnect,
  isNew,
  onCancelSetup,
}: ProviderPanelProps) {
  const queryClient = useQueryClient();
  const { config: serverConfig, saveMutation } = useOllamaConfig();
  const { data: health, isLoading: healthLoading } = useOllamaHealth(!isNew);
  const isConnected = health?.connected ?? false;
  const { data: models } = useOllamaModels(!isNew && isConnected);
  const pullHook = useModelPull();

  // Local form state -- defaults for setup, server config for edit
  const [localHost, setLocalHost] = useState(
    isNew ? DEFAULT_HOST : (serverConfig?.base_url ?? DEFAULT_HOST)
  );
  const [localPort, setLocalPort] = useState(
    isNew ? DEFAULT_PORT : (serverConfig?.port ?? DEFAULT_PORT)
  );
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

  const isDirty =
    !isNew &&
    serverConfig &&
    (localHost !== serverConfig.base_url || localPort !== serverConfig.port);

  const handleSave = useCallback(() => {
    const configToSave: OllamaConfig = {
      base_url: localHost,
      port: localPort,
      categorization_model: serverConfig?.categorization_model ?? null,
      scoring_model: serverConfig?.scoring_model ?? null,
      use_separate_models: serverConfig?.use_separate_models ?? false,
    };

    saveMutation.mutate(configToSave, {
      onSuccess: () => {
        // Invalidate providers list so the pill becomes "real"
        queryClient.invalidateQueries({ queryKey: queryKeys.providers.all });
        // Invalidate health to check new connection
        queryClient.invalidateQueries({ queryKey: queryKeys.ollama.health });

        if (isNew) {
          toaster.create({
            title: "Ollama provider configured",
            type: "success",
          });
          // Clear pending state -- the provider is now in the server list
          onCancelSetup?.();
        } else {
          toaster.create({
            title: "Provider configuration saved",
            type: "success",
          });
        }
      },
    });
  }, [
    localHost,
    localPort,
    serverConfig,
    saveMutation.mutate,
    queryClient,
    isNew,
    onCancelSetup,
  ]);

  const handleConfigChange = useCallback((config: OllamaConfig) => {
    // Used by ModelManagement when deleting an active model
    setLocalHost(config.base_url);
    setLocalPort(config.port);
  }, []);

  const effectiveConfig: OllamaConfig | undefined = serverConfig
    ? {
        ...serverConfig,
        base_url: localHost,
        port: localPort,
      }
    : undefined;

  return (
    <SettingsPanel>
      {/* Connection section */}
      <SettingsPanelHeading>Connection</SettingsPanelHeading>

      {!isNew && (
        <Box mb={4}>
          <OllamaHealthBadge health={health} isLoading={healthLoading} />
        </Box>
      )}
      {isNew && (
        <Text fontSize="sm" color="fg.muted" mb={4}>
          Not connected -- save to test connection
        </Text>
      )}

      <Grid templateColumns="1fr auto" gap={3} mb={6}>
        <Box>
          <Text fontSize="xs" color="fg.muted" mb={1}>
            Host
          </Text>
          <Input
            size="sm"
            value={localHost}
            onChange={(e) => setLocalHost(e.target.value)}
            placeholder="localhost"
          />
        </Box>
        <Box>
          <Text fontSize="xs" color="fg.muted" mb={1}>
            Port
          </Text>
          <Input
            size="sm"
            value={localPort}
            onChange={(e) => setLocalPort(Number(e.target.value) || 0)}
            placeholder="11434"
            width="100px"
          />
        </Box>
      </Grid>

      {/* Model Library section -- edit mode only */}
      {!isNew && (
        <>
          <SettingsPanelHeading>Model Library</SettingsPanelHeading>
          <ModelManagement
            models={models ?? []}
            config={effectiveConfig}
            pullHook={pullHook}
            onConfigChange={handleConfigChange}
          />
        </>
      )}

      {/* Action buttons */}
      <Stack direction="row" gap={3} mt={6}>
        {isNew ? (
          <>
            <Button
              size="sm"
              colorPalette="accent"
              onClick={handleSave}
              loading={saveMutation.isPending}
            >
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancelSetup}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              colorPalette="accent"
              onClick={handleSave}
              loading={saveMutation.isPending}
              disabled={!isDirty}
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="subtle"
              colorPalette="red"
              onClick={() => setShowDisconnectDialog(true)}
            >
              Disconnect
            </Button>
          </>
        )}
      </Stack>

      {/* Disconnect confirmation */}
      <ConfirmDialog
        open={showDisconnectDialog}
        onOpenChange={(d) => setShowDisconnectDialog(d.open)}
        title="Disconnect Ollama"
        body={
          <Text>
            Disconnecting will delete the provider configuration and remove any
            model assignments using Ollama. You'll need to set it up again if
            you re-add it.
          </Text>
        }
        confirmLabel="Disconnect"
        confirmColorPalette="red"
        onConfirm={() => {
          setShowDisconnectDialog(false);
          onDisconnect();
        }}
      />
    </SettingsPanel>
  );
}
