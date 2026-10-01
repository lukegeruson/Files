"use client"

// Home Upgrade Advisor — the "what should I fix first?" tool.
//
// All scoring lives in lib/home-advisor.ts; this component is the form plus the
// readout. It deliberately leads with the action plan rather than a total,
// because the question this tool answers is ordering, not price.

import { useMemo, useState } from "react"
import { AlertTriangle, ClipboardList, Info, ListChecks, Route } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Field, Panel, Stat } from "@/components/calculator-ui"
import { HomeAdvisorChecklist } from "@/components/home-advisor-checklist"
import { cn } from "@/lib/utils"
import {
  VERDICT_META,
  VERDICT_ORDER,
  computeAdvice,
  formatMoney,
  initialComponentState,
  type ComponentId,
  type Condition,
  type Priority,
  type Verdict,
} from "@/lib/home-advisor"

const DEFAULT_HOME_SIZE = 1800
const DEFAULT_STORIES = 1
const DEFAULT_YEARS_STAYING = 10
const DEFAULT_PRIORITY: Priority = "balanced"

/** Tone -> theme token. Keeps verdict colors inside the design system. */
const TONE_CLASS: Record<string, string> = {
  critical: "border-destructive/50 bg-destructive/10",
  warn: "border-chart-4/50 bg-chart-4/10",
  watch: "border-chart-3/50 bg-chart-3/10",
  opportunity: "border-primary/50 bg-primary/10",
  calm: "border-border bg-muted/40",
}

const DOT_CLASS: Record<Verdict, string> = {
  "repair-now": "bg-destructive",
  "replace-soon": "bg-chart-4",
  monitor: "bg-chart-3",
  upgrade: "bg-primary",
  none: "bg-muted-foreground/40",
}

function range(low: number, high: number): string {
  if (low <= 0 && high <= 0) return "$0"
  if (Math.round(low) === Math.round(high)) return formatMoney(low)
  return `${formatMoney(low)} – ${formatMoney(high)}`
}

