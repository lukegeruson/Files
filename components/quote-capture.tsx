"use client"

import { useMemo, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  MapPin,
  Plus,
  Ruler,
  Sparkles,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  QUOTE_CATEGORIES,
  QUOTE_CATEGORY_ORDER,
  QUOTE_TIMELINES,
  projectTypeLabel,
  timelineLabel,
  type QuoteCategory,
  type QuoteContext,
  type QuoteLead,
  type QuoteProject,
} from "@/lib/quote-capture"

type StepKey = "project" | "qualify" | "contact"

type Props = {
  category: QuoteCategory
  /** Known project details from the Visual Explorer / calculators. */
  context?: QuoteContext
  /**
   * Optional handoff for a CRM/database/email/API. The component works fully
   * without it; it also surfaces the built lead so wiring later is trivial.
   */
  onSubmit?: (lead: QuoteLead) => void
  className?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function QuoteCapture({ category, context = {}, onSubmit, className }: Props) {
  const config = QUOTE_CATEGORIES[category]

  const [open, setOpen] = useState(false)
  const [submitted, setSubmitted] = useState<QuoteLead | null>(null)

  // Primary project — seeded from whatever the page already knows.
  const [projectType, setProjectType] = useState(context.projectType ?? "")
  const [zipCode, setZipCode] = useState(context.zipCode ?? "")
  const [timeline, setTimeline] = useState(context.timeline ?? "")
  const [projectSize, setProjectSize] = useState(context.projectSize ?? "")

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [triedContact, setTriedContact] = useState(false)

  const [additionalProjects, setAdditionalProjects] = useState<QuoteProject[]>([])

  // Known facts let us skip questions the site already has answers for.
  const knownType = Boolean(context.projectType)
  const knownZip = Boolean(context.zipCode)
  const knownTimeline = Boolean(context.timeline)

  // Only include steps that still have something to ask.
  const steps = useMemo<StepKey[]>(() => {
    const list: StepKey[] = []
    if (!knownType) list.push("project")
    if (!knownZip || !knownTimeline) list.push("qualify")
    list.push("contact")
    return list
  }, [knownType, knownZip, knownTimeline])

  const [stepIndex, setStepIndex] = useState(0)
  const currentStep = steps[Math.min(stepIndex, steps.length - 1)]

  const hasKnownInfo =
    Boolean(context.projectType || context.zipCode || context.projectSize)

  const emailValid = EMAIL_RE.test(email.trim())
  const contactValid = name.trim().length > 0 && emailValid

  function reveal() {
    setOpen(true)
    setStepIndex(0)
  }

  function canAdvance(step: StepKey): boolean {
    if (step === "project") return Boolean(projectType)
    if (step === "qualify") return (knownZip || zipCode.trim().length > 0) && (knownTimeline || Boolean(timeline))
    return contactValid
  }

  function next() {
    if (stepIndex < steps.length - 1) setStepIndex((i) => i + 1)
  }

  function back() {
    if (stepIndex > 0) setStepIndex((i) => i - 1)
  }

  function buildProject(): QuoteProject {
    return {
      category,
      projectType: projectType || undefined,
      projectTypeLabel: projectTypeLabel(category, projectType),
      zipCode: zipCode.trim() || undefined,
      timeline: timeline || undefined,
      timelineLabel: timelineLabel(timeline),
      projectSize: projectSize.trim() || undefined,
    }
  }

  function submit() {
    setTriedContact(true)
    if (!contactValid) return
    const lead: QuoteLead = {
      primary: buildProject(),
      additionalProjects,
      contact: {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
      },
      explorerContext: context,
      sourceCategory: category,
      sourcePage: typeof window !== "undefined" ? window.location.pathname : `/${category}`,
      submittedAt: new Date().toISOString(),
    }
    onSubmit?.(lead)
    setSubmitted(lead)
  }

  function resetAll() {
    setSubmitted(null)
    setOpen(false)
    setStepIndex(0)
    setProjectType(context.projectType ?? "")
    setZipCode(context.zipCode ?? "")
    setTimeline(context.timeline ?? "")
    setProjectSize(context.projectSize ?? "")
    setName("")
    setEmail("")
    setPhone("")
    setTriedContact(false)
    setAdditionalProjects([])
  }

  // ---- Success state -------------------------------------------------------
  if (submitted) {
    return (
      <section aria-label="Quote request sent" className={cn(sectionShell, className)}>
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Check className="size-6" aria-hidden="true" />
          </span>
          <div className="space-y-1.5">
            <h3 className="font-serif text-2xl font-semibold tracking-tight text-balance">
              Thanks — your quote request is on its way.
            </h3>
            <p className="mx-auto max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
              Your project details have been received and can be reviewed by a
              professional in your area. We&apos;ll be in touch at{" "}
              <span className="font-medium text-foreground">{submitted.contact.email}</span>.
            </p>
          </div>

          <ProjectSummary lead={submitted} />

          <Button variant="outline" onClick={resetAll} className="mt-1 h-9 px-4">
            Explore Another Project
          </Button>
        </div>
      </section>
    )
  }

  // ---- Collapsed intro -----------------------------------------------------
  if (!open) {
    return (
      <section aria-label="Get a professional quote" className={cn(sectionShell, className)}>
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/12 px-2.5 py-1 text-xs font-medium text-primary">
              <Sparkles className="size-3.5" aria-hidden="true" />
              Free · No obligation
            </span>
            <h3 className="font-serif text-2xl font-semibold tracking-tight text-balance md:text-3xl">
              Get a Professional Quote
            </h3>
            <p className="max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground">
              Turn what you&apos;ve explored into a real quote. Share a few quick
              details about your {config.label.toLowerCase()} project and a
              professional can follow up — we&apos;ll reuse anything you&apos;ve
              already told the calculators so you don&apos;t repeat yourself.
            </p>
          </div>
          <Button onClick={reveal} className="h-11 shrink-0 gap-2 px-5 text-sm">
            Get My Professional Quote
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </section>
    )
  }

  // ---- Form ----------------------------------------------------------------
  return (
    <section aria-label={`${config.label} quote request`} className={cn(sectionShell, className)}>
      <div className="space-y-5">
        <header className="space-y-1.5">
          <h3 className="font-serif text-2xl font-semibold tracking-tight text-balance md:text-3xl">
            <span aria-hidden="true">{config.emoji} </span>
            Get a Professional {config.label} Quote
          </h3>
          <StepIndicator total={steps.length} current={stepIndex} />
        </header>

        {hasKnownInfo ? <KnownInfo config={config.projectTitle} context={context} category={category} /> : null}

        {currentStep === "project" ? (
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-foreground">
              What kind of project is this?
            </legend>
            <div className="flex flex-wrap gap-2">
              {config.projectTypes.map((t) => {
                const active = t.id === projectType
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setProjectType(t.id)}
                    aria-pressed={active}
                    className={chip(active)}
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>
          </fieldset>
        ) : null}

        {currentStep === "qualify" ? (
          <div className="space-y-4">
            {!knownZip ? (
              <div className="space-y-1.5">
                <Label htmlFor="quote-zip" className="flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  ZIP code / project location
                </Label>
                <Input
                  id="quote-zip"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  placeholder="e.g. 95050"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  className="h-10 max-w-[12rem]"
                />
              </div>
            ) : null}

            {!knownTimeline ? (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-foreground">
                  When are you looking to start?
                </legend>
                <div className="flex flex-wrap gap-2">
                  {QUOTE_TIMELINES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTimeline(t.id)}
                      aria-pressed={t.id === timeline}
                      className={chip(t.id === timeline)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </fieldset>
            ) : null}

            {config.sizeQuestion ? (
              <div className="space-y-1.5">
                <Label htmlFor="quote-size" className="flex items-center gap-1.5">
                  <Ruler className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  {config.sizeQuestion.label}{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="quote-size"
                  placeholder={config.sizeQuestion.placeholder}
                  value={projectSize}
                  onChange={(e) => setProjectSize(e.target.value)}
                  className="h-10 max-w-xs"
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {currentStep === "contact" ? (
          <div className="space-y-4">
            <p className="text-sm font-medium text-foreground">
              Where should we send your quote request?
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="quote-name">Name</Label>
                <Input
                  id="quote-name"
                  autoComplete="name"
                  placeholder="Jordan Rivera"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-10"
                  aria-invalid={triedContact && name.trim().length === 0}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quote-email">Email</Label>
                <Input
                  id="quote-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10"
                  aria-invalid={triedContact && !emailValid}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quote-phone">
                  Phone <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="quote-phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="(555) 123-4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-10"
                />
              </div>
            </div>
            {triedContact && !contactValid ? (
              <p className="text-xs text-destructive">
                Please add your name and a valid email so a professional can reach you.
              </p>
            ) : null}

            <AddAnotherProject
              primaryCategory={category}
              defaultZip={zipCode}
              projects={additionalProjects}
              onChange={setAdditionalProjects}
            />
          </div>
        ) : null}

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3 pt-1">
          {stepIndex > 0 ? (
            <Button variant="ghost" onClick={back} className="h-10 gap-1.5 px-3 text-sm">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back
            </Button>
          ) : (
            <span />
          )}

          {currentStep === "contact" ? (
            <Button onClick={submit} disabled={!contactValid} className="h-11 gap-2 px-5 text-sm">
              Get My Professional Quote
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          ) : (
            <Button
              onClick={next}
              disabled={!canAdvance(currentStep)}
              className="h-11 gap-2 px-5 text-sm"
            >
              Continue
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------

const sectionShell =
  "rounded-3xl border border-border bg-card p-6 text-card-foreground shadow-sm md:p-8"

function chip(active: boolean) {
  return cn(
    "inline-flex items-center rounded-full border px-3.5 py-2 text-sm transition-colors",
    active
      ? "border-primary bg-primary/15 font-medium text-foreground"
      : "border-input bg-background text-muted-foreground hover:border-ring hover:text-foreground",
  )
}

function StepIndicator({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Step {Math.min(current + 1, total)} of {total}
      </span>
      <div className="flex gap-1" aria-hidden="true">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 w-6 rounded-full transition-colors",
              i <= current ? "bg-primary" : "bg-border",
            )}
          />
        ))}
      </div>
    </div>
  )
}

function KnownInfo({
  config,
  context,
  category,
}: {
  config: string
  context: QuoteContext
  category: QuoteCategory
}) {
  const typeLabel = projectTypeLabel(category, context.projectType)
  const facts = [
    typeLabel,
    context.projectSize,
    context.zipCode,
  ].filter((v): v is string => Boolean(v))

  return (
    <div className="rounded-2xl border border-border/70 bg-muted/40 p-3.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {config}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {facts.map((f) => (
          <span
            key={f}
            className="inline-flex items-center gap-1.5 rounded-full bg-background px-2.5 py-1 text-xs font-medium text-foreground shadow-sm"
          >
            <Check className="size-3 text-primary" aria-hidden="true" />
            {f}
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Pulled from what you explored — no need to re-enter it.
      </p>
    </div>
  )
}

function ProjectSummary({ lead }: { lead: QuoteLead }) {
  const projects = [lead.primary, ...lead.additionalProjects]
  return (
    <div className="w-full max-w-md space-y-2 rounded-2xl border border-border bg-muted/40 p-4 text-left">
      {projects.map((p, i) => {
        const cfg = QUOTE_CATEGORIES[p.category]
        const bits = [p.projectTypeLabel, p.projectSize, p.zipCode, p.timelineLabel].filter(
          Boolean,
        )
        return (
          <div key={i} className="flex items-start gap-2">
            <span aria-hidden="true" className="text-sm leading-6">
              {cfg.emoji}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{cfg.label}</p>
              {bits.length > 0 ? (
                <p className="text-xs text-muted-foreground">{bits.join(" · ")}</p>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function AddAnotherProject({
  primaryCategory,
  defaultZip,
  projects,
  onChange,
}: {
  primaryCategory: QuoteCategory
  defaultZip: string
  projects: QuoteProject[]
  onChange: (next: QuoteProject[]) => void
}) {
  const [drafting, setDrafting] = useState(false)
  const [draftCategory, setDraftCategory] = useState<QuoteCategory>(
    QUOTE_CATEGORY_ORDER.find((c) => c !== primaryCategory) ?? primaryCategory,
  )
  const [draftType, setDraftType] = useState("")

  const draftConfig = QUOTE_CATEGORIES[draftCategory]

  function add() {
    if (!draftType) return
    onChange([
      ...projects,
      {
        category: draftCategory,
        projectType: draftType,
        projectTypeLabel: projectTypeLabel(draftCategory, draftType),
        zipCode: defaultZip.trim() || undefined,
      },
    ])
    setDrafting(false)
    setDraftType("")
  }

  function remove(index: number) {
    onChange(projects.filter((_, i) => i !== index))
  }

  return (
    <div className="rounded-2xl border border-dashed border-border/80 p-3.5">
      {projects.length > 0 ? (
        <ul className="mb-3 flex flex-wrap gap-2">
          {projects.map((p, i) => (
            <li
              key={`${p.category}-${i}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground"
            >
              <span aria-hidden="true">{QUOTE_CATEGORIES[p.category].emoji}</span>
              {QUOTE_CATEGORIES[p.category].label}
              {p.projectTypeLabel ? ` · ${p.projectTypeLabel}` : ""}
              <button
                type="button"
                onClick={() => remove(i)}
                className="rounded-full text-muted-foreground transition-colors hover:text-foreground"
                aria-label={`Remove ${QUOTE_CATEGORIES[p.category].label} project`}
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {!drafting ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Do you have another project you&apos;d like a quote for?
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDrafting(true)}
            className="h-8 gap-1.5"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Add Another Project
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Category</p>
            <div className="flex flex-wrap gap-2">
              {QUOTE_CATEGORY_ORDER.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setDraftCategory(c)
                    setDraftType("")
                  }}
                  aria-pressed={c === draftCategory}
                  className={chip(c === draftCategory)}
                >
                  <span aria-hidden="true" className="mr-1">
                    {QUOTE_CATEGORIES[c].emoji}
                  </span>
                  {QUOTE_CATEGORIES[c].label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Project type</p>
            <div className="flex flex-wrap gap-2">
              {draftConfig.projectTypes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setDraftType(t.id)}
                  aria-pressed={t.id === draftType}
                  className={chip(t.id === draftType)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={add} disabled={!draftType} className="h-8">
              Add project
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDrafting(false)
                setDraftType("")
              }}
              className="h-8"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
