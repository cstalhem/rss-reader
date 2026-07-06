import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./mocks/server";

// jsdom doesn't implement the Pointer Capture API or scrollIntoView, which
// pointer-driven libraries (sonner toasts, Radix/cmdk) call on interaction —
// unpolyfilled they throw unhandled errors that fail the run. Global because
// any pointer-interactive component hits them, not a specific test.
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// MSW lifecycle. `onUnhandledRequest: "error"` surfaces any request that isn't
// backed by a handler, so missing mocks fail loudly instead of hitting the network.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());
