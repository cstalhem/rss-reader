import { QueryClient, MutationCache } from "@tanstack/react-query";
import { toaster } from "@/components/ui/toaster";

import "@tanstack/react-query";

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      errorTitle?: string;
      handlesOwnErrors?: boolean;
    };
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds
      refetchOnWindowFocus: true,
    },
  },
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.options.meta?.handlesOwnErrors) return;

      const title = mutation.options.meta?.errorTitle ?? "Operation failed";
      toaster.create({
        title,
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
        type: "error",
      });
    },
  }),
});
