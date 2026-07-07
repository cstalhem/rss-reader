import { Button } from "@/components/ui/button";

interface LoadMoreButtonProps {
  isFetchingNextPage: boolean;
  onClick: () => void;
}

export function LoadMoreButton({
  isFetchingNextPage,
  onClick,
}: LoadMoreButtonProps) {
  return (
    <div className="p-4">
      <Button
        variant="ghost"
        className="w-full"
        disabled={isFetchingNextPage}
        onClick={onClick}
      >
        {isFetchingNextPage ? "Loading…" : "Load more"}
      </Button>
    </div>
  );
}
