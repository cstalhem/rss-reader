"use client";

import { useEffect, useState, type SetStateAction } from "react";

/**
 * State backed by localStorage, SSR/hydration-safe.
 *
 * First paint always renders `initialValue` (so server and client agree); the
 * stored value is read and applied in an effect after mount. Never read
 * localStorage in a useState initializer — that causes a hydration mismatch.
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: SetStateAction<T>) => void] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  // Sync from localStorage after hydration to avoid SSR mismatch.
  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item !== null) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR hydration: must read localStorage in effect to avoid mismatch
        setStoredValue(JSON.parse(item) as T);
      }
    } catch {
      // Ignore read/parse errors — keep initialValue.
    }
  }, [key]);

  const setValue = (value: SetStateAction<T>) => {
    setStoredValue((prev) => {
      const newValue = value instanceof Function ? value(prev) : value;
      try {
        window.localStorage.setItem(key, JSON.stringify(newValue));
      } catch {
        // Ignore write errors (e.g. quota exceeded).
      }
      return newValue;
    });
  };

  return [storedValue, setValue];
}
