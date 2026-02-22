"use client";

import { EmptyState, VStack } from "@chakra-ui/react";
import { LuMessageSquare } from "react-icons/lu";

export function FeedbackPlaceholder() {
  return (
    <EmptyState.Root>
      <EmptyState.Content>
        <EmptyState.Indicator>
          <LuMessageSquare size={40} />
        </EmptyState.Indicator>
        <VStack textAlign="center">
          <EmptyState.Title>Feedback Loop</EmptyState.Title>
          <EmptyState.Description>
            Coming soon -- your feedback will help improve article scoring over
            time.
          </EmptyState.Description>
        </VStack>
      </EmptyState.Content>
    </EmptyState.Root>
  );
}
