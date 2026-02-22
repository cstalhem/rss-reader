"use client";

import { Box } from "@chakra-ui/react";
import DOMPurify from "isomorphic-dompurify";
import parse, {
  domToReact,
  Element,
  type HTMLReactParserOptions,
} from "html-react-parser";
import { READER_CONTENT_STYLES } from "@/theme/typography";

interface ArticleContentProps {
  html: string;
}

const parserOptions: HTMLReactParserOptions = {
  replace: (domNode) => {
    if (!(domNode instanceof Element)) return;

    if (domNode.name === "img") {
      const src = domNode.attribs.src;
      const alt = domNode.attribs.alt || "";
      return (
        <a href={src} target="_blank" rel="noopener noreferrer">
          <img
            src={src}
            alt={alt}
            loading="lazy"
            style={{
              maxWidth: "100%",
              height: "auto",
              borderRadius: "8px",
              marginTop: "1rem",
              marginBottom: "1rem",
            }}
          />
        </a>
      );
    }

    if (domNode.name === "a") {
      return (
        <a
          href={domNode.attribs.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          {domToReact(domNode.children as Parameters<typeof domToReact>[0], parserOptions)}
        </a>
      );
    }
  },
};

export function ArticleContent({ html }: ArticleContentProps) {
  const sanitized = DOMPurify.sanitize(html);

  return (
    <Box textStyle="reader" maxW="800px" mx="auto" css={READER_CONTENT_STYLES}>
      {parse(sanitized, parserOptions)}
    </Box>
  );
}
