import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders, userEvent } from "@/test/utils";
import { MobileArticleActionBar } from "./MobileArticleActionBar";

const defaultProps = {
  filter: "unread" as const,
  onFilterChange: vi.fn(),
  sortOption: "score_desc" as const,
  onSortChange: vi.fn(),
  onMarkAllRead: vi.fn(),
  canMarkAllRead: true,
  isMarkingRead: false,
  scoringCount: 0,
  blockedCount: 0,
  failedCount: 0,
};

describe("MobileArticleActionBar", () => {
  it("renders mark-all-read button when canMarkAllRead is true", () => {
    renderWithProviders(<MobileArticleActionBar {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: /mark all as read/i }),
    ).toBeInTheDocument();
  });

  it("hides mark-all-read button when canMarkAllRead is false", () => {
    renderWithProviders(
      <MobileArticleActionBar {...defaultProps} canMarkAllRead={false} />,
    );
    expect(
      screen.queryByRole("button", { name: /mark all as read/i }),
    ).not.toBeInTheDocument();
  });

  it("calls onMarkAllRead when mark-all-read button is clicked", async () => {
    const onMarkAllRead = vi.fn();
    renderWithProviders(
      <MobileArticleActionBar
        {...defaultProps}
        onMarkAllRead={onMarkAllRead}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /mark all as read/i }));
    expect(onMarkAllRead).toHaveBeenCalledOnce();
  });

  it("disables mark-all-read button when isMarkingRead is true", () => {
    renderWithProviders(
      <MobileArticleActionBar {...defaultProps} isMarkingRead={true} />,
    );
    expect(
      screen.getByRole("button", { name: /mark all as read/i }),
    ).toBeDisabled();
  });

  it("renders filter trigger showing current filter label", () => {
    renderWithProviders(
      <MobileArticleActionBar {...defaultProps} filter="scoring" />,
    );
    expect(screen.getByRole("button", { name: /scoring/i })).toBeInTheDocument();
  });

  it("renders sort trigger showing current sort label", () => {
    renderWithProviders(
      <MobileArticleActionBar {...defaultProps} sortOption="date_desc" />,
    );
    expect(
      screen.getByRole("button", { name: /newest/i }),
    ).toBeInTheDocument();
  });
});
