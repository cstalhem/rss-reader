import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/utils";
import { UnreadCountBadge } from "./unread-count-badge";

describe("UnreadCountBadge", () => {
  it("renders the unread count when it is positive", () => {
    renderWithProviders(<UnreadCountBadge count={3} />);

    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders nothing when the count is zero", () => {
    const { container } = renderWithProviders(<UnreadCountBadge count={0} />);

    expect(container).toBeEmptyDOMElement();
  });
});
