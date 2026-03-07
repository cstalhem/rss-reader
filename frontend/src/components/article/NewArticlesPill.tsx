"use client";

import { Box, Button } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";

const rollIn = keyframes`
  from { transform: translateY(100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
`;

interface NewArticlesPillProps {
  count: number;
  onFlush: () => void;
}

export function NewArticlesPill({ count, onFlush }: NewArticlesPillProps) {
  const label = count === 1 ? "1 new article" : `${count} new articles`;

  return (
    <Box position="sticky" top="12" height="0" zIndex={4}>
      <Box
        display="flex"
        justifyContent="center"
        pt={2}
        animationName="slide-from-top, fade-in"
        animationDuration="moderate"
      >
        <Button
          size="xs"
          variant="subtle"
          colorPalette="accent"
          rounded="full"
          onClick={onFlush}
        >
          <Box
            as="span"
            display="inline-flex"
            overflow="hidden"
            verticalAlign="bottom"
          >
            <Box
              as="span"
              key={count}
              css={{ animation: `${rollIn} 0.3s ease-out` }}
            >
              {label}
            </Box>
          </Box>
        </Button>
      </Box>
    </Box>
  );
}
