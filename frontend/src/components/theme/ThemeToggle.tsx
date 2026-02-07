"use client"

import { IconButton } from "@chakra-ui/react"
import { useColorMode } from "@/components/ui/color-mode"
import { LuMoon, LuSun } from "react-icons/lu"

export function ThemeToggle() {
  const { colorMode, toggleColorMode } = useColorMode()

  return (
    <IconButton
      aria-label="Toggle theme"
      onClick={toggleColorMode}
      variant="ghost"
      colorPalette="accent"
      size="md"
    >
      {colorMode === "dark" ? <LuSun /> : <LuMoon />}
    </IconButton>
  )
}
