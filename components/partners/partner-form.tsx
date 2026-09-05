"use client"

import Link from "next/link"
import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"
import { ArrowLeft, Check, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/categories"
import { PARTNERSHIP_OPTIONS, type PartnershipId } from "@/lib/leads/constants"
import { submitPartnerApplication, type PartnerState } from "@/app/actions/partners"

const FIELD_LABEL = "text-xs font-medium uppercase tracking-wide text-muted-foreground"

export function PartnerForm() {
  const [state, formAction] = useActionState<PartnerState, FormData>(
    submitPartnerApplication,
    { status: "idle" },
  )
  const [interest, setInterest] = useState<PartnershipId | "">("")

  if (state.status === "sent") {
    return <ThankYou />
  }

  const selected = PARTNERSHIP_OPTIONS.find((option) => option.id === interest)

  return (
    <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
      <h2 className="font-serif text-xl font-semibold tracking-tight">
        How would you like to work with Evergreen?
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {PARTNERSHIP_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setInterest(option.id)}
            aria-pressed={interest === option.id}
            className={`flex flex-col gap-1 rounded-xl border p-4 text-left transition-colors ${
              interest === option.id
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary"
            }`}
          >
            <span className="text-sm font-medium">{option.label}</span>
            <span className="text-xs leading-relaxed text-muted-foreground">
              {option.description}
            </span>
          </button>
        ))}
      </div>

      {selected ? (
        <form action={formAction} className="mt-8 flex flex-col gap-4 border-t border-border pt-8">
          <input type="hidden" name="interest" value={selected.id} />
          <p className="text-sm text-muted-foreground">
            You selected <span className="font-medium text-foreground">{selected.label}</span>.
            Tell us a little about your company.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="p-name">
              <Input id="p-name" name="name" autoComplete="name" maxLength={200} className="h-10" />
            </Field>
            <Field label="Work email" htmlFor="p-email">
              <Input
                id="p-email"
                name="workEmail"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                className="h-10"
              />
            </Field>
            <Field label="Company" htmlFor="p-company">
              <Input id="p-company" name="company" maxLength={200} className="h-10" />
            </Field>
            <Field label="Company website (optional)" htmlFor="p-website">
              <Input
                id="p-website"
                name="companyWebsite"
                type="url"
                placeholder="https://"
                className="h-10"
              />
            </Field>
            <Field label="Industry" htmlFor="p-industry">
              <select
                id="p-industry"
                name="industry"
                defaultValue=""
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Choose an industry</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Location" htmlFor="p-location">
              <Input
                id="p-location"
                name="location"
                maxLength={200}
                placeholder="City, State"
                className="h-10"
              />
            </Field>
          </div>

          {/* Interest-specific sections. Only the relevant one renders, so the
              matching arrays on the server stay empty for everyone else. */}
          {selected.fields === "leadPartner" ? (
            <div className="flex flex-col gap-4 rounded-xl border border-border bg-secondary/30 p-4">
              <p className="text-sm font-medium text-foreground">Lead matching details</p>
              <Field label="Services you offer" htmlFor="p-services" hint="One per line or comma-separated">
                <Textarea id="p-services" name="services" rows={3} className="resize-y leading-relaxed" />
              </Field>
              <Field label="Service areas" htmlFor="p-areas" hint="Cities or regions you cover">
                <Textarea id="p-areas" name="serviceAreas" rows={2} className="resize-y leading-relaxed" />
              </Field>
              <Field label="ZIP codes served" htmlFor="p-zips" hint="5-digit ZIPs, comma-separated">
                <Textarea id="p-zips" name="zips" rows={2} className="resize-y leading-relaxed" />
              </Field>
            </div>
          ) : null}

          {selected.fields === "employer" ? (
            <div className="flex flex-col gap-4 rounded-xl border border-border bg-secondary/30 p-4">
              <p className="text-sm font-medium text-foreground">Hiring details</p>
              <Field label="Roles you hire for" htmlFor="p-jobs" hint="One per line or comma-separated">
                <Textarea id="p-jobs" name="jobs" rows={3} className="resize-y leading-relaxed" />
              </Field>
              <Field label="Hiring locations" htmlFor="p-hiring" hint="Cities or regions">
                <Textarea id="p-hiring" name="hiringLocations" rows={2} className="resize-y leading-relaxed" />
              </Field>
            </div>
          ) : null}

          {selected.fields === "expert" ? (
            <div className="flex flex-col gap-4 rounded-xl border border-border bg-secondary/30 p-4">
              <p className="text-sm font-medium text-foreground">Expert contributor details</p>
              <Field label="Job title" htmlFor="p-title">
                <Input id="p-title" name="jobTitle" maxLength={200} className="h-10" />
              </Field>
              <Field label="Area of expertise" htmlFor="p-expertise">
                <Textarea id="p-expertise" name="expertise" rows={2} className="resize-y leading-relaxed" />
              </Field>
            </div>
          ) : null}

          <Field label="Message (optional)" htmlFor="p-message">
            <Textarea
              id="p-message"
              name="message"
              rows={4}
              maxLength={4000}
              placeholder="Anything else you'd like us to know."
              className="resize-y leading-relaxed"
            />
          </Field>

          {state.status === "error" && state.message ? (
            <p role="alert" className="text-sm leading-relaxed text-destructive">
              {state.message}
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setInterest("")}
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-5 text-sm font-medium transition-colors hover:bg-secondary"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Change
            </button>
            <SubmitButton />
          </div>
        </form>
      ) : null}
    </div>
  )
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className={FIELD_LABEL}>
        {label}
      </label>
      {children}
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
      {pending ? "Sending…" : "Submit application"}
    </button>
  )
}

function ThankYou() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
      <span className="inline-flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Check className="size-5" aria-hidden="true" />
      </span>
      <h2 className="mt-4 font-serif text-2xl font-semibold tracking-tight">
        Thanks for your interest in partnering
      </h2>
      <p className="mt-2 text-pretty leading-relaxed text-muted-foreground">
        We&apos;ve received your details and will review how we can work
        together. We&apos;ll reach out using the work email you provided.
      </p>
      <div className="mt-6">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-md border border-border px-5 text-sm font-medium transition-colors hover:bg-secondary"
        >
          Back to home
        </Link>
      </div>
    </div>
  )
}
