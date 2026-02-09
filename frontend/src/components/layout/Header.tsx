"use client"

import { Box, Flex, Heading } from "@chakra-ui/react"
import { ThemeToggle } from "@/components/ui/color-mode"

export function Header() {
  return (
    <Box
      as="header"
      position="fixed"
      top={0}
      left={0}
      right={0}
      height="64px"
      bg="bg.panel"
      borderBottomWidth="1px"
      borderBottomColor="border.subtle"
      zIndex={10}
    >
      <Flex
        height="100%"
        alignItems="center"
        justifyContent="space-between"
        px={6}
      >
        <Heading size="lg" fontWeight="semibold">
          RSS Reader
        </Heading>
        <ThemeToggle colorPalette="accent" />
      </Flex>
    </Box>
  )
}
