"use client";

import { useState } from "react";
import { Box, IconButton } from "@chakra-ui/react";
import { LuPencil } from "react-icons/lu";
import { useSwipeable } from "react-swipeable";

interface SwipeableRowProps {
  children: React.ReactNode;
  onEditReveal: () => void;
}

export function SwipeableRow({ children, onEditReveal }: SwipeableRowProps) {
  const [revealed, setRevealed] = useState(false);

  const handlers = useSwipeable({
    onSwipedLeft: () => setRevealed(true),
    onSwipedRight: () => setRevealed(false),
    trackMouse: false,
    preventScrollOnSwipe: true,
  });

  return (
    <Box
      {...handlers}
      overflow="hidden"
      position="relative"
      display={{ base: "block", md: "contents" }} // Only active on mobile
    >
      <Box
        transform={revealed ? "translateX(-50px)" : "translateX(0)"}
        transition="transform 0.2s ease-out"
      >
        {children}
      </Box>
      {revealed && (
        <IconButton
          aria-label="Edit"
          position="absolute"
          right={0}
          top="50%"
          transform="translateY(-50%)"
          size="sm"
          variant="ghost"
          colorPalette="accent"
          onClick={() => {
            onEditReveal();
            setRevealed(false);
          }}
        >
          <LuPencil size={16} />
        </IconButton>
      )}
    </Box>
  );
}
