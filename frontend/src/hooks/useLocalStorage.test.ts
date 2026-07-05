import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@/test/utils";
import { useLocalStorage } from "@/hooks/useLocalStorage";

// jsdom in this project doesn't expose window.localStorage; provide an
// in-memory stub per-file (mirrors the per-file matchMedia stub pattern).
beforeAll(() => {
  const store = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    },
  });
});

interface Stored {
  type: "keep";
  id: number;
}

function isStored(value: unknown): value is Stored {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "keep" &&
    typeof (value as { id?: unknown }).id === "number"
  );
}

const KEY = "test:useLocalStorage";
const INITIAL: Stored = { type: "keep", id: 0 };

afterEach(() => window.localStorage.clear());

describe("useLocalStorage", () => {
  it("hydrates a valid stored value after mount", async () => {
    const value: Stored = { type: "keep", id: 42 };
    window.localStorage.setItem(KEY, JSON.stringify(value));

    const { result } = renderHook(() =>
      useLocalStorage<Stored>(KEY, INITIAL, isStored),
    );

    await waitFor(() => expect(result.current[0]).toEqual(value));
  });

  it("hydrates wrong-shape JSON when no validator is supplied", async () => {
    // Contrast baseline: without a validator, any parsed value is accepted.
    const bogus = { type: "bogus" } as unknown as Stored;
    window.localStorage.setItem(KEY, JSON.stringify(bogus));

    const { result } = renderHook(() => useLocalStorage<Stored>(KEY, INITIAL));

    await waitFor(() => expect(result.current[0]).toEqual(bogus));
  });

  it("falls back to initialValue when stored JSON fails the validator", async () => {
    window.localStorage.setItem(KEY, JSON.stringify({ type: "bogus" }));

    const { result } = renderHook(() =>
      useLocalStorage<Stored>(KEY, INITIAL, isStored),
    );

    // The mount effect runs but the validator rejects the wrong-shape value,
    // so initialValue is retained. Contrast with the no-validator case above,
    // which does hydrate the same bogus value.
    await waitFor(() => expect(result.current[0]).toEqual(INITIAL));
  });
});
