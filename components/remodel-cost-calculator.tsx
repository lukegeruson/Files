"use client"

// Remodeling Cost Calculator — "what will this project cost?"
//
// Starts with the project type because that is how homeowners actually think,
// then narrows by location, size, condition, scope, finish level and who is
// doing the work. All pricing lives in lib/remodel.ts.

import { useMemo, useState } from "react"
import {
  Bath,
  ChefHat,
  Info,
  Layers,
  ListTree,
  PieChart,
  Ruler,
  TrendingUp,
  Waves,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Field, Panel, Segmented, Stat } from "@/components/calculator-ui"
import { RemodelItemPicker } from "@/components/remodel-item-picker"
import { cn } from "@/lib/utils"
import {
  CONDITION_LABELS,
  FINISH_LABELS,
  FINISH_NOTES,
  LABOR_LABELS,
  LABOR_NOTES,
  PROJECTS,
  PROJECT_BY_ID,
  estimate,
  formatMoney,
  initialItemState,
  type Condition,
  type Finish,
  type LaborMode,
  type ProjectId,
  type ScopeId,
} from "@/lib/remodel"

const PROJECT_ICON: Record<ProjectId, React.ReactNode> = {
  bathroom: <Bath className="size-5" aria-hidden="true" />,
  kitchen: <ChefHat className="size-5" aria-hidden="true" />,
  hottub: <Waves className="size-5" aria-hidden="true" />,
}

const CONDITIONS: Condition[] = ["good", "dated", "worn", "damaged"]
const FINISHES: Finish[] = ["basic", "mid", "premium"]
const LABOR_MODES: LaborMode[] = ["diy", "trades", "gc"]

