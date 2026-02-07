import { defineTokens, defineSemanticTokens } from "@chakra-ui/react"

export const colorTokens = defineTokens.colors({
  accent: {
    50: { value: "oklch(96% 0.04 41)" },
    100: { value: "oklch(92% 0.08 41)" },
    200: { value: "oklch(84% 0.12 41)" },
    300: { value: "oklch(76% 0.16 41)" },
    400: { value: "oklch(68% 0.19 41)" },
    500: { value: "oklch(64.6% 0.222 41.116)" }, // Primary orange
    600: { value: "oklch(58% 0.20 41)" },
    700: { value: "oklch(48% 0.17 41)" },
    800: { value: "oklch(38% 0.14 41)" },
    900: { value: "oklch(28% 0.10 41)" },
    950: { value: "oklch(18% 0.06 41)" },
  },
})

export const semanticTokens = defineSemanticTokens.colors({
  accent: {
    DEFAULT: {
      value: { _light: "{colors.accent.500}", _dark: "{colors.accent.500}" },
    },
    emphasized: {
      value: { _light: "{colors.accent.600}", _dark: "{colors.accent.400}" },
    },
    fg: {
      value: { _light: "white", _dark: "white" },
    },
    muted: {
      value: { _light: "{colors.accent.100}", _dark: "{colors.accent.950}" },
    },
    subtle: {
      value: { _light: "{colors.accent.50}", _dark: "{colors.accent.900}" },
    },
  },
})
