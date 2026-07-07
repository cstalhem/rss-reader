import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ReadFilterToggle } from "@/components/read-filter-toggle";

describe("ReadFilterToggle", () => {
  it("renders both segments with the matching value pressed", () => {
    render(<ReadFilterToggle value="unread" onChange={vi.fn()} />);

    expect(screen.getByRole("radio", { name: "Unread" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: "Read" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("calls onChange with the other filter when the inactive segment is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ReadFilterToggle value="unread" onChange={onChange} />);

    await user.click(screen.getByRole("radio", { name: "Read" }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith("read");
  });

  it("does not call onChange when re-clicking the active segment", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ReadFilterToggle value="unread" onChange={onChange} />);

    await user.click(screen.getByRole("radio", { name: "Unread" }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