export function HomeUpgradeAdvisor() {
  const [zip, setZip] = useState("")
  const [yearBuilt, setYearBuilt] = useState("1995")
  const [budget, setBudget] = useState("")
  const [components, setComponents] = useState(initialComponentState)
  const [expanded, setExpanded] = useState<ComponentId | null>(null)

  const result = useMemo(
    () =>
      computeAdvice({
        zip,
        yearBuilt: Number.parseInt(yearBuilt, 10) || 0,
        homeSize: DEFAULT_HOME_SIZE,
        stories: DEFAULT_STORIES,
        yearsStaying: DEFAULT_YEARS_STAYING,
        budget: Number.parseFloat(budget) || 0,
        priority: DEFAULT_PRIORITY,
        components,
      }),
    [zip, yearBuilt, budget, components],
  )

  const verdicts = useMemo(
    () => new Map(result.assessments.map((a) => [a.id, a.verdict])),
    [result.assessments],
  )

  const verdictLabels = useMemo(
    () =>
      VERDICT_ORDER.reduce(
        (acc, v) => {
          acc[v] = VERDICT_META[v].label
          return acc
        },
        {} as Record<Verdict, string>,
      ),
    [],
  )

  const budgetValue = Number.parseFloat(budget) || 0

  function toggleAssessed(id: ComponentId) {
    setComponents((prev) => {
      const nowAssessed = !prev[id].assessed
      return { ...prev, [id]: { ...prev[id], assessed: nowAssessed } }
    })
    // Opening a system for the first time should reveal its questions.
    setExpanded((prev) => (prev === id ? null : id))
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h2 className="font-serif text-2xl font-semibold tracking-tight md:text-3xl">
          Home Upgrade Advisor
        </h2>
        <p className="max-w-3xl text-pretty leading-relaxed text-muted-foreground">
          Check the systems that concern you and we&apos;ll tell you what to fix first and
          roughly what it costs.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ---------------- Inputs ---------------- */}
        <div className="flex flex-col gap-6">
          <Panel title="Your home" icon={<ClipboardList className="size-4" aria-hidden="true" />}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label="ZIP code"
                htmlFor="advisor-zip"
                hint={
                  result.region.isFallback
                    ? "Using national average pricing until a ZIP is entered."
                    : `${result.region.stateName} runs about ${Math.round(
                        (result.region.index - 1) * 100,
                      )}% ${result.region.index >= 1 ? "above" : "below"} the national average.`
                }
              >
                <Input
                  id="advisor-zip"
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="e.g. 80301"
                  value={zip}
                  onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                />
              </Field>
              <Field label="Year built" htmlFor="advisor-year">
                <Input
                  id="advisor-year"
                  inputMode="numeric"
                  value={yearBuilt}
                  onChange={(e) => setYearBuilt(e.target.value.replace(/\D/g, "").slice(0, 4))}
                />
              </Field>
              <Field label="Budget (optional)" htmlFor="advisor-budget">
                <Input
                  id="advisor-budget"
                  inputMode="numeric"
                  placeholder="e.g. 15000"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value.replace(/[^\d.]/g, ""))}
                />
              </Field>
            </div>
          </Panel>

          <Panel
            title="Which systems concern you?"
            icon={<ListChecks className="size-4" aria-hidden="true" />}
          >
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
              Check anything you want assessed, then answer the few questions that appear.
              Skip what you have no concerns about — {result.assessedCount} of{" "}
              {Object.keys(components).length} assessed so far.
            </p>
            <HomeAdvisorChecklist
              components={components}
              expanded={expanded}
              onToggle={toggleAssessed}
              onExpand={setExpanded}
              onAge={(id, value) =>
                setComponents((prev) => ({ ...prev, [id]: { ...prev[id], age: value } }))
              }
              onCondition={(id, value: Condition) =>
                setComponents((prev) => ({ ...prev, [id]: { ...prev[id], condition: value } }))
              }
              onSymptom={(id, symptomId) =>
                setComponents((prev) => {
                  const has = prev[id].symptoms.includes(symptomId)
                  return {
                    ...prev,
                    [id]: {
                      ...prev[id],
                      symptoms: has
                        ? prev[id].symptoms.filter((s) => s !== symptomId)
                        : [...prev[id].symptoms, symptomId],
                    },
                  }
                })
              }
              onRecentRepair={(id, value) =>
                setComponents((prev) => ({ ...prev, [id]: { ...prev[id], recentRepair: value } }))
              }
              verdicts={verdicts}
              verdictLabels={verdictLabels}
            />
          </Panel>
        </div>

        {/* ---------------- Results ---------------- */}
        <div className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
          {result.isEmpty ? (
            <Panel title="Your action plan" icon={<Route className="size-4" aria-hidden="true" />}>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Check a system on the left to see what to fix first and what it costs.
              </p>
            </Panel>
          ) : (
            <Panel title="Your action plan" icon={<Route className="size-4" aria-hidden="true" />}>
              <div className="flex flex-col gap-3">
                <Stat
                  label="Urgent work"
                  value={range(result.totals.immediate.low, result.totals.immediate.high)}
                  sub={`${result.byVerdict["repair-now"].length} item(s) causing damage now`}
                  emphasis
                />
                <Stat
                  label="Everything assessed"
                  value={range(result.totals.all.low, result.totals.all.high)}
                  sub={
                    budgetValue > 0
                      ? result.totals.all.low <= budgetValue
                        ? `Across ${result.assessedCount} system(s) · fits your budget`
                        : `Across ${result.assessedCount} system(s) · over your budget`
                      : `Across ${result.assessedCount} system(s)`
                  }
                />
              </div>
            </Panel>
          )}
        </div>
      </div>

      {/* ---------------- Priority list ---------------- */}
      {!result.isEmpty ? (
        <div className="flex flex-col gap-4">
          <h3 className="font-serif text-xl font-semibold tracking-tight">
            What to do first
          </h3>
          {VERDICT_ORDER.filter((v) => result.byVerdict[v].length > 0).map((verdict) => {
            const meta = VERDICT_META[verdict]
            return (
              <section
                key={verdict}
                className={cn("rounded-lg border p-5", TONE_CLASS[meta.tone])}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn("size-2.5 rounded-full", DOT_CLASS[verdict])}
                    aria-hidden="true"
                  />
                  <h4 className="font-serif text-lg font-semibold">{meta.label}</h4>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {result.byVerdict[verdict].length} item(s)
                  </span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{meta.blurb}</p>

                <ul className="mt-4 flex flex-col gap-4">
                  {result.byVerdict[verdict].map((a) => (
                    <li key={a.id} className="border-t border-border pt-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-medium">{a.label}</span>
                        <span className="text-sm font-medium tabular-nums">
                          {range(a.cost.low, a.cost.high)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {a.risk.text}
                      </p>
                      {a.inspection ? (
                        <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-foreground">
                          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                          {a.inspection}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      ) : null}

      <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          This is educational prioritization built from average service lives, regional cost
          data and the symptoms you reported — not a professional inspection, engineering
          assessment or diagnosis. Anything involving structure, gas, electrical or active
          water intrusion should be evaluated in person by a licensed professional before you
          spend money.
        </span>
      </p>
    </div>
  )
}
