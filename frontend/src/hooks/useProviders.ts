"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchProviders, disconnectProvider } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

export function useProviders() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.providers.all,
    queryFn: fetchProviders,
  });

  const disconnectMutation = useMutation({
    mutationFn: (provider: string) => disconnectProvider(provider),
    meta: { errorTitle: "Failed to disconnect provider" },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.providers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.taskRoutes.all });
    },
  });

  return {
    providers: query.data,
    isLoading: query.isLoading,
    disconnectMutation,
  };
}
