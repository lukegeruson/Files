"use client"

// Line-item picker for the Remodeling Cost Calculator.
//
// Every row is a real cost line: toggle it off and the estimate drops, change
// its tier and the estimate moves. Rows stay collapsed until selected so the
// list reads as a scope of work rather than a spreadsheet.

import { Check, ChevronDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Segmented } from "@/components/calculator-ui"
import { cn } from "@/lib/utils"
import {
  GROUP_LABELS,
  GROUP_ORDER,
  formatMoney,
  itemsForProject,
  type ItemGroup,
  type ItemState,
  type ProjectId,
} from "@/lib/remodel"

const DIY_LABEL = {
  yes: "DIY friendly",
  partial: "Partly DIY",
  no: "Hire a pro",
} as const

const DIY_CLASS = {
  yes: "text-primary",
  partial: "text-chart-3",
  no: "text-muted-foreground",
} as const

export function RemodelItemPicker({
  project,
  size,
  items,
  expanded,
  totals,
  onToggle,
  onExpand,
  onQty,
  onOption,
}: {
  project: ProjectId
  size: number
  items: Record<string, ItemState>
  expanded: string | null
  /** id -> installed total, so each row can show what it contributes. */
  totals: Map<string, number>
  onToggle: (id: string) => void
  onExpand: (id: string | null) => void
  onQty: (id: string, qty: number | null) => void
  onOption: (id: string, value: string) => void
}) {
  const defs = itemsForProject(project)
  const groups = GROUP_ORDER.filter((g) => defs.some((d) => d.group === g))

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group: ItemGroup) => (
        <fieldset key={group} className="flex flex-col gap-2">
          <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {GROUP_LABELS[group]}
          </legend>

          {defs
            .filter((d) => d.group === group)
            .map((def) => {
              const state = items[def.id]
              if (!state) return null
              const isOpen = expanded === def.id
              const total = totals.get(def.id) ?? 0
              const autoQty = def.qty(size)
              const qty = state.qty ?? autoQty
              const hasDetail = Boolean(def.options) || def.unit !== "job"

              return (
                <div
                  key={def.id}
                  className={cn(
                    "rounded-md border transition-colors",
                    state.enabled ? "border-primary/40 bg-primary/5" : "border-input bg-background",
                  )}
                >
                  <div className="flex items-center gap-3 p-3">
                    {/* Include / exclude */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={state.enabled}
                      aria-label={`Include ${def.label}`}
                      onClick={() => onToggle(def.id)}
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
                    </button>

                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">{def.label}</span>
                      <span className={cn("text-xs", DIY_CLASS[def.diy])}>
                        {DIY_LABEL[def.diy]}
                        {def.permit ? " · permit required" : ""}
                      </span>
                    </div>

                    {state.enabled ? (
                      <span className="shrink-0 text-sm font-medium tabular-nums">
                        {formatMoney(total)}
                      </span>
                    ) : null}

                    {state.enabled && hasDetail ? (
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-label={`${isOpen ? "Hide" : "Show"} options for ${def.label}`}
                        onClick={() => onExpand(isOpen ? null : def.id)}
                        className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <ChevronDown
                          className={cn("size-4 transition-transform", isOpen && "rotate-180")}
                          aria-hidden="true"
                        />
                      </button>
                    ) : null}
                  </div>

                  {state.enabled && isOpen ? (
                    <div className="flex flex-col gap-3 border-t border-border/60 p-3">
                      {def.options ? (
                        <Segmented
                          ariaLabel={`${def.label} option`}
                          value={state.option ?? def.options[0].value}
                          onChange={(v) => onOption(def.id, v)}
                          options={def.options.map((o) => ({ value: o.value, label: o.label }))}
                        />
                      ) : null}

                      {def.unit !== "job" ? (
                        <div className="flex flex-wrap items-end gap-3">
                          <div className="flex flex-col gap-1.5">
                            <label
                              htmlFor={`qty-${def.id}`}
                              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                            >
                              {def.unit}
                            </label>
                            <Input
                              id={`qty-${def.id}`}
                              inputMode="decimal"
                              className="h-9 w-28"
                              value={String(qty)}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/[^\d.]/g, "")
                                onQty(def.id, raw === "" ? null : Number.parseFloat(raw))
                              }}
                            />
                          </div>
                          {state.qty !== null && state.qty !== autoQty ? (
                            <button
                              type="button"
                              onClick={() => onQty(def.id, null)}
                              className="pb-2 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                            >
                              Reset to {autoQty} {def.unit}
                            </button>
                          ) : (
                            <span className="pb-2 text-xs text-muted-foreground">
                              Sized from your project area
                            </span>
                          )}
                        </div>
                      ) : null}

                      <p className="text-xs leading-relaxed text-muted-foreground">{def.note}</p>
                    </div>
                  ) : null}
                </div>
              )
            })}
        </fieldset>
      ))}
    </div>
  )
}
