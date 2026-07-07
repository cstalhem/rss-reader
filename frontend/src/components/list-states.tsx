interface ErrorStateProps {
  message: string;
}

export function ErrorState({ message }: ErrorStateProps) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}
