"use client"

// Home Upgrade Advisor — the "what should I fix first?" tool.
//
// All scoring lives in lib/home-advisor.ts; this component is the form plus the
// readout. It deliberately leads with the action plan rather than a total,
// because the question this tool answers is ordering, not price.

import { useMemo, useState } from "react"
import {
  AlertTriangle,
  ClipboardList,
  Info,
  ListChecks,
  Route,
  Wallet,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Field, Panel, Segmented, Stat, selectClass } from "@/components/calculator-ui"
import { HomeAdvisorChecklist } from "@/components/home-advisor-checklist"
import { cn } from "@/lib/utils"
import {
  COMPONENT_BY_ID,
  PRIORITY_LABELS,
  PRIORITY_NOTES,
  VERDICT_META,
  VERDICT_ORDER,
  computeAdvice,
  formatMoney,
  initialComponentState,
  type ComponentId,
  type Condition,
  type Priority,
  type ScenarioId,
  type Verdict,
} from "@/lib/home-advisor"

const PRIORITY_ORDER: Priority[] = [
  "balanced",
  "safety",
  "repairs",
  "energy",
  "comfort",
  "appearance",
  "resale",
]

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
  const [homeSize, setHomeSize] = useState("1800")
  const [stories, setStories] = useState("1")
  const [yearsStaying, setYearsStaying] = useState("10")
  const [budget, setBudget] = useState("")
  const [priority, setPriority] = useState<Priority>("balanced")
  const [components, setComponents] = useState(initialComponentState)
  const [expanded, setExpanded] = useState<ComponentId | null>(null)
  const [scenario, setScenario] = useState<ScenarioId>("protect")

  const result = useMemo(
    () =>
      computeAdvice({
        zip,
        yearBuilt: Number.parseInt(yearBuilt, 10) || 0,
        homeSize: Number.parseFloat(homeSize) || 0,
        stories: Number.parseInt(stories, 10) || 1,
        yearsStaying: Number.parseInt(yearsStaying, 10) || 10,
        budget: Number.parseFloat(budget) || 0,
        priority,
        components,
      }),
    [zip, yearBuilt, homeSize, stories, yearsStaying, budget, priority, components],
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

  const active = result.scenarios.find((s) => s.id === scenario) ?? result.scenarios[0]

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
          Tell us about your home and which systems concern you, and this ranks what to
          fix first by urgency, risk of waiting, payback and resale impact — then builds a
          plan around your budget.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ---------------- Inputs ---------------- */}
        <div className="flex flex-col gap-6">
          <Panel title="Your home" icon={<ClipboardList className="size-4" aria-hidden="true" />}>
            <div className="grid gap-4 sm:grid-cols-2">
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
              <Field label="Finished size (sq ft)" htmlFor="advisor-size">
                <Input
                  id="advisor-size"
                  inputMode="numeric"
                  value={homeSize}
                  onChange={(e) => setHomeSize(e.target.value.replace(/[^\d.]/g, ""))}
                />
              </Field>
              <Field label="Stories" htmlFor="advisor-stories">
                <select
                  id="advisor-stories"
                  className={selectClass}
                  value={stories}
                  onChange={(e) => setStories(e.target.value)}
                >
                  <option value="1">1 story</option>
                  <option value="2">2 stories</option>
                  <option value="3">3 stories</option>
                </select>
              </Field>
              <Field
                label="Years you plan to stay"
                htmlFor="advisor-stay"
                hint="Used to judge whether an upgrade pays back before you move."
              >
                <Input
                  id="advisor-stay"
                  inputMode="numeric"
                  value={yearsStaying}
                  onChange={(e) => setYearsStaying(e.target.value.replace(/\D/g, "").slice(0, 2))}
                />
              </Field>
              <Field
                label="Budget (optional)"
                htmlFor="advisor-budget"
                hint="Leave blank to see every plan regardless of cost."
              >
                <Input
                  id="advisor-budget"
                  inputMode="numeric"
                  placeholder="e.g. 15000"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value.replace(/[^\d.]/g, ""))}
                />
              </Field>
            </div>

            <div className="mt-4">
              <Field label="What matters most to you" hint={PRIORITY_NOTES[priority]}>
                <Segmented
                  ariaLabel="Homeowner priority"
                  value={priority}
                  onChange={setPriority}
                  options={PRIORITY_ORDER.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))}
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
                Check a system on the left to see what to fix first, what it costs, and how
                the work should be sequenced.
              </p>
            </Panel>
          ) : (
            <>
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
                    sub={`Across ${result.assessedCount} system(s)`}
                  />
                  {result.totals.annualSavings > 0 ? (
                    <Stat
                      label="Est. annual energy savings"
                      value={`${formatMoney(result.totals.annualSavings)}/yr`}
                    />
                  ) : null}
                  {result.totals.valueAdd > 0 ? (
                    <Stat
                      label="Est. resale value added"
                      value={formatMoney(result.totals.valueAdd)}
                    />
                  ) : null}
                </div>
              </Panel>

              <Panel title="Compare plans" icon={<Wallet className="size-4" aria-hidden="true" />}>
                <Segmented
                  ariaLabel="Scenario"
                  value={scenario}
                  onChange={setScenario}
                  options={result.scenarios.map((s) => ({ value: s.id, label: s.label }))}
                />
                {active ? (
                  <div className="mt-4 flex flex-col gap-3">
                    <p className="text-sm font-medium">{active.question}</p>
                    <p className="text-sm leading-relaxed text-muted-foreground">{active.blurb}</p>
                    <Stat
                      label="Plan cost"
                      value={range(active.cost.low, active.cost.high)}
                      sub={
                        active.fitsBudget === null
                          ? undefined
                          : active.fitsBudget
                            ? "Fits the budget you entered"
                            : "Over the budget you entered"
                      }
                      emphasis
                    />
                    {active.phases && active.phases.length > 0 ? (
                      <ul className="flex flex-col gap-2 border-t border-border pt-3">
                        {active.phases.map((phase) => (
                          <li key={phase.label} className="flex items-baseline justify-between gap-3">
                            <span className="text-sm text-muted-foreground">{phase.label}</span>
                            <span className="text-sm font-medium tabular-nums">
                              {range(phase.cost.low, phase.cost.high)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : active.ids.length > 0 ? (
                      <ul className="flex flex-col gap-1.5 border-t border-border pt-3">
                        {active.ids.map((id) => (
                          <li key={id} className="text-sm text-muted-foreground">
                            {COMPONENT_BY_ID[id].label}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </Panel>
            </>
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
                      {a.why.length > 0 ? (
                        <ul className="mt-2 flex flex-col gap-1">
                          {a.why.map((w, i) => (
                            <li key={i} className="text-sm leading-relaxed text-muted-foreground">
                              — {w}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {a.remainingLife !== null ? (
                          <span>~{a.remainingLife} yr of life left</span>
                        ) : null}
                        {a.paybackYears !== null ? (
                          <span>{a.paybackYears} yr payback</span>
                        ) : null}
                        {a.annualSavings > 0 ? (
                          <span>{formatMoney(a.annualSavings)}/yr saved</span>
                        ) : null}
                        {a.resaleValueAdd > 0 ? (
                          <span>{formatMoney(a.resaleValueAdd)} at resale</span>
                        ) : null}
                        {a.ageInferred ? <span>Age assumed from year built</span> : null}
                      </div>
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
