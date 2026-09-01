"use client"

// The component-by-component assessment for the Home Upgrade Advisor.
// Each system stays collapsed until the homeowner says it is worth assessing,
// which is what keeps a twenty-system audit from feeling like a tax form.

import { Check, ChevronDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Segmented } from "@/components/calculator-ui"
import { cn } from "@/lib/utils"
import {
  COMPONENTS,
  CONDITION_LABELS,
  GROUP_LABELS,
  GROUP_ORDER,
  type ComponentId,
  type ComponentState,
  type Condition,
  type Verdict,
} from "@/lib/home-advisor"

const CONDITION_ORDER: Condition[] = ["unknown", "good", "fair", "poor", "failing"]

const VERDICT_DOT: Record<Verdict, string> = {
  "repair-now": "bg-destructive",
  "replace-soon": "bg-chart-4",
  monitor: "bg-chart-3",
  upgrade: "bg-primary",
  none: "bg-muted-foreground/40",
}

export function HomeAdvisorChecklist({
  components,
  expanded,
  onToggle,
  onExpand,
  onAge,
  onCondition,
  onSymptom,
  onRecentRepair,
  verdicts,
  verdictLabels,
}: {
  components: Record<ComponentId, ComponentState>
  expanded: ComponentId | null
  onToggle: (id: ComponentId) => void
  onExpand: (id: ComponentId | null) => void
  onAge: (id: ComponentId, value: string) => void
  onCondition: (id: ComponentId, value: Condition) => void
  onSymptom: (id: ComponentId, symptomId: string) => void
  onRecentRepair: (id: ComponentId, value: boolean) => void
  verdicts: Map<ComponentId, Verdict>
  verdictLabels: Record<Verdict, string>
}) {
  return (
    <div className="flex flex-col gap-6">
      {GROUP_ORDER.map((group) => {
        const defs = COMPONENTS.filter((d) => d.group === group)
        return (
          <fieldset key={group} className="flex flex-col gap-2">
            <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {GROUP_LABELS[group]}
            </legend>

            {defs.map((def) => {
              const state = components[def.id]
              const isOpen = expanded === def.id
              const verdict = verdicts.get(def.id)
              const symptomCount = state.symptoms.length

              return (
                <div
                  key={def.id}
                  className={cn(
                    "rounded-md border transition-colors",
                    state.assessed ? "border-primary/50 bg-primary/5" : "border-border bg-card",
                  )}
                >
                  <div className="flex items-center gap-3 p-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={state.assessed}
                      onClick={() => {
                        onToggle(def.id)
                        if (!state.assessed) onExpand(def.id)
                      }}
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded border transition-colors",
                        state.assessed
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background hover:border-ring",
                      )}
                    >
                      {state.assessed ? <Check className="size-3.5" aria-hidden="true" /> : null}
                      <span className="sr-only">
                        {state.assessed ? `Remove ${def.label} from the assessment` : `Assess ${def.label}`}
                      </span>
                    </button>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">{def.label}</p>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {state.assessed
                          ? `${CONDITION_LABELS[state.condition]}${
                              state.age ? ` · ${state.age} yr` : " · age not set"
                            }${symptomCount > 0 ? ` · ${symptomCount} symptom${symptomCount === 1 ? "" : "s"}` : ""}`
                          : `Typical service life ${def.typicalLife} years`}
                      </p>
                    </div>

                    {state.assessed && verdict ? (
                      <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                        <span
                          className={cn("size-2 rounded-full", VERDICT_DOT[verdict])}
                          aria-hidden="true"
                        />
                        {verdictLabels[verdict]}
                      </span>
                    ) : null}

                    {state.assessed ? (
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => onExpand(isOpen ? null : def.id)}
                        className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <ChevronDown
                          className={cn("size-4 transition-transform", isOpen && "rotate-180")}
                          aria-hidden="true"
                        />
                        <span className="sr-only">
                          {isOpen ? "Hide" : "Edit"} {def.label} details
                        </span>
                      </button>
                    ) : null}
                  </div>

                  {state.assessed && isOpen ? (
                    <div className="flex flex-col gap-4 border-t border-border/60 p-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                          <label
                            htmlFor={`ha-${def.id}-age`}
                            className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                          >
                            {def.ageLabel} (years)
                          </label>
                          <Input
                            id={`ha-${def.id}-age`}
                            inputMode="numeric"
                            placeholder="Leave blank if original to the house"
                            value={state.age}
                            onChange={(e) => onAge(def.id, e.target.value)}
                          />
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            {def.lifeNote}
                          </p>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Condition today
                          </span>
                          <Segmented
                            ariaLabel={`${def.label} condition`}
                            value={state.condition}
                            onChange={(v) => onCondition(def.id, v)}
                            options={CONDITION_ORDER.map((c) => ({
                              value: c,
                              label: CONDITION_LABELS[c],
                            }))}
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Anything you have noticed? Check all that apply
                        </span>
                        <div className="flex flex-col gap-1.5">
                          {def.symptoms.map((symptom) => {
                            const checked = state.symptoms.includes(symptom.id)
                            const id = `ha-${def.id}-${symptom.id}`
                            return (
                              <label
                                key={symptom.id}
                                htmlFor={id}
                                className={cn(
                                  "flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2 text-sm transition-colors",
                                  checked
                                    ? "border-primary/60 bg-primary/10"
                                    : "border-input bg-background hover:border-ring",
                                )}
                              >
                                <input
                                  id={id}
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => onSymptom(def.id, symptom.id)}
                                  className="mt-0.5 size-4 shrink-0 accent-primary"
                                />
                                <span className="leading-snug">
                                  {symptom.label}
                                  {symptom.safety ? (
                                    <span className="ml-2 rounded bg-destructive/15 px-1.5 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-destructive">
                                      Safety
                                    </span>
                                  ) : null}
                                </span>
                              </label>
                            )
                          })}
                        </div>
                      </div>

                      <label
                        htmlFor={`ha-${def.id}-repair`}
                        className="flex cursor-pointer items-center gap-2.5 text-sm text-muted-foreground"
                      >
                        <input
                          id={`ha-${def.id}-repair`}
                          type="checkbox"
                          checked={state.recentRepair}
                          onChange={(e) => onRecentRepair(def.id, e.target.checked)}
                          className="size-4 shrink-0 accent-primary"
                        />
                        Repaired or serviced in the last two years
                      </label>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </fieldset>
        )
      })}
    </div>
  )
}
