import { keyframes } from "@emotion/react";

/** Animated checkmark reveal used by provider Test buttons. */
export const checkReveal = keyframes`
  0% { opacity: 0; transform: scale(0.5); }
  50% { opacity: 1; transform: scale(1.15); }
  100% { opacity: 1; transform: scale(1); }
`;
