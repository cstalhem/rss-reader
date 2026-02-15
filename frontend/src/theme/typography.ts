import { defineTokens, defineTextStyles } from "@chakra-ui/react"

// Font tokens - CSS variables will be set in layout.tsx via next/font/google
export const fontTokens = defineTokens.fonts({
  sans: { value: "var(--font-sans), system-ui, sans-serif" },
  serif: { value: "var(--font-serif), Georgia, serif" },
  mono: { value: "var(--font-mono), 'Fira Code', monospace" },
})

// Text style overrides for Chakra components
export const textStyles = defineTextStyles({
  body: {
    value: {
      fontFamily: "sans",
      fontWeight: "400",
      lineHeight: "1.6",
    },
  },
  heading: {
    value: {
      fontFamily: "sans",
      fontWeight: "600",
      lineHeight: "1.2",
    },
  },
  // Reader content uses serif
  reader: {
    value: {
      fontFamily: "serif",
      fontSize: "1.125rem",
      lineHeight: "1.75",
    },
  },
})
