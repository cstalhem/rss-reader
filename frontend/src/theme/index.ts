import { createSystem, defaultConfig } from "@chakra-ui/react"
import { colorTokens, semanticTokens } from "./colors"
import { fontTokens, textStyles } from "./typography"

export const system = createSystem(defaultConfig, {
  theme: {
    tokens: {
      colors: colorTokens,
      fonts: fontTokens,
    },
    semanticTokens: {
      colors: semanticTokens,
    },
    textStyles,
  },
  globalCss: {
    "html, body": {
      colorScheme: "dark",
      maxWidth: "100vw",
      overflowX: "hidden",
    },
  },
})

export default system
