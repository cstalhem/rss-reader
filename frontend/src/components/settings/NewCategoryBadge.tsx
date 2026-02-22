"use client";

import { Badge, Box, Flex } from "@chakra-ui/react";
import { LuX } from "react-icons/lu";

interface NewCategoryBadgeProps {
  isHovered: boolean;
  onDismiss: () => void;
}

export function NewCategoryBadge({ isHovered, onDismiss }: NewCategoryBadgeProps) {
  return (
    <Badge
      colorPalette="accent"
      size="sm"
      cursor="pointer"
      onClick={(e) => {
        e.stopPropagation();
        onDismiss();
      }}
    >
      <Flex alignItems="center" gap={0}>
        <Box
          display="flex"
          alignItems="center"
          maxW={{ base: "20px", md: isHovered ? "20px" : "0" }}
          overflow="hidden"
          transition="max-width 0.15s, padding 0.15s"
          pr={isHovered ? 1 : 0}
        >
          <LuX size={14} />
        </Box>
        New
      </Flex>
    </Badge>
  );
}
