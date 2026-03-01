"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchTaskRoutes, saveTaskRoutes, triggerRescore } from "@/lib/api";
import type { TaskRoutesUpdate } from "@/lib/types";
import { queryKeys } from "@/lib/queryKeys";

export function useModelAssignments() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.taskRoutes.all,
    queryFn: fetchTaskRoutes,
  });

  const saveMutation = useMutation({
    mutationFn: (data: TaskRoutesUpdate) => saveTaskRoutes(data),
    meta: { errorTitle: "Failed to save model assignments" },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.taskRoutes.all });
    },
  });

  const rescoreMutation = useMutation({
    mutationFn: triggerRescore,
    meta: { errorTitle: "Failed to trigger rescore" },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scoringStatus.all });
    },
  });

  return {
    taskRoutes: query.data?.routes,
    useSeparateModels: query.data?.use_separate_models,
    isLoading: query.isLoading,
    saveMutation,
    rescoreMutation,
  };
}
