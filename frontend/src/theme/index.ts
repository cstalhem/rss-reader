import { createSystem, defaultConfig, defineRecipe } from "@chakra-ui/react"
import { colorTokens, semanticTokens } from "./colors"
import { fontTokens, textStyles } from "./typography"

const buttonRecipe = defineRecipe({
  base: {},
  variants: {
    size: {
      sm: {
        px: "4",  // was 3.5 in Chakra default
      },
      md: {
        px: "5",  // was 4 in Chakra default
      },
    },
  },
  defaultVariants: {
    colorPalette: "accent",
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
  },
})

export default system
