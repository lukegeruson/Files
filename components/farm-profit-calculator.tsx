"use client"

import { useMemo, useState } from "react"
import {
  Calculator,
  ChevronDown,
  Coins,
  Gauge,
  Grid3x3,
  Layers,
  TrendingUp,
  Wallet,
} from "lucide-react"

import { CROPS, GROUP_LABELS, type CropGroup } from "@/lib/crops"
import {
  COST_META,
  EDITABLE_COST_IDS,
  SCENARIO_META,
  SECTION_LABELS,
  SECTION_ORDER,
  buildLevers,
  buildScenarios,
  buildSensitivity,
  computeProfit,
  formatPct,
  formatUnitPrice,
  formatUnits,
  formatUsd,
  inputsForCrop,
  type CostId,
  type CostSection,
  type ProfitInputs,
} from "@/lib/farm-profit"
import { Field, Panel, Segmented, Stat, selectClass } from "@/components/calculator-ui"

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

/**
 * Percent that `current` has to rise to reach `target`. A negative cushion
 * expressed as "-24%" reads as if something fell, so shortfalls are shown as
 * the climb still required instead.
 */
function gapToBreakEven(current: number, target: number): number {
  if (current <= 0) return 0
  return ((target - current) / current) * 100
}

function moneyTone(n: number): string {
  if (n > 0) return "text-primary"
  if (n < 0) return "text-destructive"
  return "text-muted-foreground"
}

/**
 * A number input that tolerates in-progress typing. Coercing on every
 * keystroke makes it impossible to clear a field or type "0.5", so the raw
 * string is held locally and only committed when it parses.
 */
function NumberInput({
  id,
  value,
  onCommit,
  min = 0,
  max = 10_000_000,
  step,
  prefix,
  suffix,
}: {
  id: string
  value: number
  onCommit: (n: number) => void
  min?: number
  max?: number
  step?: number
  prefix?: string
  suffix?: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? String(value)

  const commit = (raw: string) => {
    const n = Number(raw)
    if (raw.trim() === "" || Number.isNaN(n)) {
      setDraft(null)
      return
    }
    onCommit(Math.max(min, Math.min(max, n)))
    setDraft(null)
  }

  return (
    <div className="relative">
      {prefix ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
        >
          {prefix}
        </span>
      ) : null}
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={shown}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit((e.target as HTMLInputElement).value)
        }}
        className={`${selectClass} tabular-nums ${prefix ? "pl-7" : ""} ${suffix ? "pr-12" : ""}`}
      />
      {suffix ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground"
        >
          {suffix}
        </span>
      ) : null}
    </div>
  )
}

