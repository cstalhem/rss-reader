import * as React from "react";

const MOBILE_BREAKPOINT = 768;

// Lazily created so this module stays SSR-safe (no `window` access at import time).
let mql: MediaQueryList | undefined;

function getMql() {
  if (!mql) {
    mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  }
  return mql;
}

function subscribe(callback: () => void) {
  const mediaQueryList = getMql();
  mediaQueryList.addEventListener("change", callback);
  return () => mediaQueryList.removeEventListener("change", callback);
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => getMql().matches,
    () => false,
  );
}
