import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CategoryChip } from "@/components/article-badges";

describe("CategoryChip", () => {
  it("shows a leading dot when the category needs triage", () => {
    render(<CategoryChip label="Machine Learning" needsTriage />);
    const chip = screen.getByText("Machine Learning").closest("span");
    expect(chip?.querySelector("[aria-hidden]")).toBeInTheDocument();
  });

  it("renders no dot for an established category", () => {
    render(<CategoryChip label="Machine Learning" needsTriage={false} />);
    const chip = screen.getByText("Machine Learning").closest("span");
    expect(chip?.querySelector("[aria-hidden]")).not.toBeInTheDocument();
  });
});
