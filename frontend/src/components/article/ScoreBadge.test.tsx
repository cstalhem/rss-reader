import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/utils";
import { ScoreBadge } from "./ScoreBadge";

describe("ScoreBadge", () => {
  it("renders nothing when scoring_state is not scored", () => {
    const { container } = renderWithProviders(
      <ScoreBadge score={9.5} scoringState="pending" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when score is null", () => {
    const { container } = renderWithProviders(
      <ScoreBadge score={null} scoringState="scored" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the formatted score with aria-label", () => {
    renderWithProviders(
      <ScoreBadge score={9.5} scoringState="scored" />
    );
    expect(screen.getByText("9.5")).toBeInTheDocument();
    expect(screen.getByLabelText("Score: 9.5")).toBeInTheDocument();
  });
});
