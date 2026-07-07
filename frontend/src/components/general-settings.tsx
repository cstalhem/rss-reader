"use client";

import { useState } from "react";
import { toast } from "sonner";

import { usePreferences } from "@/hooks/usePreferences";
import { useUpdatePreferences } from "@/hooks/useUpdatePreferences";
import type { Preferences } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const DWELL_MIN_SECONDS = 1;
const DWELL_MAX_SECONDS = 60;

/** Form body — keyed by `updated_at` at the call site so a successful save
 * (which bumps `updated_at` server-side) remounts it and resets the baseline. */
function GeneralForm({ initial }: { initial: Preferences }) {
  const [dwellSeconds, setDwellSeconds] = useState(
    String(initial.mark_read_dwell_seconds),
  );
  const updatePreferences = useUpdatePreferences();

  const isDirty = dwellSeconds !== String(initial.mark_read_dwell_seconds);

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        updatePreferences.mutate(
          { mark_read_dwell_seconds: Number(dwellSeconds) },
          { onSuccess: () => toast.success("Settings saved") },
        );
      }}
    >
      <Field>
        <FieldLabel htmlFor="mark-read-dwell">
          Mark-as-read delay (seconds)
        </FieldLabel>
        <Input
          id="mark-read-dwell"
          type="number"
          inputMode="numeric"
          min={DWELL_MIN_SECONDS}
          max={DWELL_MAX_SECONDS}
          className="w-24"
          value={dwellSeconds}
          onChange={(event) => setDwellSeconds(event.target.value)}
          disabled={updatePreferences.isPending}
        />
        <FieldDescription>
          How long an opened article stays visible before it&apos;s
          automatically marked read.
        </FieldDescription>
      </Field>
      <Button
        type="submit"
        className="h-11 self-end sm:h-9"
        disabled={!isDirty || updatePreferences.isPending}
      >
        {updatePreferences.isPending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}

/** The General settings section — app-wide behavior tuning (currently the mark-as-read dwell). */
export function GeneralSettings() {
  const { data, isPending, isError } = usePreferences();

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-lg font-semibold">General</h2>

      {isPending ? (
        <Skeleton className="h-20 w-full" />
      ) : isError ? (
        <p className="text-muted-foreground text-sm">
          Couldn&apos;t load your settings. Retrying…
        </p>
      ) : (
        <GeneralForm key={data.updated_at} initial={data} />
      )}
    </div>
  );
}
