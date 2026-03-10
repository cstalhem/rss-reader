"use client";

import { useState } from "react";
import {
  Box,
  Button,
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
import { GoogleModelManagement } from "./GoogleModelManagement";
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

  const apiKeyEmpty = localApiKey.trim() === "";

  return (
    <SettingsPanel>
      {/* Model Selection — edit mode only, shown first */}
      {!isNew && serverConfig?.api_key_set && (
        <>
          <SettingsPanelHeading>Model Selection</SettingsPanelHeading>
          <GoogleModelManagement
            availableModels={availableModels ?? []}
            selectedModelNames={serverConfig.selected_models ?? []}
            onSelect={(names) => saveMutation.mutate({ selected_models: names })}
            isLoading={modelsLoading}
          />
        </>
      )}

      {/* API Key section — at bottom, close to action buttons */}
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
      />

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
