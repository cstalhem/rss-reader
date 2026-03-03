import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ChakraProvider } from "@chakra-ui/react";
import {
  render,
  renderHook,
  screen,
  waitFor,
  within,
  act,
  type RenderOptions,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { system } from "@/theme";
import { useState, type ReactElement, type ReactNode } from "react";

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

function AllProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createTestQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <ChakraProvider value={system}>{children}</ChakraProvider>
    </QueryClientProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

export function createWrapper() {
  const queryClient = createTestQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ChakraProvider value={system}>{children}</ChakraProvider>
      </QueryClientProvider>
    );
  };
}

export { render, renderHook, screen, waitFor, within, act };
export { userEvent };
