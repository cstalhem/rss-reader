"use client"

import { ChakraProvider } from "@chakra-ui/react"
import {
  ColorModeProvider,
  type ColorModeProviderProps,
} from "./color-mode"
import { system } from "@/theme"
import { Toaster } from "./toaster"
import { EmotionRegistry } from "./emotion-registry"

export function Provider(props: ColorModeProviderProps) {
  return (
    <EmotionRegistry>
      <ChakraProvider value={system}>
        <ColorModeProvider {...props} />
        <Toaster />
      </ChakraProvider>
    </EmotionRegistry>
  )
}
