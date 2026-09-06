"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/categories"
import { createCompanyAction, type CompanyFormState } from "@/app/actions/companies"

const LABEL = "text-xs font-medium uppercase tracking-wide text-muted-foreground"

export function CompanyForm() {
  const [state, formAction] = useActionState<CompanyFormState, FormData>(
    createCompanyAction,
    {},
  )

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Company name" htmlFor="c-name">
          <Input id="c-name" name="name" maxLength={200} className="h-10" />
        </Field>
        <Field label="Industry" htmlFor="c-industry">
          <select
            id="c-industry"
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
        <Field label="Website (optional)" htmlFor="c-website">
          <Input id="c-website" name="website" type="url" placeholder="https://" className="h-10" />
        </Field>
        <Field label="Logo URL (optional)" htmlFor="c-logo">
          <Input id="c-logo" name="logo" className="h-10" />
        </Field>
        <Field label="Contact email (optional)" htmlFor="c-email">
          <Input id="c-email" name="contactEmail" type="email" className="h-10" />
        </Field>
        <Field label="Contact phone (optional)" htmlFor="c-phone">
          <Input id="c-phone" name="contactPhone" className="h-10" />
        </Field>
      </div>

      <Field label="Description" htmlFor="c-description">
        <Textarea id="c-description" name="description" rows={4} className="resize-y leading-relaxed" />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Services" htmlFor="c-services" hint="One per line or comma-separated">
          <Textarea id="c-services" name="services" rows={3} className="resize-y leading-relaxed" />
        </Field>
        <Field label="Locations" htmlFor="c-locations" hint="One per line or comma-separated">
          <Textarea id="c-locations" name="locations" rows={3} className="resize-y leading-relaxed" />
        </Field>
        <Field label="Service areas" htmlFor="c-areas" hint="Cities or regions">
          <Textarea id="c-areas" name="serviceAreas" rows={3} className="resize-y leading-relaxed" />
        </Field>
        <Field label="ZIP codes served" htmlFor="c-zips" hint="5-digit ZIPs, used for lead matching">
          <Textarea id="c-zips" name="zips" rows={3} className="resize-y leading-relaxed" />
        </Field>
      </div>

      <fieldset className="flex flex-col gap-3 rounded-xl border border-border p-4">
        <legend className="px-1 text-sm font-medium">Status</legend>
        <Checkbox name="leadPartner" label="Lead partner — receive matched consumer leads" />
        <Checkbox name="hiring" label="Currently hiring" />
        <Checkbox name="published" label="Published — visible in the directory and to matching" />
      </fieldset>

      {state.error ? (
        <p role="alert" className="text-sm leading-relaxed text-destructive">
          {state.error}
        </p>
      ) : null}

      <div>
        <SubmitButton />
      </div>
    </form>
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
      <label htmlFor={htmlFor} className={LABEL}>
        {label}
      </label>
      {children}
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  )
}

function Checkbox({ name, label }: { name: string; label: string }) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <input type="checkbox" name={name} className="size-4 accent-[var(--primary)]" />
      {label}
    </label>
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
      {pending ? "Saving…" : "Create company"}
    </button>
  )
}
