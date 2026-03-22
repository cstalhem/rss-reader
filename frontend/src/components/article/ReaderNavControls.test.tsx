import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders, userEvent } from "@/test/utils";
import { ReaderNavControls } from "./ReaderNavControls";

describe("ReaderNavControls", () => {
  it("calls the provided handlers", async () => {
    const onOpenOriginal = vi.fn();
    const onNavigatePrev = vi.fn();
    const onNavigateNext = vi.fn();
    const onClose = vi.fn();

    renderWithProviders(
      <ReaderNavControls
        onOpenOriginal={onOpenOriginal}
        onNavigatePrev={onNavigatePrev}
        onNavigateNext={onNavigateNext}
        onClose={onClose}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /open original/i }));
    await user.click(screen.getByRole("button", { name: /previous article/i }));
    await user.click(screen.getByRole("button", { name: /next article/i }));
    await user.click(screen.getByRole("button", { name: /close reader/i }));

    expect(onOpenOriginal).toHaveBeenCalledOnce();
    expect(onNavigatePrev).toHaveBeenCalledOnce();
    expect(onNavigateNext).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("disables buttons when handlers are missing", () => {
    renderWithProviders(<ReaderNavControls />);

    expect(screen.getByRole("button", { name: /open original/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /previous article/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /next article/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /close reader/i })).toBeDisabled();
  });
});
