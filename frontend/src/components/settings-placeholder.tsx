/** Shared "coming soon" body for settings sections not yet built out. */
export function SettingsPlaceholder({
  title,
  blurb,
}: {
  title: string;
  blurb: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="border-border/60 bg-muted/20 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-16 text-center">
        <span className="text-muted-foreground text-sm font-medium">
          Coming soon
        </span>
        <span className="text-muted-foreground max-w-sm text-sm">{blurb}</span>
      </div>
    </div>
  );
}
