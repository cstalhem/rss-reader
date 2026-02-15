"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchOllamaConfig, saveOllamaConfig } from "@/lib/api";
import type { OllamaConfig } from "@/lib/types";

export function useOllamaConfig() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["ollama-config"],
    queryFn: fetchOllamaConfig,
    staleTime: 30_000,
  });

  const saveMutation = useMutation({
    mutationFn: (data: OllamaConfig & { rescore: boolean }) =>
      saveOllamaConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ollama-config"] });
      queryClient.invalidateQueries({ queryKey: ["ollama-models"] });
      queryClient.invalidateQueries({ queryKey: ["scoring-status"] });
    },
  });

  return {
    config: query.data,
    savedConfig: query.data,
    isLoading: query.isLoading,
    saveMutation,
  };
}
