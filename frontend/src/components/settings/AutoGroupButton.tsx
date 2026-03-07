"use client";

import { Button, Box } from "@chakra-ui/react";
import { LuSparkles } from "react-icons/lu";

const GRADIENT = "linear-gradient(to bottom right, {colors.pink.400}, {colors.accent.500})";
const GRADIENT_ID = "auto-group-grad";

interface AutoGroupButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export function AutoGroupButton({ onClick, disabled }: AutoGroupButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      width="100%"
      onClick={onClick}
      disabled={disabled}
      css={{
        border: "1px solid transparent",
        backgroundImage: `linear-gradient({colors.bg}, {colors.bg}), ${GRADIENT}`,
        backgroundOrigin: "border-box",
        backgroundClip: "padding-box, border-box",
        _hover: {
          backgroundImage: `linear-gradient({colors.bg.subtle}, {colors.bg.subtle}), ${GRADIENT}`,
        },
        _disabled: {
          opacity: 0.4,
        },
      }}
    >
      {/* SVG paint server for Lucide icon stroke gradient */}
      <svg width="0" height="0" aria-hidden style={{ position: "absolute" }}>
        <defs>
          <linearGradient id={GRADIENT_ID} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--chakra-colors-pink-400)" />
            <stop offset="100%" stopColor="var(--chakra-colors-accent-500)" />
          </linearGradient>
        </defs>
      </svg>
      <Box asChild css={{ "& path": { stroke: `url(#${GRADIENT_ID})` } }}>
        <LuSparkles size={16} />
      </Box>
      <Box
        as="span"
        css={{
          background: GRADIENT,
          backgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        Auto-Group
      </Box>
    </Button>
  );
}
