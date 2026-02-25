import type { SVGProps } from "react";

export function OpenAILogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="currentColor"
      {...props}
    >
      {/* TODO: Replace placeholder with actual brand SVG path data */}
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}
