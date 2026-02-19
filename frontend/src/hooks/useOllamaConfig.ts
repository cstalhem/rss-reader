"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchOllamaConfig, saveOllamaConfig } from "@/lib/api";
import type { OllamaConfig } from "@/lib/types";
import { queryKeys } from "@/lib/queryKeys";

export function useOllamaConfig() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.ollama.config,
    queryFn: fetchOllamaConfig,
    staleTime: 30_000,
  });

  const saveMutation = useMutation({
    mutationFn: (data: OllamaConfig & { rescore: boolean }) =>
      saveOllamaConfig(data),
    meta: { errorTitle: "Failed to save Ollama config" },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ollama.config });
      queryClient.invalidateQueries({ queryKey: queryKeys.ollama.models });
      queryClient.invalidateQueries({ queryKey: queryKeys.scoringStatus.all });
    },
  });

  return {
    config: query.data,
    isLoading: query.isLoading,
    saveMutation,
  };
}
