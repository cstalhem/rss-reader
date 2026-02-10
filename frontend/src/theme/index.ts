import { createSystem, defaultConfig, defineRecipe } from "@chakra-ui/react"
import { colorTokens, semanticTokens } from "./colors"
import { fontTokens, textStyles } from "./typography"

const buttonRecipe = defineRecipe({
  variants: {
    size: {
      sm: {
        px: "4",
      },
      md: {
        px: "5",
      },
    },
  },
})

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
    recipes: {
      button: buttonRecipe,
    },
  },
  globalCss: {
    "html, body": {
      colorScheme: "dark",
      maxWidth: "100vw",
      overflowX: "hidden",
    },
    a: {
      color: "{colors.accent.500}",
      _hover: {
        color: "{colors.accent.400}",
      },
    },
  },
})

export default system