/** A collapsible group of budget lines. */
function BudgetSection({
  section,
  inputs,
  perAcre,
  onChange,
  open,
  onToggle,
}: {
  section: CostSection
  inputs: ProfitInputs
  perAcre: Record<CostId, number>
  onChange: (id: CostId, v: number) => void
  open: boolean
  onToggle: () => void
}) {
  const editable = EDITABLE_COST_IDS.filter((id) => COST_META[id].section === section)
  const derived = (Object.keys(COST_META) as CostId[]).filter(
    (id) => COST_META[id].section === section && COST_META[id].derived,
  )
  if (editable.length === 0 && derived.length === 0) return null

  const sectionTotal =
    editable.reduce((s, id) => s + (inputs.budget[id] || 0), 0) +
    derived.reduce((s, id) => s + (perAcre[id] || 0), 0)

  return (
    <div className="border-t border-border">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 py-3 text-left"
      >
        <span className="text-sm font-medium">{SECTION_LABELS[section]}</span>
        <span className="flex items-center gap-2">
          <span className="text-sm tabular-nums text-muted-foreground">
            {formatUsd(sectionTotal)}/ac
          </span>
          <ChevronDown
            className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </span>
      </button>

      {open ? (
        <div className="flex flex-col gap-3 pb-4">
          {editable.map((id) => (
            <Field key={id} label={COST_META[id].label} htmlFor={`cost-${id}`}>
              <NumberInput
                id={`cost-${id}`}
                value={inputs.budget[id] || 0}
                onCommit={(v) => onChange(id, v)}
                prefix="$"
                suffix="/ac"
                step={1}
              />
            </Field>
          ))}
          {derived.map((id) => (
            <div key={id} className="flex items-baseline justify-between gap-3 rounded-md bg-muted/50 px-3 py-2">
              <span className="text-xs text-muted-foreground">
                {COST_META[id].label}
                <span className="ml-1.5 rounded bg-background px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                  calculated
                </span>
              </span>
              <span className="text-sm tabular-nums">{formatUsd(perAcre[id] || 0)}/ac</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Main component
 * ------------------------------------------------------------------ */

export function FarmProfitCalculator({ initialInputs }: { initialInputs?: ProfitInputs }) {
  const [inputs, setInputs] = useState<ProfitInputs>(
    () => initialInputs ?? inputsForCrop("corn", 400),
  )
  const [openSection, setOpenSection] = useState<CostSection | null>("inputs")

  const set = <K extends keyof ProfitInputs>(key: K, value: ProfitInputs[K]) =>
    setInputs((prev) => ({ ...prev, [key]: value }))

  const setCost = (id: CostId, value: number) =>
    setInputs((prev) => ({ ...prev, budget: { ...prev.budget, [id]: value } }))

  /** Switching crop replaces the whole budget, since it is crop-specific. */
  const onCrop = (cropId: string) =>
    setInputs((prev) => (cropId === prev.cropId ? prev : inputsForCrop(cropId, prev.acres)))

  const result = useMemo(() => computeProfit(inputs), [inputs])
  const scenarios = useMemo(() => buildScenarios(inputs), [inputs])
  const sensitivity = useMemo(() => buildSensitivity(inputs), [inputs])
  const levers = useMemo(() => buildLevers(inputs), [inputs])

  const perAcreById = useMemo(() => {
    const m = {} as Record<CostId, number>
    for (const line of result.lines) m[line.id] = line.perAcre
    return m
  }, [result.lines])

  const topCosts = useMemo(
    () => [...result.lines].filter((l) => l.perAcre > 0).sort((a, b) => b.perAcre - a.perAcre),
    [result.lines],
  )

  const grouped = useMemo(() => {
    const m = new Map<CropGroup, typeof CROPS>()
    for (const c of CROPS) {
      const list = m.get(c.group) ?? []
      list.push(c)
      m.set(c.group, list)
    }
    return [...m.entries()]
  }, [])

  const profitable = result.profitPerAcre >= 0

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-primary">
          <Calculator className="size-5" aria-hidden="true" />
          <span className="text-xs font-semibold uppercase tracking-widest">
            Farm profitability calculator
          </span>
        </div>
        <h2 className="font-serif text-3xl font-semibold text-balance md:text-4xl">
          Will this crop actually make money?
        </h2>
        <p className="max-w-3xl text-pretty leading-relaxed text-muted-foreground">
          A full enterprise budget: every cost line from seed to land rent, your break-even price and
          yield, how much room you have before the crop stops paying, and which single change would
          improve the bottom line most.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:items-start">
        {/* ---------------- Inputs ---------------- */}
        <div className="flex flex-col gap-6 lg:sticky lg:top-24">
          <Panel title="The enterprise" icon={<Layers className="size-4" aria-hidden="true" />}>
            <div className="flex flex-col gap-4">
              <Field
                label="Crop"
                htmlFor="fp-crop"
                hint="Loads a research-based starting budget you can edit line by line."
              >
                <select
                  id="fp-crop"
                  value={inputs.cropId}
                  onChange={(e) => onCrop(e.target.value)}
                  className={selectClass}
                >
                  {grouped.map(([group, list]) => (
                    <optgroup key={group} label={GROUP_LABELS[group]}>
                      {list.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                  <optgroup label="Other">
                    <option value="custom">Custom crop</option>
                  </optgroup>
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Acres" htmlFor="fp-acres">
                  <NumberInput
                    id="fp-acres"
                    value={inputs.acres}
                    onCommit={(v) => set("acres", v)}
                    min={1}
                    max={20000}
                    step={1}
                  />
                </Field>
                <Field label={`Yield / acre (${inputs.yieldUnit})`} htmlFor="fp-yield">
                  <NumberInput
                    id="fp-yield"
                    value={inputs.yieldPerAcre}
                    onCommit={(v) => set("yieldPerAcre", v)}
                    step={1}
                  />
                </Field>
              </div>

              <Field
                label={`Price per ${inputs.yieldUnit}`}
                htmlFor="fp-price"
                hint={`Break-even is ${formatUnitPrice(result.breakEvenPrice)} covering every cost.`}
              >
                <NumberInput
                  id="fp-price"
                  value={inputs.pricePerUnit}
                  onCommit={(v) => set("pricePerUnit", v)}
                  prefix="$"
                  step={0.01}
                />
              </Field>
            </div>
          </Panel>

          <Panel title="Labor and financing" icon={<Wallet className="size-4" aria-hidden="true" />}>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Labor hours / acre" htmlFor="fp-hours">
                  <NumberInput
                    id="fp-hours"
                    value={inputs.laborHoursPerAcre}
                    onCommit={(v) => set("laborHoursPerAcre", v)}
                    max={2000}
                    step={0.5}
                  />
                </Field>
                <Field label="Wage rate" htmlFor="fp-rate">
                  <NumberInput
                    id="fp-rate"
                    value={inputs.laborRate}
                    onCommit={(v) => set("laborRate", v)}
                    max={200}
                    prefix="$"
                    suffix="/hr"
                    step={0.5}
                  />
                </Field>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Charge your own hours too. Labor you do not pay yourself for is still a real cost,
                and leaving it out is the most common way a budget flatters a crop.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Operating rate" htmlFor="fp-interest">
                  <NumberInput
                    id="fp-interest"
                    value={inputs.interestRatePct}
                    onCommit={(v) => set("interestRatePct", v)}
                    max={40}
                    suffix="%"
                    step={0.25}
                  />
                </Field>
                <Field label="Months carried" htmlFor="fp-months">
                  <NumberInput
                    id="fp-months"
                    value={inputs.interestMonths}
                    onCommit={(v) => set("interestMonths", v)}
                    max={24}
                    step={1}
                  />
                </Field>
              </div>
            </div>
          </Panel>

          <Panel
            title="Cost budget"
            icon={<Coins className="size-4" aria-hidden="true" />}
            className="pb-2"
          >
            <p className="mb-1 text-xs leading-relaxed text-muted-foreground">
              Every figure is per acre. Adjust any line to match your own numbers.
            </p>
            <div>
              {SECTION_ORDER.map((section) => (
                <BudgetSection
                  key={section}
                  section={section}
                  inputs={inputs}
                  perAcre={perAcreById}
                  onChange={setCost}
                  open={openSection === section}
                  onToggle={() => setOpenSection((cur) => (cur === section ? null : section))}
                />
              ))}
            </div>
          </Panel>

          <Panel title="Scenario range" icon={<Gauge className="size-4" aria-hidden="true" />}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Yield swing" htmlFor="fp-yswing">
                <NumberInput
                  id="fp-yswing"
                  value={inputs.yieldSwingPct}
                  onCommit={(v) => set("yieldSwingPct", v)}
                  max={90}
                  suffix="%"
                  step={1}
                />
              </Field>
              <Field label="Price swing" htmlFor="fp-pswing">
                <NumberInput
                  id="fp-pswing"
                  value={inputs.priceSwingPct}
                  onCommit={(v) => set("priceSwingPct", v)}
                  max={90}
                  suffix="%"
                  step={1}
                />
              </Field>
            </div>
          </Panel>
        </div>

        {/* ---------------- Results ---------------- */}
        <div className="flex flex-col gap-6">
          {/* Headline */}
          <section
            className={`rounded-lg border p-5 ${
              profitable ? "border-primary/40 bg-primary/5" : "border-destructive/40 bg-destructive/5"
            }`}
            aria-live="polite"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {inputs.cropName} · {inputs.acres.toLocaleString()} ac
            </p>
            <p className="mt-2 font-serif text-4xl font-semibold tabular-nums leading-none md:text-5xl">
              <span className={moneyTone(result.profitPerAcre)}>
                {formatUsd(result.profitPerAcre)}
              </span>
              <span className="ml-2 align-middle text-base font-normal text-muted-foreground">
                net per acre
              </span>
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {profitable ? (
                <>
                  Covers every cost including land, machinery, and your own labor, returning{" "}
                  <strong className="font-medium text-foreground">
                    {formatUsd(result.totalProfit)}
                  </strong>{" "}
                  across {inputs.acres.toLocaleString()} acres.
                </>
              ) : (
                <>
                  Does not cover full cost. The shortfall is{" "}
                  <strong className="font-medium text-foreground">
                    {formatUsd(Math.abs(result.totalProfit))}
                  </strong>{" "}
                  across {inputs.acres.toLocaleString()} acres — most often land rent, machinery, or
                  unpaid labor finally being counted.
                </>
              )}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 md:grid-cols-4">
              <Stat label="Revenue / ac" value={formatUsd(result.revenuePerAcre)} />
              <Stat label="Total cost / ac" value={formatUsd(result.totalCostPerAcre)} />
              <Stat
                label="Gross margin / ac"
                value={formatUsd(result.grossMarginPerAcre)}
                sub="Above variable cost"
              />
              <Stat
                label="Return on cost"
                value={`${result.roiPct >= 0 ? "" : "-"}${Math.abs(Math.round(result.roiPct))}%`}
              />
            </div>
          </section>

          {/* Break-even */}
          <Panel title="Break-even and cushion" icon={<Gauge className="size-4" aria-hidden="true" />}>
            <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
              <Stat
                label="Break-even price"
                value={`${formatUnitPrice(result.breakEvenPrice)} / ${inputs.yieldUnit}`}
                sub={`${formatUnitPrice(result.breakEvenPriceVariable)} covers variable cost only`}
                emphasis
              />
              <Stat
                label="Break-even yield"
                value={formatUnits(result.breakEvenYield, inputs.yieldUnit)}
                sub={`${formatUnits(result.breakEvenYieldVariable, inputs.yieldUnit)} covers variable cost only`}
                emphasis
              />
              <Stat
                label="Price cushion"
                value={
                  result.priceCushionPct >= 0
                    ? `${Math.round(result.priceCushionPct)}% to spare`
                    : `Needs ${Math.round(gapToBreakEven(inputs.pricePerUnit, result.breakEvenPrice))}% more`
                }
                sub={
                  result.priceCushionPct >= 0
                    ? "How far price can fall before you stop covering full cost"
                    : `Price has to reach ${formatUnitPrice(result.breakEvenPrice)} to break even`
                }
              />
              <Stat
                label="Yield cushion"
                value={
                  result.yieldCushionPct >= 0
                    ? `${Math.round(result.yieldCushionPct)}% to spare`
                    : `Needs ${Math.round(gapToBreakEven(inputs.yieldPerAcre, result.breakEvenYield))}% more`
                }
                sub={
                  result.yieldCushionPct >= 0
                    ? "How much yield you can lose and still cover full cost"
                    : `Yield has to reach ${formatUnits(result.breakEvenYield, inputs.yieldUnit)} to break even`
                }
              />
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Cost per unit produced is{" "}
              <strong className="font-medium text-foreground">
                {formatUnitPrice(result.costPerUnit)}
              </strong>
              , and the crop needs{" "}
              <strong className="font-medium text-foreground">
                {formatUsd(result.minRevenueRequired)}
              </strong>{" "}
              of total revenue to break even.
            </p>
          </Panel>

          {/* Scenarios */}
          <Panel title="Three ways this season could go" icon={<Layers className="size-4" aria-hidden="true" />}>
            <div className="grid gap-3 sm:grid-cols-3">
              {scenarios.map((s) => {
                const isExpected = s.id === "expected"
                return (
                  <div
                    key={s.id}
                    className={`flex flex-col gap-1 rounded-md border p-4 ${
                      isExpected ? "border-primary/50 bg-primary/5" : "border-border bg-card"
                    }`}
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {SCENARIO_META[s.id].label}
                    </span>
                    <span
                      className={`font-serif text-2xl font-semibold tabular-nums ${moneyTone(s.result.profitPerAcre)}`}
                    >
                      {formatUsd(s.result.profitPerAcre)}
                    </span>
                    <span className="text-xs text-muted-foreground">per acre</span>
                    <span className="mt-2 text-xs leading-relaxed tabular-nums text-muted-foreground">
                      {formatUnits(s.yieldPerAcre, inputs.yieldUnit)} @{" "}
                      {formatUnitPrice(s.pricePerUnit)}
                    </span>
                    <span className="text-xs leading-relaxed tabular-nums text-muted-foreground">
                      {formatUsd(s.result.totalProfit)} total
                    </span>
                  </div>
                )
              })}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Worst and best move yield and price together, which is the honest way to plan: a short
              crop and a weak market often arrive in the same year.
            </p>
          </Panel>

          {/* Sensitivity */}
          <Panel title="Price and yield sensitivity" icon={<Grid3x3 className="size-4" aria-hidden="true" />}>
            <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
              Net profit per acre at every combination. Shaded cells lose money.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <caption className="sr-only">
                  Net profit per acre by price per {inputs.yieldUnit} and yield per acre
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="p-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Yield \ Price
                    </th>
                    {sensitivity.priceSteps.map((p) => (
                      <th
                        key={p}
                        scope="col"
                        className="p-2 text-right text-xs font-medium tabular-nums text-muted-foreground"
                      >
                        {formatUnitPrice(p)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sensitivity.yieldSteps.map((y, yi) => (
                    <tr key={y} className="border-t border-border">
                      <th
                        scope="row"
                        className="whitespace-nowrap p-2 text-left text-xs font-medium tabular-nums text-muted-foreground"
                      >
                        {formatUnits(y, inputs.yieldUnit)}
                      </th>
                      {sensitivity.grid[yi].map((cell, pi) => (
                        <td
                          key={pi}
                          className={`p-2 text-right tabular-nums ${
                            cell.aboveBreakEven
                              ? "text-foreground"
                              : "bg-destructive/10 text-destructive"
                          }`}
                        >
                          {formatUsd(cell.profitPerAcre)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          {/* Cost structure */}
          <Panel title="Where the money goes" icon={<Coins className="size-4" aria-hidden="true" />}>
            <ul className="flex flex-col gap-2.5">
              {topCosts.map((line) => (
                <li key={line.id} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm">
                      {line.label}
                      <span className="ml-2 text-xs uppercase tracking-wide text-muted-foreground">
                        {line.kind}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm tabular-nums">
                      {formatUsd(line.perAcre)}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {Math.round(line.shareOfTotal)}%
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={line.kind === "fixed" ? "h-full bg-muted-foreground" : "h-full bg-primary"}
                      style={{ width: `${Math.max(1, line.shareOfTotal)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-1 border-t border-border pt-4 sm:grid-cols-4">
              <div className="flex flex-col">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Variable</dt>
                <dd className="text-sm tabular-nums">{formatUsd(result.variablePerAcre)}/ac</dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Fixed</dt>
                <dd className="text-sm tabular-nums">{formatUsd(result.fixedPerAcre)}/ac</dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Total variable
                </dt>
                <dd className="text-sm tabular-nums">{formatUsd(result.variableTotal)}</dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Total fixed</dt>
                <dd className="text-sm tabular-nums">{formatUsd(result.fixedTotal)}</dd>
              </div>
            </dl>
          </Panel>

          {/* Levers */}
          <Panel title="What would improve this the most" icon={<TrendingUp className="size-4" aria-hidden="true" />}>
            <ul className="flex flex-col divide-y divide-border">
              {levers.map((lever) => (
                <li key={lever.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{lever.label}</span>
                    <span className="text-xs leading-relaxed text-muted-foreground">
                      {lever.detail}
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end">
                    <span className={`text-sm font-medium tabular-nums ${moneyTone(lever.deltaTotal)}`}>
                      {lever.deltaTotal >= 0 ? "+" : ""}
                      {formatUsd(lever.deltaTotal)}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {formatUsd(lever.newProfitPerAcre)}/ac
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Each line changes one thing and holds everything else steady. Adding acres is listed
              last on purpose: it multiplies whatever the per-acre result already is, so it grows a
              loss just as readily as a profit.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  )
}