export function RemodelCostCalculator() {
  const [project, setProject] = useState<ProjectId>("bathroom")
  const [scope, setScope] = useState<ScopeId>("standard")
  const [zip, setZip] = useState("")
  const [size, setSize] = useState("40")
  const [condition, setCondition] = useState<Condition>("dated")
  const [finish, setFinish] = useState<Finish>("mid")
  const [labor, setLabor] = useState<LaborMode>("gc")
  const [items, setItems] = useState(() => initialItemState("bathroom", "standard"))
  const [expanded, setExpanded] = useState<string | null>(null)
  const [contingency, setContingency] = useState<number | null>(null)

  const def = PROJECT_BY_ID[project]
  const sizeNum = Number.parseFloat(size) || 0

  const result = useMemo(
    () =>
      estimate({
        project,
        zip,
        size: sizeNum,
        scope,
        condition,
        finish,
        labor,
        items,
        contingencyPercent: contingency,
      }),
    [project, zip, sizeNum, scope, condition, finish, labor, items, contingency],
  )

  const lineTotals = useMemo(
    () => new Map(result.lines.map((l) => [l.id as string, l.total])),
    [result.lines],
  )

  /** Switching project resets scope, size and the whole line-item set. */
  function chooseProject(next: ProjectId) {
    const nextDef = PROJECT_BY_ID[next]
    const nextScope: ScopeId = nextDef.scopes.some((s) => s.id === "standard")
      ? "standard"
      : nextDef.scopes[0].id
    setProject(next)
    setScope(nextScope)
    setSize(String(nextDef.sizePresets[1].value))
    setItems(initialItemState(next, nextScope))
    setExpanded(null)
  }

  /** Changing scope re-applies that scope's default line items. */
  function chooseScope(next: ScopeId) {
    setScope(next)
    setItems(initialItemState(project, next))
    setExpanded(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h2 className="font-serif text-2xl font-semibold tracking-tight md:text-3xl">
          Remodeling Cost Calculator
        </h2>
        <p className="max-w-3xl text-pretty leading-relaxed text-muted-foreground">
          Estimate what a bathroom remodel, kitchen remodel or hot tub installation costs in
          your area — broken into materials, labor, permits, demolition, overhead and
          contingency, with a realistic range instead of a single fake number.
        </p>
      </header>

      {/* ---------------- Project selector ---------------- */}
      <div
        role="radiogroup"
        aria-label="Project type"
        className="grid gap-3 sm:grid-cols-3"
      >
        {PROJECTS.map((p) => {
          const active = p.id === project
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => chooseProject(p.id)}
              className={cn(
                "flex flex-col gap-2 rounded-lg border p-4 text-left transition-colors",
                active
                  ? "border-primary bg-primary/10"
                  : "border-input bg-card hover:border-ring",
              )}
            >
              <span
                className={cn(
                  "flex items-center gap-2 font-serif text-lg font-semibold",
                  active ? "text-foreground" : "text-foreground/80",
                )}
              >
                {PROJECT_ICON[p.id]}
                {p.label}
              </span>
              <span className="text-sm leading-relaxed text-muted-foreground">{p.blurb}</span>
            </button>
          )
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* ---------------- Inputs ---------------- */}
        <div className="flex flex-col gap-6">
          <Panel title="Project basics" icon={<Ruler className="size-4" aria-hidden="true" />}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="ZIP code"
                htmlFor="rm-zip"
                hint={
                  result.region.isFallback
                    ? "Using national average pricing until a ZIP is entered."
                    : `${result.region.stateName} runs about ${Math.round(
                        (result.region.index - 1) * 100,
                      )}% ${result.region.index >= 1 ? "above" : "below"} the national average.`
                }
              >
                <Input
                  id="rm-zip"
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="e.g. 80301"
                  value={zip}
                  onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                />
              </Field>

              <Field
                label={`${def.sizeLabel} (${def.sizeUnit})`}
                htmlFor="rm-size"
                hint="Quantities for tile, flooring and cabinets are sized from this."
              >
                <Input
                  id="rm-size"
                  inputMode="decimal"
                  value={size}
                  onChange={(e) => setSize(e.target.value.replace(/[^\d.]/g, ""))}
                />
              </Field>
            </div>

            <div className="mt-4 flex flex-col gap-4">
              <Field label="Or start from a typical size">
                <Segmented
                  ariaLabel="Size preset"
                  value={size}
                  onChange={setSize}
                  options={def.sizePresets.map((p) => ({
                    value: String(p.value),
                    label: `${p.label} · ${p.value} ${def.sizeUnit}`,
                  }))}
                />
              </Field>

              <Field
                label="Scope of work"
                hint={def.scopes.find((s) => s.id === scope)?.blurb}
              >
                <Segmented
                  ariaLabel="Scope of work"
                  value={scope}
                  onChange={chooseScope}
                  options={def.scopes.map((s) => ({ value: s.id, label: s.label }))}
                />
              </Field>

              <Field
                label="Current condition"
                hint="Drives demolition, disposal and how much contingency you should carry."
              >
                <Segmented
                  ariaLabel="Current condition"
                  value={condition}
                  onChange={setCondition}
                  options={CONDITIONS.map((c) => ({ value: c, label: CONDITION_LABELS[c] }))}
                />
              </Field>

              <Field label="Finish level" hint={FINISH_NOTES[finish]}>
                <Segmented
                  ariaLabel="Finish level"
                  value={finish}
                  onChange={setFinish}
                  options={FINISHES.map((f) => ({ value: f, label: FINISH_LABELS[f] }))}
                />
              </Field>

              <Field label="Who is doing the work" hint={LABOR_NOTES[labor]}>
                <Segmented
                  ariaLabel="Labor approach"
                  value={labor}
                  onChange={setLabor}
                  options={LABOR_MODES.map((m) => ({ value: m, label: LABOR_LABELS[m] }))}
                />
              </Field>

              <Field
                label={`Contingency — ${result.contingencyPercent}%`}
                htmlFor="rm-contingency"
                hint="Set from your condition answer. Slide it if you want a tighter or safer buffer."
              >
                <input
                  id="rm-contingency"
                  type="range"
                  min={0}
                  max={30}
                  step={1}
                  value={result.contingencyPercent}
                  onChange={(e) => setContingency(Number.parseInt(e.target.value, 10))}
                  className="w-full accent-primary"
                />
              </Field>
            </div>
          </Panel>

          <Panel title="What's included" icon={<ListTree className="size-4" aria-hidden="true" />}>
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
              Every row is a real cost line. Turn anything off, change its tier, or override the
              quantity — the estimate updates immediately.
            </p>
            <RemodelItemPicker
              project={project}
              size={sizeNum}
              items={items}
              expanded={expanded}
              totals={lineTotals}
              onToggle={(id) =>
                setItems((prev) => ({ ...prev, [id]: { ...prev[id], enabled: !prev[id].enabled } }))
              }
              onExpand={setExpanded}
              onQty={(id, qty) => setItems((prev) => ({ ...prev, [id]: { ...prev[id], qty } }))}
              onOption={(id, value) =>
                setItems((prev) => ({ ...prev, [id]: { ...prev[id], option: value } }))
              }
            />
          </Panel>
        </div>

        {/* ---------------- Results ---------------- */}
        <div className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
          <Panel
            title="Your estimate"
            icon={<TrendingUp className="size-4" aria-hidden="true" />}
          >
            {result.isEmpty ? (
              <p className="text-sm leading-relaxed text-muted-foreground">
                Turn on at least one line item to see an estimate.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                <Stat
                  label={`${def.label} · ${FINISH_LABELS[finish]}`}
                  value={`${formatMoney(result.range.low)} – ${formatMoney(result.range.high)}`}
                  sub={`Planning range, ±${result.spreadPercent}% on ${formatMoney(result.total)}`}
                  emphasis
                />
                {result.perSqFt ? (
                  <Stat
                    label="Cost per square foot"
                    value={`$${result.perSqFt.low} – $${result.perSqFt.high}`}
                    sub={`Across ${Math.round(sizeNum)} ${def.sizeUnit}`}
                  />
                ) : null}
                <Stat
                  label="Permits & inspections"
                  value={formatMoney(
                    result.buckets.find((b) => b.id === "permits")?.amount ?? 0,
                  )}
                  sub={
                    result.permitCount === 0
                      ? "Base permit only — no permitted trades selected"
                      : `Base permit plus ${result.permitCount} permitted trade${
                          result.permitCount === 1 ? "" : "s"
                        }`
                  }
                />
              </div>
            )}
          </Panel>

          {!result.isEmpty ? (
            <>
              <Panel
                title="Basic vs Mid vs Premium"
                icon={<Layers className="size-4" aria-hidden="true" />}
              >
                <ul className="flex flex-col">
                  {result.scenarios.map((s) => {
                    const active = s.finish === finish
                    return (
                      <li key={s.finish}>
                        <button
                          type="button"
                          onClick={() => setFinish(s.finish)}
                          aria-pressed={active}
                          className={cn(
                            "flex w-full items-baseline justify-between gap-3 border-t border-border py-3 text-left transition-colors",
                            active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <span className={cn("text-sm", active && "font-medium")}>{s.label}</span>
                          <span className="text-sm tabular-nums">
                            {formatMoney(s.range.low)} – {formatMoney(s.range.high)}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Same scope and same selections — only the finish level changes.
                </p>
              </Panel>

              <Panel
                title="Where the money goes"
                icon={<PieChart className="size-4" aria-hidden="true" />}
              >
                <ul className="flex flex-col">
                  {result.buckets.map((b) => {
                    const share = result.total > 0 ? b.amount / result.total : 0
                    return (
                      <li
                        key={b.id}
                        className="flex flex-col gap-1 border-t border-border py-3"
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-sm">{b.label}</span>
                          <span className="text-sm font-medium tabular-nums">
                            {formatMoney(b.amount)}
                          </span>
                        </div>
                        <div
                          className="h-1 w-full overflow-hidden rounded-full bg-muted"
                          role="presentation"
                        >
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.min(100, share * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {Math.round(share * 100)}% · {b.note}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </Panel>
            </>
          ) : null}
        </div>
      </div>

      {/* ---------------- Drivers & line items ---------------- */}
      {!result.isEmpty ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel
            title="Your biggest cost drivers"
            icon={<TrendingUp className="size-4" aria-hidden="true" />}
          >
            <ul className="flex flex-col">
              {result.drivers.map((d) => (
                <li key={d.label} className="flex flex-col gap-1 border-t border-border py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium">{d.label}</span>
                    <span className="text-sm tabular-nums">
                      {formatMoney(d.amount)} · {Math.round(d.share * 100)}%
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">{d.note}</p>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel
            title="Itemized breakdown"
            icon={<ListTree className="size-4" aria-hidden="true" />}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Materials and labor for each included line item
                </caption>
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="pb-2 font-medium">
                      Item
                    </th>
                    <th scope="col" className="pb-2 text-right font-medium">
                      Materials
                    </th>
                    <th scope="col" className="pb-2 text-right font-medium">
                      Labor
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.lines.map((l) => (
                    <tr key={l.id} className="border-t border-border">
                      <td className="py-2 pr-3">
                        <span className="block">{l.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {l.qty} {l.unit}
                          {l.optionLabel ? ` · ${l.optionLabel}` : ""}
                        </span>
                      </td>
                      <td className="py-2 text-right tabular-nums">{formatMoney(l.materials)}</td>
                      <td className="py-2 text-right tabular-nums">
                        {l.labor > 0 ? formatMoney(l.labor) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border font-medium">
                    <td className="py-2">Materials + labor</td>
                    <td className="py-2 text-right tabular-nums" colSpan={2}>
                      {formatMoney(result.subtotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Demolition, permits, overhead and contingency are listed separately in &ldquo;Where
              the money goes&rdquo; so nothing is buried inside a line item.
            </p>
          </Panel>
        </div>
      ) : null}

      <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          This is a planning estimate, not a contractor quote. It is built from national average
          material and labor costs scaled by a regional index, and it cannot see your framing,
          your plumbing stack, your local permit office or the condition behind your walls. Real
          bids on the same scope routinely vary by 30% or more. Get at least three written,
          itemized quotes before committing to a budget.
        </span>
      </p>
    </div>
  )
}
