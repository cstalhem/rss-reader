"use client";

import { Box, Flex, Switch } from "@chakra-ui/react";
import { LuMoon, LuSun } from "react-icons/lu";

interface ThemeModeSwitchProps {
  checked?: boolean;
  disabled?: boolean;
  showIcons?: boolean;
  opacity?: number | string;
  ariaLabel?: string;
}

export function ThemeModeSwitch({
  checked = true,
  disabled = true,
  showIcons = true,
  opacity = 0.65,
  ariaLabel = "Theme toggle",
}: ThemeModeSwitchProps) {
  return (
    <Flex alignItems="center" gap={2} opacity={opacity}>
      {showIcons && (
        <Box color="fg.muted" display="inline-flex">
          <LuSun size={16} />
        </Box>
      )}
      <Switch.Root
        checked={checked}
        disabled={disabled}
        size="sm"
        colorPalette="accent"
        aria-label={ariaLabel}
      >
        <Switch.HiddenInput />
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
      </Switch.Root>
      {showIcons && (
        <Box color="fg.muted" display="inline-flex">
          <LuMoon size={16} />
        </Box>
      )}
    </Flex>
  );
}
