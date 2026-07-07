import { MutationCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      /** Title shown by the global error toast. */
      errorTitle?: string;
      /** When true, the global error handler skips this mutation (it shows its own error). */
      handlesOwnErrors?: boolean;
    };
  }
}

/**
 * Singleton QueryClient for the app. Tests must NOT import this — they build a
 * fresh client per test (see `@/test/utils`).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds
      gcTime: 2 * 60 * 1000, // 2 minutes — bounds stale cache accumulation
      refetchOnWindowFocus: true,
    },
  },
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.options.meta?.handlesOwnErrors) return;

      const title = mutation.options.meta?.errorTitle ?? "Operation failed";
      toast.error(title, {
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      });
    },
  }),
});
