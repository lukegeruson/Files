"use client"

import { useActionState, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { OpeningFormState } from "@/app/actions/openings"
import { INDUSTRIES, INDUSTRY_META } from "@/lib/careers/industries"
import type { Industry } from "@/lib/careers/types"

/**
 * Slim career option passed down from the server.
 *
 * `careers.ts` is ~2,300 lines of prose. Sending the whole module to the client
 * just to fill a `<select>` would be the single largest thing in this bundle,
 * so the page maps it to id/name/industry first.
 */
export type CareerOption = {
  id: string
  name: string
  industry: Industry
  level: string
}

/** Values the form renders from, shaped so a new posting can pass defaults. */
export type OpeningDefaults = {
  title: string
  careerId: string | null
  industry: Industry
  employer: string
  city: string
  state: string
  zip: string
  employmentType: string
  description: string
  payMin: number | null
  payMax: number | null
  payPeriod: string
  applyUrl: string | null
  applyEmail: string | null
  published: boolean
  /** yyyy-mm-dd, matching what `<input type="date">` expects. */
  expiresOn: string
}

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

export function OpeningForm({
  action,
  defaults,
  careers,
  states,
  employmentTypes,
  payPeriods,
  submitLabel,
}: {
  action: (
    state: OpeningFormState,
    formData: FormData,
  ) => Promise<OpeningFormState>
  defaults: OpeningDefaults
  careers: CareerOption[]
  states: { code: string; name: string }[]
  employmentTypes: { value: string; label: string }[]
  payPeriods: { value: string; label: string }[]
  submitLabel: string
}) {
  const [state, formAction, pending] = useActionState<
    OpeningFormState,
    FormData
  >(action, {})

  // Industry is controlled so the role list can follow it. Pinning the two
  // together matters because industry drives the pin colour on the public map —
  // a solar role on a landscaping posting would draw a green pin for a solar
  // job, and the mismatch would only ever be visible to the person reading it.
  const [industry, setIndustry] = useState<Industry>(defaults.industry)
  const [careerId, setCareerId] = useState(defaults.careerId ?? "")

  const options = useMemo(
    () =>
      careers
        .filter((c) => c.industry === industry)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [careers, industry],
  )

  function changeIndustry(next: Industry) {
    setIndustry(next)
    // Clear a role that belongs to the trade we just left, rather than
    // silently submitting a mismatched pair.
    setCareerId((current) =>
      careers.find((c) => c.id === current)?.industry === next ? current : "",
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state.error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Job title</Label>
        <Input
          id="title"
          name="title"
          defaultValue={defaults.title}
          placeholder="Solar Lead Generator"
          required
        />
        <p className="text-xs text-muted-foreground">
          What the role is called in the posting. This is the headline people
          see.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="industry">Trade</Label>
          <select
            id="industry"
            name="industry"
            value={industry}
            onChange={(e) => changeIndustry(e.target.value as Industry)}
            className={SELECT_CLASS}
          >
            {INDUSTRIES.map((value) => (
              <option key={value} value={value}>
                {INDUSTRY_META[value].label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="careerId">Matching role</Label>
          <select
            id="careerId"
            name="careerId"
            value={careerId}
            onChange={(e) => setCareerId(e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">No clean match</option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.level}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Links the opening to the skill tree, so it surfaces for people whose
            quiz matches point here. Leave unmatched if nothing fits.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="employer">Employer</Label>
        <Input
          id="employer"
          name="employer"
          defaultValue={defaults.employer}
          placeholder="Evergreen Builders"
          required
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_8rem_8rem]">
        <div className="flex flex-col gap-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            name="city"
            defaultValue={defaults.city}
            placeholder="San Jose"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="state">State</Label>
          <select
            id="state"
            name="state"
            defaultValue={defaults.state}
            className={SELECT_CLASS}
          >
            {states.map((s) => (
              <option key={s.code} value={s.code}>
                {s.code}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="zip">ZIP</Label>
          <Input
            id="zip"
            name="zip"
            inputMode="numeric"
            maxLength={10}
            defaultValue={defaults.zip}
            placeholder="95110"
            required
          />
        </div>
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">
        The ZIP places the pin on the map, so it has to be a real US ZIP. Saving
        fails rather than guessing if it is not recognised.
      </p>

      <div className="flex flex-col gap-2">
        <Label htmlFor="employmentType">Employment type</Label>
        <select
          id="employmentType"
          name="employmentType"
          defaultValue={defaults.employmentType}
          className={SELECT_CLASS}
        >
          {employmentTypes.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          rows={8}
          defaultValue={defaults.description}
          placeholder="What the work involves, who it suits, and what a day looks like."
        />
      </div>

      <fieldset className="flex flex-col gap-4 rounded-lg border border-border p-4">
        <legend className="px-1 text-sm font-medium">Pay</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="payMin">Minimum</Label>
            <Input
              id="payMin"
              name="payMin"
              inputMode="decimal"
              defaultValue={defaults.payMin ?? ""}
              placeholder="24"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="payMax">Maximum</Label>
            <Input
              id="payMax"
              name="payMax"
              inputMode="decimal"
              defaultValue={defaults.payMax ?? ""}
              placeholder="32"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="payPeriod">Period</Label>
            <select
              id="payPeriod"
              name="payPeriod"
              defaultValue={defaults.payPeriod}
              className={SELECT_CLASS}
            >
              {payPeriods.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Optional. Leave both blank for &quot;not disclosed&quot; — the listing
          shows no figure rather than a zero, and no pay is written into the
          search data Google reads.
        </p>
      </fieldset>

      <fieldset className="flex flex-col gap-4 rounded-lg border border-border p-4">
        <legend className="px-1 text-sm font-medium">How to apply</legend>
        <div className="flex flex-col gap-2">
          <Label htmlFor="applyUrl">Application link</Label>
          <Input
            id="applyUrl"
            name="applyUrl"
            type="url"
            defaultValue={defaults.applyUrl ?? ""}
            placeholder="https://example.com/apply"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="applyEmail">Application email</Label>
          <Input
            id="applyEmail"
            name="applyEmail"
            type="email"
            defaultValue={defaults.applyEmail ?? ""}
            placeholder="jobs@example.com"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          At least one is required. A posting nobody can respond to is worse than
          no posting, so this is enforced on save.
        </p>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="expiresOn">Closing date</Label>
        <Input
          id="expiresOn"
          name="expiresOn"
          type="date"
          defaultValue={defaults.expiresOn}
          className="sm:max-w-56"
        />
        <p className="text-xs text-muted-foreground">
          Optional. After this date the opening disappears from the public map on
          its own, so a filled role cannot quietly keep collecting applications.
        </p>
      </div>

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="published"
          defaultChecked={defaults.published}
          className="size-4 rounded border-input accent-primary"
        />
        Published (live on the public map)
      </label>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : submitLabel}
        </Button>
        <Button
          variant="ghost"
          nativeButton={false}
          render={<Link href="/admin/openings">Cancel</Link>}
        />
      </div>
    </form>
  )
}
