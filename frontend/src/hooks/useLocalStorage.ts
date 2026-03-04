"use client";

import { useState, useEffect, type SetStateAction } from "react";

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: SetStateAction<T>) => void] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  // Sync from localStorage after hydration to avoid SSR mismatch
  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item !== null) {
        setStoredValue(JSON.parse(item));
      }
    } catch {
      // Ignore read errors — keep initialValue
    }
  }, [key]);

  const setValue = (value: SetStateAction<T>) => {
    setStoredValue((prev) => {
      const newValue = value instanceof Function ? value(prev) : value;
      try {
        window.localStorage.setItem(key, JSON.stringify(newValue));
      } catch {
        // Ignore write errors (e.g., quota exceeded)
      }
      return newValue;
    });
  };

  return [storedValue, setValue];
}
