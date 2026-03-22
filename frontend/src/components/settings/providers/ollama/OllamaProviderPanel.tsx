"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Grid,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LuCheck } from "react-icons/lu";
import {
  useOllamaHealth,
  useOllamaModels,
  useOllamaConfig,
  useOllamaModelPull,
} from "@/hooks/providers/ollama";
import { testOllamaConnection } from "@/lib/providers/ollama";
import { toaster } from "@/components/ui/toaster";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { SettingsPanelHeading } from "@/components/settings/SettingsPanelHeading";
import { OllamaHealthBadge } from "@/components/settings/OllamaHealthBadge";
import { ModelManagement } from "@/components/settings/ModelManagement";
import { queryKeys } from "@/lib/queryKeys";
import type { OllamaConfig } from "@/lib/types";
import type { ProviderPanelProps } from "../types";
import { checkReveal } from "../shared";

const DEFAULT_HOST = "http://localhost";
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
  const pullHook = useOllamaModelPull();

  // Local form state -- defaults for setup, server config for edit
  const [localHost, setLocalHost] = useState(
    isNew ? DEFAULT_HOST : (serverConfig?.base_url ?? DEFAULT_HOST)
  );
  const [localPort, setLocalPort] = useState(
    isNew ? DEFAULT_PORT : (serverConfig?.port ?? DEFAULT_PORT)
  );
  const [localBatchSize, setLocalBatchSize] = useState(
    isNew ? 1 : (serverConfig?.batch_size ?? 1)
  );
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [showCheck, setShowCheck] = useState(false);
  const [prevServerConfig, setPrevServerConfig] = useState(serverConfig);

  // Sync local form state when server config loads (replaces useEffect)
  if (serverConfig !== prevServerConfig) {
    setPrevServerConfig(serverConfig);
    if (!isNew && serverConfig) {
      setLocalHost(serverConfig.base_url);
      setLocalPort(serverConfig.port);
      setLocalBatchSize(serverConfig.batch_size);
    }
  }

  const testMutation = useMutation({
    mutationFn: () => testOllamaConnection(localHost, localPort),
    meta: { handlesOwnErrors: true },
    onSuccess: (data) => {
      if (data.connected) {
        setShowCheck(true);
        toaster.create({
          title: `Connection successful (v${data.version}, ${data.latency_ms}ms)`,
          type: "success",
        });
        setTimeout(() => setShowCheck(false), 2000);
      } else {
        toaster.create({
          title: "Connection failed",
          description: `Could not reach Ollama at ${localHost}:${localPort}`,
          type: "error",
        });
      }
    },
    onError: (error) => {
      toaster.create({
        title: "Connection test failed",
        description: error instanceof Error ? error.message : "Unexpected error",
        type: "error",
      });
    },
  });

  const hostEmpty = localHost.trim() === "";
  const hostError =
    !hostEmpty &&
    !localHost.startsWith("http://") &&
    !localHost.startsWith("https://")
      ? "URL must start with http:// or https://"
      : null;

  const isDirty =
    !isNew &&
    serverConfig &&
    (localHost !== serverConfig.base_url ||
      localPort !== serverConfig.port ||
      localBatchSize !== serverConfig.batch_size);

  const handleSave = () => {
    const configToSave: OllamaConfig = {
      base_url: localHost,
      port: localPort,
      categorization_model: serverConfig?.categorization_model ?? null,
      scoring_model: serverConfig?.scoring_model ?? null,
      use_separate_models: serverConfig?.use_separate_models ?? false,
      batch_size: localBatchSize,
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
  };

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
          Not connected -- use &ldquo;Test Connection&rdquo; or save to connect
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
            placeholder="http://localhost"
          />
          {hostError && (
            <Text fontSize="xs" color="fg.error" mt={1}>
              {hostError}
            </Text>
          )}
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
            pullHook={pullHook}
          />
        </>
      )}

      {/* Scoring batch size */}
      {!isNew && (
        <Box mt={6}>
          <SettingsPanelHeading>Scoring</SettingsPanelHeading>
          <Box>
            <Text fontSize="xs" color="fg.muted" mb={1}>
              Batch size
            </Text>
            <Input
              size="sm"
              type="number"
              value={localBatchSize}
              onChange={(e) => {
                const v = Math.max(1, Math.min(10, Number(e.target.value) || 1));
                setLocalBatchSize(v);
              }}
              width="80px"
              min={1}
              max={10}
            />
            <Text fontSize="xs" color="fg.muted" mt={1}>
              Articles scored per cycle. Local models are slower — keep this low.
            </Text>
          </Box>
        </Box>
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
              disabled={hostEmpty || !!hostError}
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => testMutation.mutate()}
              loading={testMutation.isPending}
              disabled={hostEmpty || !!hostError}
            >
              {showCheck ? (
                <Box as="span" color="green.400" css={{ animation: `${checkReveal} 0.3s ease-out` }}>
                  <LuCheck />
                </Box>
              ) : (
                "Test Connection"
              )}
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
              disabled={!isDirty || hostEmpty || !!hostError}
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => testMutation.mutate()}
              loading={testMutation.isPending}
              disabled={hostEmpty || !!hostError}
            >
              {showCheck ? (
                <Box as="span" color="green.400" css={{ animation: `${checkReveal} 0.3s ease-out` }}>
                  <LuCheck />
                </Box>
              ) : (
                "Test Connection"
              )}
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
            model assignments using Ollama. You&apos;ll need to set it up again if
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
