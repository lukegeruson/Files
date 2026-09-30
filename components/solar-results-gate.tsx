"use client"

import { useActionState } from "react"
import { LockKeyhole } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/calculator-ui"
import { submitSolarEstimate, type SolarUnlockState } from "@/app/actions/solar-estimates"
import type { SolarInputs } from "@/lib/solar"

const INITIAL: SolarUnlockState = { status: "idle" }

export function SolarResultsGate({
  inputs,
  onUnlocked,
}: {
  inputs: SolarInputs
  onUnlocked: () => void
}) {
  const [state, formAction, pending] = useActionState(
    async (prev: SolarUnlockState, formData: FormData) => {
      const next = await submitSolarEstimate(prev, formData)
      if (next.status === "sent") onUnlocked()
      return next
    },
    INITIAL,
  )

  return (
    <section
      aria-labelledby="solar-gate-title"
      className="flex h-full flex-col rounded-lg border border-border bg-card p-6"
    >
      <div className="flex items-center gap-2 text-primary">
        <LockKeyhole className="size-4" aria-hidden="true" />
        <span className="text-xs font-medium uppercase tracking-wide">Your estimate is ready</span>
      </div>
      <h3 id="solar-gate-title" className="mt-2 text-balance font-serif text-2xl font-semibold">
        Unlock your solar results
      </h3>
      <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
        Tell us where to reach you to see your cost after incentives, payback period, and savings
        for cash, loan, and lease.
      </p>

      <form action={formAction} className="mt-5 flex flex-col gap-4" noValidate={false}>
        <input type="hidden" name="inputs" value={JSON.stringify(inputs)} />
        <Field label="Full name" htmlFor="gate-name">
          <Input id="gate-name" name="name" autoComplete="name" required maxLength={200} />
        </Field>
        <Field label="Email" htmlFor="gate-email">
          <Input id="gate-email" name="email" type="email" autoComplete="email" required maxLength={200} />
        </Field>
        <Field label="Phone" htmlFor="gate-phone">
          <Input
            id="gate-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(555) 123-4567"
            required
          />
        </Field>
        <label className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <input
            type="checkbox"
            name="consent"
            required
            className="mt-0.5 size-4 shrink-0 accent-primary"
          />
          <span>I agree to be contacted by email or phone about my solar estimate.</span>
        </label>

        {state.status === "error" ? (
          <p role="alert" className="text-sm text-destructive">
            {state.message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Unlocking…" : "See my results"}
        </button>
      </form>
    </section>
  )
}
