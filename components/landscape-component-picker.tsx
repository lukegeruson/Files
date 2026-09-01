"use client"

// The component selector for the Landscape Cost Calculator.
// Each project component only reveals the measurements it actually needs,
// which is what keeps a 19-component estimator from overwhelming a homeowner.

import { Check, ChevronDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { selectClass } from "@/components/calculator-ui"
import { cn } from "@/lib/utils"
import {
  COMPONENTS,
  GROUP_LABELS,
  type ComponentId,
  type ComponentState,
  type GroupId,
  type NumericKey,
} from "@/lib/landscaping"

const GROUP_ORDER: GroupId[] = ["lawn", "beds", "plants", "hardscape", "systems", "site"]

export function LandscapeComponentPicker({
  components,
  expanded,
  onToggle,
  onExpand,
  onNumber,
  onOption,
  lineTotals,
}: {
  components: Record<ComponentId, ComponentState>
  expanded: ComponentId | null
  onToggle: (id: ComponentId) => void
  onExpand: (id: ComponentId | null) => void
  onNumber: (id: ComponentId, key: NumericKey, value: number) => void
  onOption: (id: ComponentId, value: string) => void
  lineTotals: Map<ComponentId, number>
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
              const total = lineTotals.get(def.id)
              const hasControls = def.fields.length > 0 || Boolean(def.options)

              return (
                <div
                  key={def.id}
                  className={cn(
                    "rounded-md border transition-colors",
                    state.enabled ? "border-primary/50 bg-primary/5" : "border-border bg-card",
                  )}
                >
                  <div className="flex items-center gap-3 p-3">
                    {/* Toggle */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={state.enabled}
                      onClick={() => {
                        onToggle(def.id)
                        if (!state.enabled && hasControls) onExpand(def.id)
                      }}
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded border transition-colors",
                        state.enabled
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background hover:border-ring",
                      )}
                    >
                      {state.enabled ? (
                        <Check className="size-3.5" aria-hidden="true" />
                      ) : null}
                      <span className="sr-only">
                        {state.enabled ? `Remove ${def.label}` : `Add ${def.label}`}
                      </span>
                    </button>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">{def.label}</p>
                      <p className="text-xs leading-relaxed text-muted-foreground">{def.blurb}</p>
                    </div>

                    {state.enabled && total !== undefined ? (
                      <span className="shrink-0 font-serif text-sm tabular-nums text-foreground">
                        ${Math.round(total).toLocaleString("en-US")}
                      </span>
                    ) : null}

                    {state.enabled && hasControls ? (
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

                  {/* Only the relevant measurements for this component */}
                  {state.enabled && isOpen && hasControls ? (
                    <div className="border-t border-border/60 p-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        {def.fields.map((field) => {
                          const id = `lc-${def.id}-${field.key}`
                          return (
                            <div key={field.key} className="flex flex-col gap-1.5">
                              <label
                                htmlFor={id}
                                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                              >
                                {field.label} ({field.unit})
                              </label>
                              <Input
                                id={id}
                                inputMode="decimal"
                                step={field.step}
                                value={state[field.key] === 0 ? "" : String(state[field.key])}
                                placeholder="0"
                                onChange={(e) =>
                                  onNumber(
                                    def.id,
                                    field.key,
                                    Number.parseFloat(e.target.value) || 0,
                                  )
                                }
                              />
                              {field.hint ? (
                                <p className="text-xs text-muted-foreground">{field.hint}</p>
                              ) : null}
                            </div>
                          )
                        })}

                        {def.options ? (
                          <div className="flex flex-col gap-1.5">
                            <label
                              htmlFor={`lc-${def.id}-option`}
                              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                            >
                              {def.options.label}
                            </label>
                            <select
                              id={`lc-${def.id}-option`}
                              className={selectClass}
                              value={state.option}
                              onChange={(e) => onOption(def.id, e.target.value)}
                            >
                              {def.options.choices.map((c) => (
                                <option key={c.value} value={c.value}>
                                  {c.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : null}
                      </div>

                      {def.diy !== "yes" && def.diyNote ? (
                        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                          {def.diy === "no" ? "Not recommended as DIY: " : "Partly DIY: "}
                          {def.diyNote}
                        </p>
                      ) : null}
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
