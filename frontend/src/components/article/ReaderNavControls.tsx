"use client";

import type { MouseEventHandler } from "react";
import { Flex, IconButton } from "@chakra-ui/react";
import { LuChevronDown, LuChevronUp, LuExternalLink, LuX } from "react-icons/lu";

interface ReaderNavControlsProps {
  gap?: number | string;
  onClose?: MouseEventHandler<HTMLButtonElement> | null;
  onNavigateNext?: MouseEventHandler<HTMLButtonElement> | null;
  onNavigatePrev?: MouseEventHandler<HTMLButtonElement> | null;
  onOpenOriginal?: MouseEventHandler<HTMLButtonElement> | null;
}

export function ReaderNavControls({
  gap = 1,
  onClose,
  onNavigateNext,
  onNavigatePrev,
  onOpenOriginal,
}: ReaderNavControlsProps) {
  return (
    <Flex flexShrink={0} alignItems="center" gap={gap}>
      <IconButton
        aria-label="Open original"
        title="Open original"
        size="sm"
        variant="ghost"
        disabled={!onOpenOriginal}
        onClick={onOpenOriginal ?? undefined}
      >
        <LuExternalLink />
      </IconButton>
      <IconButton
        aria-label="Previous article"
        title="Previous article"
        size="sm"
        variant="ghost"
        disabled={!onNavigatePrev}
        onClick={onNavigatePrev ?? undefined}
      >
        <LuChevronUp />
      </IconButton>
      <IconButton
        aria-label="Next article"
        title="Next article"
        size="sm"
        variant="ghost"
        disabled={!onNavigateNext}
        onClick={onNavigateNext ?? undefined}
      >
        <LuChevronDown />
      </IconButton>
      <IconButton
        aria-label="Close reader"
        title="Close reader"
        size="sm"
        variant="ghost"
        disabled={!onClose}
        onClick={onClose ?? undefined}
      >
        <LuX />
      </IconButton>
    </Flex>
  );
}
