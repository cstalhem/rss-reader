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

/** CSS-in-JS styles for reader article content. Apply via Chakra `css` prop. */
export const READER_CONTENT_STYLES = {
  "& img": {
    maxWidth: "100%",
    height: "auto",
    maxHeight: "600px",
    objectFit: "contain" as const,
    borderRadius: "md",
    my: 4,
  },
  "& a": {
    textDecoration: "underline",
  },
  "& h1, & h2, & h3, & h4, & h5, & h6": {
    fontWeight: "600",
    mt: 6,
    mb: 3,
    lineHeight: "1.3",
  },
  "& h1": { fontSize: "2xl" },
  "& h2": { fontSize: "xl" },
  "& h3": { fontSize: "lg" },
  "& p": {
    mb: 5,
    lineHeight: "1.85",
  },
  "& ul, & ol": {
    pl: 6,
    mb: 4,
  },
  "& li": {
    mb: 2,
  },
  "& blockquote": {
    borderLeftWidth: "4px",
    borderColor: "border.emphasized",
    pl: 4,
    py: 2,
    my: 4,
    fontStyle: "italic",
    color: "fg.muted",
  },
  "& pre": {
    bg: "bg.code",
    p: 5,
    borderRadius: "lg",
    overflowX: "auto",
    my: 5,
    borderWidth: "1px",
    borderColor: "border.subtle",
  },
  "& code": {
    fontFamily: "mono",
    fontSize: "0.875em",
    lineHeight: "1.6",
  },
  "& pre code": {
    bg: "transparent",
    p: 0,
  },
  "& :not(pre) > code": {
    bg: "bg.emphasized",
    px: 1.5,
    py: 0.5,
    borderRadius: "sm",
    fontSize: "0.875em",
  },
}
