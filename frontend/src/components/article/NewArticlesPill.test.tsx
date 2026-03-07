import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/utils";
import { NewArticlesPill } from "./NewArticlesPill";

describe("NewArticlesPill", () => {
  it("renders plural count text for count > 1", () => {
    renderWithProviders(<NewArticlesPill count={3} onFlush={vi.fn()} />);
    expect(screen.getByText(/3 new articles/)).toBeInTheDocument();
  });

  it("renders singular form for count of 1", () => {
    renderWithProviders(<NewArticlesPill count={1} onFlush={vi.fn()} />);
    expect(screen.getByText(/1 new article(?!s)/)).toBeInTheDocument();
  });

  it("calls onFlush when clicked", async () => {
    const onFlush = vi.fn();
    renderWithProviders(<NewArticlesPill count={5} onFlush={onFlush} />);

    await userEvent.click(screen.getByRole("button"));

    expect(onFlush).toHaveBeenCalledOnce();
  });
});
