"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LuCheck } from "react-icons/lu";
import { useGoogleConfig, useGoogleModels } from "@/hooks/providers/google";
import { testGoogleKey } from "@/lib/providers/google";
import { toaster } from "@/components/ui/toaster";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { SettingsPanelHeading } from "@/components/settings/SettingsPanelHeading";
import { queryKeys } from "@/lib/queryKeys";
import type { ProviderPanelProps } from "../types";

const checkReveal = keyframes`
  0% { opacity: 0; transform: scale(0.5); }
  50% { opacity: 1; transform: scale(1.15); }
  100% { opacity: 1; transform: scale(1); }
`;

export function GoogleProviderPanel({
  onDisconnect,
  isNew,
  onCancelSetup,
}: ProviderPanelProps) {
  const queryClient = useQueryClient();
  const { config: serverConfig, saveMutation } = useGoogleConfig();
  const { models: availableModels, isLoading: modelsLoading } =
    useGoogleModels(!isNew && !!serverConfig?.api_key_set);

  const [localApiKey, setLocalApiKey] = useState("");
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [showCheck, setShowCheck] = useState(false);

  const testMutation = useMutation({
    mutationFn: () => testGoogleKey(localApiKey),
    meta: { handlesOwnErrors: true },
    onSuccess: (data) => {
      if (data.valid) {
        setShowCheck(true);
        toaster.create({ title: "API key is valid", type: "success" });
        setTimeout(() => setShowCheck(false), 2000);
      } else {
        toaster.create({
          title: "Invalid API key",
          description: data.error ?? "Key validation failed",
          type: "error",
        });
      }
    },
    onError: (error) => {
      toaster.create({
        title: "Key test failed",
        description: error instanceof Error ? error.message : "Unexpected error",
        type: "error",
      });
    },
  });

  const handleSave = () => {
    saveMutation.mutate(
      { api_key: localApiKey || undefined },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.providers.all });
          setLocalApiKey("");
          if (isNew) {
            toaster.create({
              title: "Google provider configured",
              type: "success",
            });
            onCancelSetup?.();
          } else {
            toaster.create({
              title: "API key updated",
              type: "success",
            });
          }
        },
      }
    );
  };

  const handleModelToggle = (modelName: string, checked: boolean) => {
    const current = serverConfig?.selected_models ?? [];
    const next = checked
      ? [...current, modelName]
      : current.filter((m) => m !== modelName);
    saveMutation.mutate({ selected_models: next });
  };

  const apiKeyEmpty = localApiKey.trim() === "";

  return (
    <SettingsPanel>
      <SettingsPanelHeading>API Key</SettingsPanelHeading>

      {!isNew && serverConfig?.api_key_set && (
        <Text fontSize="sm" color="fg.muted" mb={2}>
          Current key: {serverConfig.api_key_preview || "set"}
        </Text>
      )}

      <Input
        size="sm"
        type="password"
        value={localApiKey}
        onChange={(e) => setLocalApiKey(e.target.value)}
        placeholder={
          !isNew && serverConfig?.api_key_set
            ? "Enter new key to replace"
            : "Enter your Google API key"
        }
        mb={6}
      />

      {/* Model Selection — edit mode only */}
      {!isNew && serverConfig?.api_key_set && (
        <>
          <SettingsPanelHeading>Model Selection</SettingsPanelHeading>
          {modelsLoading ? (
            <Text fontSize="sm" color="fg.muted">
              Loading models...
            </Text>
          ) : availableModels && availableModels.length > 0 ? (
            <Stack gap={2} mb={6}>
              {availableModels.map((model) => {
                const isSelected = (
                  serverConfig.selected_models ?? []
                ).includes(model.name);
                return (
                  <Checkbox.Root
                    key={model.name}
                    checked={isSelected}
                    onCheckedChange={(details) =>
                      handleModelToggle(model.name, !!details.checked)
                    }
                  >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control />
                    <Checkbox.Label>
                      <Text fontSize="sm">{model.display_name}</Text>
                    </Checkbox.Label>
                  </Checkbox.Root>
                );
              })}
            </Stack>
          ) : (
            <Text fontSize="sm" color="fg.muted" mb={6}>
              No models available. Verify your API key has access to Gemini
              models.
            </Text>
          )}
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
              disabled={apiKeyEmpty}
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => testMutation.mutate()}
              loading={testMutation.isPending}
              disabled={apiKeyEmpty}
            >
              {showCheck ? (
                <Box
                  as="span"
                  color="green.400"
                  css={{ animation: `${checkReveal} 0.3s ease-out` }}
                >
                  <LuCheck />
                </Box>
              ) : (
                "Test Key"
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
              disabled={apiKeyEmpty}
            >
              {serverConfig?.api_key_set ? "Update Key" : "Save Key"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => testMutation.mutate()}
              loading={testMutation.isPending}
              disabled={apiKeyEmpty}
            >
              {showCheck ? (
                <Box
                  as="span"
                  color="green.400"
                  css={{ animation: `${checkReveal} 0.3s ease-out` }}
                >
                  <LuCheck />
                </Box>
              ) : (
                "Test Key"
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

      <ConfirmDialog
        open={showDisconnectDialog}
        onOpenChange={(d) => setShowDisconnectDialog(d.open)}
        title="Disconnect Google"
        body={
          <Text>
            Disconnecting will delete the provider configuration including your
            API key. You&apos;ll need to set it up again if you re-add it.
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
