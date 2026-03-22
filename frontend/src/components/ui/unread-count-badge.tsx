"use client";

import { Badge } from "@chakra-ui/react";

interface UnreadCountBadgeProps {
  count: number;
}

export function UnreadCountBadge({ count }: UnreadCountBadgeProps) {
  if (count <= 0) return null;

  return (
    <Badge colorPalette="accent" variant="solid" size="sm">
      {count}
    </Badge>
  );
}
