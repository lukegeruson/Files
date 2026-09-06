"use client"

import Link from "next/link"
import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/lib/categories"
import {
  BUDGET_OPTIONS,
  SERVICES_BY_CATEGORY,
  TIMEFRAME_OPTIONS,
} from "@/lib/leads/constants"
import { submitLead, type LeadState } from "@/app/actions/leads"

const TOTAL_STEPS = 4

const FIELD_LABEL =
  "text-xs font-medium uppercase tracking-wide text-muted-foreground"

/**
 * Four-step consumer intake. Everything lives in one <form> so a single server
 * action receives it; earlier steps stay mounted (just hidden) so their values
 * persist. Native `required` is avoided on purpose — a required field inside a
 * hidden step is not focusable and would break submit — so each step is gated
 * with a small manual check instead, and the server re-validates everything.
 */
export function FindAProForm() {
  const [state, formAction] = useActionState<LeadState, FormData>(submitLead, {
    status: "idle",
  })
  const [step, setStep] = useState(1)
  const [category, setCategory] = useState<Category | "">("")
  const [service, setService] = useState("")
  const [stepError, setStepError] = useState("")

  // Step-three field values, tracked so "Next" can validate before advancing.
  const [zip, setZip] = useState("")
  const [description, setDescription] = useState("")
  const [timeframe, setTimeframe] = useState("")

  if (state.status === "sent") {
    return <ThankYou matches={state.matches ?? []} />
  }

  function next() {
    if (step === 3) {
      if (!/^\d{5}$/.test(zip)) return setStepError("Enter a valid 5-digit ZIP code.")
      if (!description.trim()) return setStepError("Add a short project description.")
      if (!timeframe) return setStepError("Choose a project timeframe.")
    }
    setStepError("")
    setStep((s) => Math.min(TOTAL_STEPS, s + 1))
  }

  function back() {
    setStepError("")
    setStep((s) => Math.max(1, s - 1))
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
      {/* Progress */}
      <div className="flex items-center gap-2" aria-hidden="true">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${
              i < step ? "bg-primary" : "bg-border"
            }`}
          />
        ))}
      </div>
      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Step {step} of {TOTAL_STEPS}
      </p>

      <form action={formAction} className="mt-4">
        {/* Selections carried from the button steps. */}
        <input type="hidden" name="category" value={category} />
        <input type="hidden" name="service" value={service} />

        {/* Step 1 — category */}
        <fieldset hidden={step !== 1} className="border-0 p-0">
          <legend className="font-serif text-xl font-semibold tracking-tight">
            What do you need help with?
          </legend>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setCategory(c)
                  setService("")
                  setStepError("")
                  setStep(2)
                }}
                className={`flex min-h-14 items-center justify-between rounded-xl border px-5 text-left text-sm font-medium transition-colors ${
                  category === c
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary"
                }`}
              >
                {CATEGORY_LABELS[c]}
                <ArrowRight className="size-4 text-primary" aria-hidden="true" />
              </button>
            ))}
          </div>
        </fieldset>

        {/* Step 2 — service */}
        <fieldset hidden={step !== 2} className="border-0 p-0">
          <legend className="font-serif text-xl font-semibold tracking-tight">
            {category ? `Which ${CATEGORY_LABELS[category].toLowerCase()} service?` : "Which service?"}
          </legend>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(category ? SERVICES_BY_CATEGORY[category] : []).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setService(s)
                  setStepError("")
                  setStep(3)
                }}
                className={`flex min-h-14 items-center rounded-xl border px-5 text-left text-sm font-medium transition-colors ${
                  service === s
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Step 3 — project details */}
        <fieldset hidden={step !== 3} className="border-0 p-0">
          <legend className="font-serif text-xl font-semibold tracking-tight">
            Tell us about the project
          </legend>
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="fp-zip" className={FIELD_LABEL}>
                ZIP code
              </label>
              <Input
                id="fp-zip"
                name="zip"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={5}
                placeholder="e.g. 94103"
                value={zip}
                onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                className="h-10 max-w-40"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="fp-description" className={FIELD_LABEL}>
                Project description
              </label>
              <Textarea
                id="fp-description"
                name="description"
                maxLength={4000}
                rows={5}
                placeholder="Describe what you're planning, any details that help, and what you're hoping to achieve."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-28 resize-y leading-relaxed"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="fp-budget" className={FIELD_LABEL}>
                Approximate budget <span className="normal-case">(optional)</span>
              </label>
              <select
                id="fp-budget"
                name="budget"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                defaultValue=""
              >
                <option value="">Prefer not to say</option>
                {BUDGET_OPTIONS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="fp-timeframe" className={FIELD_LABEL}>
                Project timeframe
              </label>
              <select
                id="fp-timeframe"
                name="timeframe"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
              >
                <option value="">Choose a timeframe</option>
                {TIMEFRAME_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>

        {/* Step 4 — contact + consent */}
        <fieldset hidden={step !== 4} className="border-0 p-0">
          <legend className="font-serif text-xl font-semibold tracking-tight">
            How can a professional reach you?
          </legend>
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="fp-name" className={FIELD_LABEL}>
                Name
              </label>
              <Input
                id="fp-name"
                name="name"
                autoComplete="name"
                maxLength={200}
                placeholder="Your name"
                className="h-10"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="fp-email" className={FIELD_LABEL}>
                Email
              </label>
              <Input
                id="fp-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className="h-10"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="fp-phone" className={FIELD_LABEL}>
                Phone
              </label>
              <Input
                id="fp-phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder="(555) 555-5555"
                className="h-10"
              />
            </div>
            <label className="flex items-start gap-3 rounded-lg border border-border bg-secondary/40 p-3 text-sm leading-relaxed text-muted-foreground">
              <input
                type="checkbox"
                name="consent"
                className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
              />
              <span>
                I agree that Evergreen may store my details and share them with
                relevant professionals so they can contact me about my project.
                See our approach to privacy for how your information is used.
              </span>
            </label>
          </div>
        </fieldset>

        {stepError ? (
          <p role="alert" className="mt-4 text-sm leading-relaxed text-destructive">
            {stepError}
          </p>
        ) : null}
        {state.status === "error" && state.message ? (
          <p role="alert" className="mt-4 text-sm leading-relaxed text-destructive">
            {state.message}
          </p>
        ) : null}

        {/* Navigation. Steps 1–2 advance on choice, so only 3–4 need controls. */}
        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={back}
            disabled={step === 1}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-5 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-0"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back
          </button>

          {step < TOTAL_STEPS ? (
            step >= 3 ? (
              <button
                type="button"
                onClick={next}
                className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Continue
                <ArrowRight className="size-4" aria-hidden="true" />
              </button>
            ) : (
              <span className="text-xs text-muted-foreground">Choose an option to continue</span>
            )
          ) : (
            <SubmitButton />
          )}
        </div>
      </form>
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
      {pending ? "Sending…" : "Find a Professional"}
    </button>
  )
}

/**
 * Confirmation. Only claims a match when real companies came back; otherwise it
 * states plainly that we will look, without implying anyone is waiting.
 */
function ThankYou({ matches }: { matches: LeadState["matches"] }) {
  const list = matches ?? []
  return (
    <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
      <span className="inline-flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Check className="size-5" aria-hidden="true" />
      </span>
      <h2 className="mt-4 font-serif text-2xl font-semibold tracking-tight">
        Thanks — we&apos;ve received your project
      </h2>
      <p className="mt-2 text-pretty leading-relaxed text-muted-foreground">
        We&apos;ll look for professionals that match your needs and be in touch
        using the contact details you shared.
      </p>

      {list.length > 0 ? (
        <div className="mt-6">
          <p className="text-sm font-medium text-foreground">
            Professionals in our network that may be a fit:
          </p>
          <ul className="mt-3 flex flex-col gap-3">
            {list.map((company) => (
              <li key={company.id}>
                <Link
                  href={`/companies/${company.slug}`}
                  className="block rounded-xl border border-border p-4 transition-colors hover:border-primary"
                >
                  <span className="font-medium">{company.name}</span>
                  {company.description ? (
                    <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                      {company.description}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

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
