"use client";

import { useState } from "react";
import { toast } from "sonner";

import { usePreferences } from "@/hooks/usePreferences";
import { useUpdatePreferences } from "@/hooks/useUpdatePreferences";
import type { Preferences } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

/** Form body — keyed by `updated_at` at the call site so a successful save
 * (which bumps `updated_at` server-side) remounts it and resets the baseline. */
function InterestsForm({ initial }: { initial: Preferences }) {
  const [interests, setInterests] = useState(initial.interests);
  const [antiInterests, setAntiInterests] = useState(initial.anti_interests);
  const updatePreferences = useUpdatePreferences();

  const isDirty =
    interests !== initial.interests || antiInterests !== initial.anti_interests;

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        updatePreferences.mutate(
          { interests, anti_interests: antiInterests },
          { onSuccess: () => toast.success("Interests saved") },
        );
      }}
    >
      <Field>
        <FieldLabel htmlFor="interests">Interests</FieldLabel>
        <Textarea
          id="interests"
          placeholder="e.g. AI research, distributed systems, climate tech — describe what you want to read more of"
          className="min-h-32"
          value={interests}
          onChange={(event) => setInterests(event.target.value)}
          disabled={updatePreferences.isPending}
        />
        <FieldDescription>
          Steers scoring toward articles matching these topics.
        </FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="anti-interests">Anti-interests</FieldLabel>
        <Textarea
          id="anti-interests"
          placeholder="e.g. celebrity gossip, sports scores — describe what you want to see less of"
          className="min-h-32"
          value={antiInterests}
          onChange={(event) => setAntiInterests(event.target.value)}
          disabled={updatePreferences.isPending}
        />
        <FieldDescription>
          Steers scoring away from articles matching these topics.
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

/** The Interests settings section — free-text interests/anti-interests that steer LLM relevance scoring. */
export function InterestsSettings() {
  const { data, isPending, isError } = usePreferences();

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-lg font-semibold">Interests</h2>

      {isPending ? (
        <div className="flex flex-col gap-5">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : isError ? (
        <p className="text-muted-foreground text-sm">
          Couldn&apos;t load your interests. Retrying…
        </p>
      ) : (
        <InterestsForm key={data.updated_at} initial={data} />
      )}
    </div>
  );
}
