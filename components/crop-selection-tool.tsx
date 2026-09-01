"use client"

import { useMemo, useState } from "react"
import {
  Sprout,
  SlidersHorizontal,
  Trophy,
  Table2,
  Ban,
  ChevronDown,
  AlertTriangle,
  Calculator,
} from "lucide-react"

import {
  CAPITAL_LABELS,
  DRAINAGE_LABELS,
  EQUIPMENT_LABELS,
  FACTOR_LABELS,
  GROUP_LABELS,
  IRRIGATION_LABELS,
  LABOR_LABELS,
  LABOR_RATE,
  MARKET_LABELS,
  PH_LABELS,
  PRIORITY_LABELS,
  RANKING_META,
  SOIL_LABELS,
  STORAGE_LABELS,
  buildHandoff,
  defaultInputs,
  formatMoney,
  formatQty,
  resolveClimate,
  selectCrops,
  type CapitalLevel,
  type CropEvaluation,
  type Drainage,
  type EquipmentTier,
  type FarmInputs,
  type Irrigation,
  type LaborLevel,
  type MarketAccess,
  type PriorityId,
  type ProfitabilityHandoff,
  type SoilId,
  type SoilPh,
  type StorageLevel,
} from "@/lib/crops"
import { Field, Panel, Segmented, Stat, selectClass } from "@/components/calculator-ui"

const PRIORITY_IDS: PriorityId[] = [
  "profit",
  "risk",
  "water",
  "labor",
  "season",
  "market",
  "soil",
  "diversify",
]

type SortKey = "fit" | "profit" | "risk" | "water" | "labor" | "cost"

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "fit", label: "Fit" },
  { value: "profit", label: "Profit" },
  { value: "risk", label: "Risk" },
  { value: "water", label: "Water" },
  { value: "labor", label: "Labor" },
  { value: "cost", label: "Cost" },
]

function scoreTone(score: number): string {
  if (score >= 75) return "text-primary"
  if (score >= 50) return "text-foreground"
  return "text-muted-foreground"
}

/** A compact 0–100 meter used for factor scores. */
function Meter({ score }: { score: number }) {
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      role="img"
      aria-label={`Score ${score} out of 100`}
    >
      <div
        className={score >= 50 ? "h-full rounded-full bg-primary" : "h-full rounded-full bg-muted-foreground"}
        style={{ width: `${Math.max(3, score)}%` }}
      />
    </div>
  )
}

export function CropSelectionTool({
  onSendToProfit,
}: {
  /** When provided, each crop offers a handoff into the profitability calculator. */
  onSendToProfit?: (handoff: ProfitabilityHandoff) => void
} = {}) {
  const [inputs, setInputs] = useState<FarmInputs>(() => defaultInputs())
  // Tracks whether the farmer has hand-edited the climate figures, so a new ZIP
  // does not silently overwrite numbers they deliberately set.
  const [climateTouched, setClimateTouched] = useState(false)
  const [sort, setSort] = useState<SortKey>("fit")
  const [openCrop, setOpenCrop] = useState<string | null>(null)
  const [showRejected, setShowRejected] = useState(false)

  const set = <K extends keyof FarmInputs>(key: K, value: FarmInputs[K]) =>
    setInputs((prev) => ({ ...prev, [key]: value }))

  const onZip = (raw: string) => {
    const zip = raw.replace(/[^0-9]/g, "").slice(0, 5)
    setInputs((prev) => {
      const next = { ...prev, zip }
      if (!climateTouched && zip.length === 5) {
        const c = resolveClimate(zip)
        next.seasonDays = c.frostFreeDays
        next.annualRainIn = c.annualRainIn
      }
      return next
    })
  }

  const togglePriority = (id: PriorityId) =>
    setInputs((prev) => ({
      ...prev,
      priorities: prev.priorities.includes(id)
        ? prev.priorities.filter((p) => p !== id)
        : [...prev.priorities, id],
    }))

  const result = useMemo(() => selectCrops(inputs), [inputs])

  const sorted = useMemo(() => {
    const list = [...result.viable]
    switch (sort) {
      case "profit":
        return list.sort((a, b) => b.economics.profitPerAcre - a.economics.profitPerAcre)
      case "risk":
        return list.sort((a, b) => a.riskScore - b.riskScore)
      case "water":
        return list.sort((a, b) => a.crop.waterInches - b.crop.waterInches)
      case "labor":
        return list.sort((a, b) => a.crop.laborHoursPerAcre - b.crop.laborHoursPerAcre)
      case "cost":
        return list.sort((a, b) => a.economics.totalCostPerAcre - b.economics.totalCostPerAcre)
      default:
        return list.sort((a, b) => b.fitScore - a.fitScore)
    }
  }, [result.viable, sort])

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-primary">
          <Sprout className="size-5" aria-hidden="true" />
          <span className="text-xs font-semibold uppercase tracking-widest">
            Crop selection tool
          </span>
        </div>
        <h2 className="font-serif text-3xl font-semibold text-balance md:text-4xl">
          What should I grow on this land?
        </h2>
        <p className="max-w-3xl text-pretty leading-relaxed text-muted-foreground">
          Describe the field and the operation behind it. This scores every crop against your
          growing season, soil, water, equipment, labor, capital, storage, and market — then shows
          what actually fits, the margin it should return per acre over inputs and labor, and which
          crops to rule out and why.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:items-start">
        {/* ---------------- Inputs ---------------- */}
        <div className="flex flex-col gap-6 lg:sticky lg:top-24">
          <Panel title="The land" icon={<Sprout className="size-4" aria-hidden="true" />}>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="ZIP code"
                  htmlFor="crop-zip"
                  hint={
                    result.climate.isFallback
                      ? "National averages until a ZIP is entered."
                      : `${result.climate.stateName} defaults applied.`
                  }
                >
                  <input
                    id="crop-zip"
                    inputMode="numeric"
                    placeholder="50010"
                    value={inputs.zip}
                    onChange={(e) => onZip(e.target.value)}
                    className={selectClass}
                  />
                </Field>
                <Field label="Acres for this crop" htmlFor="crop-acres">
                  <input
                    id="crop-acres"
                    type="number"
                    min={1}
                    max={20000}
                    value={inputs.acres}
                    onChange={(e) =>
                      set("acres", Math.max(1, Math.min(20000, Number(e.target.value) || 1)))
                    }
                    className={selectClass}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Frost-free days" htmlFor="crop-season">
                  <input
                    id="crop-season"
                    type="number"
                    min={60}
                    max={365}
                    value={inputs.seasonDays}
                    onChange={(e) => {
                      setClimateTouched(true)
                      set("seasonDays", Math.max(60, Math.min(365, Number(e.target.value) || 60)))
                    }}
                    className={selectClass}
                  />
                </Field>
                <Field label="Annual rain (in)" htmlFor="crop-rain">
                  <input
                    id="crop-rain"
                    type="number"
                    min={4}
                    max={120}
                    value={inputs.annualRainIn}
                    onChange={(e) => {
                      setClimateTouched(true)
                      set("annualRainIn", Math.max(4, Math.min(120, Number(e.target.value) || 4)))
                    }}
                    className={selectClass}
                  />
                </Field>
              </div>

              <Field label="Soil texture" htmlFor="crop-soil">
                <select
                  id="crop-soil"
                  value={inputs.soil}
                  onChange={(e) => set("soil", e.target.value as SoilId)}
                  className={selectClass}
                >
                  {Object.entries(SOIL_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Drainage" htmlFor="crop-drainage">
                  <select
                    id="crop-drainage"
                    value={inputs.drainage}
                    onChange={(e) => set("drainage", e.target.value as Drainage)}
                    className={selectClass}
                  >
                    {Object.entries(DRAINAGE_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Soil pH" htmlFor="crop-ph">
                  <select
                    id="crop-ph"
                    value={inputs.ph}
                    onChange={(e) => set("ph", e.target.value as SoilPh)}
                    className={selectClass}
                  >
                    {Object.entries(PH_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Irrigation" hint="Drives which crops are even possible on dry ground.">
                <Segmented<Irrigation>
                  ariaLabel="Irrigation"
                  value={inputs.irrigation}
                  onChange={(v) => set("irrigation", v)}
                  options={(Object.keys(IRRIGATION_LABELS) as Irrigation[]).map((v) => ({
                    value: v,
                    label: v === "none" ? "None" : v === "limited" ? "Limited" : "Full",
                  }))}
                />
              </Field>
            </div>
          </Panel>

          <Panel
            title="The operation"
            icon={<SlidersHorizontal className="size-4" aria-hidden="true" />}
          >
            <div className="flex flex-col gap-4">
              <Field label="Equipment" htmlFor="crop-equip">
                <select
                  id="crop-equip"
                  value={inputs.equipment}
                  onChange={(e) => set("equipment", e.target.value as EquipmentTier)}
                  className={selectClass}
                >
                  {Object.entries(EQUIPMENT_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Labor" htmlFor="crop-labor">
                <select
                  id="crop-labor"
                  value={inputs.labor}
                  onChange={(e) => set("labor", e.target.value as LaborLevel)}
                  className={selectClass}
                >
                  {Object.entries(LABOR_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Operating capital" htmlFor="crop-capital">
                <select
                  id="crop-capital"
                  value={inputs.capital}
                  onChange={(e) => set("capital", e.target.value as CapitalLevel)}
                  className={selectClass}
                >
                  {Object.entries(CAPITAL_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Storage" htmlFor="crop-storage">
                <select
                  id="crop-storage"
                  value={inputs.storage}
                  onChange={(e) => set("storage", e.target.value as StorageLevel)}
                  className={selectClass}
                >
                  {Object.entries(STORAGE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Market access" htmlFor="crop-market">
                <select
                  id="crop-market"
                  value={inputs.market}
                  onChange={(e) => set("market", e.target.value as MarketAccess)}
                  className={selectClass}
                >
                  {Object.entries(MARKET_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Panel>

          <Panel title="What matters most" icon={<Trophy className="size-4" aria-hidden="true" />}>
            <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
              Pick any combination. These reweight the fit score — with none selected, ranking falls
              back to raw suitability.
            </p>
            <div className="flex flex-col gap-2">
              {PRIORITY_IDS.map((id) => {
                const active = inputs.priorities.includes(id)
                return (
                  <button
                    key={id}
                    type="button"
                    role="switch"
                    aria-checked={active}
                    onClick={() => togglePriority(id)}
                    className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                      active
                        ? "border-primary bg-primary/5"
                        : "border-border bg-background hover:border-muted-foreground"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border ${
                        active ? "border-primary bg-primary" : "border-muted-foreground"
                      }`}
                      aria-hidden="true"
                    >
                      {active ? (
                        <svg viewBox="0 0 12 12" className="size-3 text-primary-foreground">
                          <path
                            d="M2.5 6.5l2.5 2.5 4.5-5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : null}
                    </span>
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{PRIORITY_LABELS[id].label}</span>
                      <span className="text-xs leading-relaxed text-muted-foreground">
                        {PRIORITY_LABELS[id].detail}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </Panel>
        </div>

        {/* ---------------- Results ---------------- */}
        <div className="flex flex-col gap-6">
          {result.viable.length === 0 ? (
            <Panel title="No crop clears these constraints">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Every crop in the library was ruled out. That usually means the growing season,
                capital, or labor figures are tighter than any crop can absorb — try widening one of
                them, or reduce the acreage so the cash and hours required come down.
              </p>
            </Panel>
          ) : (
            <>
              {/* Headline recommendations */}
              <div className="grid gap-4 sm:grid-cols-2">
                {result.rankings.map((r) => (
                  <div
                    key={r.id}
                    className={`flex flex-col gap-2 rounded-xl border p-5 ${
                      r.id === "overall"
                        ? "border-primary bg-primary/5 sm:col-span-2"
                        : "border-border bg-card"
                    }`}
                  >
                    <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                      {RANKING_META[r.id].label}
                    </span>
                    <h3 className="font-serif text-xl font-semibold">{r.crop.name}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{r.headline}</p>
                    {r.id === "overall" ? (
                      <ul className="mt-1 flex flex-col gap-1.5">
                        {r.evaluation.reasons.map((reason, i) => (
                          <li
                            key={i}
                            className="flex gap-2 text-sm leading-relaxed text-muted-foreground"
                          >
                            <span aria-hidden="true" className="text-primary">
                              •
                            </span>
                            {reason}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>

              {/* Economics of the top pick */}
              {result.rankings[0] ? (
                <Panel title={`Economics — ${result.rankings[0].crop.name}`}>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <Stat
                      label="Margin per acre"
                      value={formatMoney(result.rankings[0].evaluation.economics.profitPerAcre)}
                      sub={`${formatMoney(result.rankings[0].evaluation.economics.profitLow)} to ${formatMoney(
                        result.rankings[0].evaluation.economics.profitHigh,
                      )} range`}
                      emphasis
                    />
                    <Stat
                      label={`Across ${inputs.acres} ac`}
                      value={formatMoney(result.rankings[0].evaluation.economics.totalProfit)}
                      sub={`${formatMoney(result.rankings[0].evaluation.economics.totalRevenue)} gross`}
                    />
                    <Stat
                      label="Break-even yield"
                      value={formatQty(
                        result.rankings[0].evaluation.economics.breakEvenYield,
                        result.rankings[0].crop.yieldUnit,
                      )}
                      sub={`vs ${formatQty(
                        result.rankings[0].evaluation.economics.yieldPerAcre,
                        result.rankings[0].crop.yieldUnit,
                      )} expected`}
                    />
                    <Stat
                      label="Break-even price"
                      value={`$${result.rankings[0].evaluation.economics.breakEvenPrice.toFixed(2)}`}
                      sub={`vs $${result.rankings[0].evaluation.economics.pricePerUnit.toFixed(2)} assumed`}
                    />
                  </div>
                </Panel>
              ) : null}

              {/* Comparison table */}
              <Panel
                title={`All ${result.viable.length} workable crops`}
                icon={<Table2 className="size-4" aria-hidden="true" />}
              >
                <div className="mb-4">
                  <Segmented<SortKey>
                    ariaLabel="Sort crops by"
                    value={sort}
                    onChange={setSort}
                    options={SORT_OPTIONS}
                  />
                </div>

                <div className="flex flex-col divide-y divide-border">
                  {sorted.map((e) => {
                    const open = openCrop === e.crop.id
                    return (
                      <div key={e.crop.id} className="py-3">
                        <button
                          type="button"
                          aria-expanded={open}
                          onClick={() => setOpenCrop(open ? null : e.crop.id)}
                          className="flex w-full items-center gap-3 text-left"
                        >
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium">{e.crop.name}</span>
                              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                {GROUP_LABELS[e.crop.group]}
                              </span>
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatMoney(e.economics.profitPerAcre)}/ac margin ·{" "}
                              {e.crop.waterInches}&quot; water · {e.crop.laborHoursPerAcre} h/ac
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-3">
                            <span className="flex flex-col items-end">
                              <span className={`text-sm font-semibold ${scoreTone(e.fitScore)}`}>
                                {e.fitScore}
                              </span>
                              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                fit
                              </span>
                            </span>
                            <ChevronDown
                              className={`size-4 text-muted-foreground transition-transform ${
                                open ? "rotate-180" : ""
                              }`}
                              aria-hidden="true"
                            />
                          </span>
                        </button>

                        {open ? (
                          <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4">
                            <p className="text-sm leading-relaxed text-muted-foreground">
                              {e.crop.note}
                            </p>

                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                              <Stat
                                label="Margin / acre"
                                value={formatMoney(e.economics.profitPerAcre)}
                                sub={`${formatMoney(e.economics.totalCostPerAcre)} cost`}
                              />
                              <Stat
                                label="Expected yield"
                                value={formatQty(e.economics.yieldPerAcre, e.crop.yieldUnit)}
                                sub={`at $${e.economics.pricePerUnit.toFixed(2)}`}
                              />
                              <Stat label="Risk" value={`${e.riskScore}/100`} sub="lower is safer" />
                              <Stat
                                label="Planting"
                                value={`${e.crop.seasonDays} d`}
                                sub={e.crop.plantingWindow}
                              />
                            </div>

                            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                              {e.factors.map((f) => (
                                <div key={f.id} className="flex flex-col gap-1.5">
                                  <div className="flex items-baseline justify-between gap-2">
                                    <span className="text-xs font-medium">
                                      {FACTOR_LABELS[f.id]}
                                    </span>
                                    <span
                                      className={`text-xs font-semibold ${scoreTone(f.score)}`}
                                    >
                                      {f.score}
                                    </span>
                                  </div>
                                  <Meter score={f.score} />
                                  <span className="text-xs leading-relaxed text-muted-foreground">
                                    {f.note}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {e.cautions.length > 0 ? (
                              <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3">
                                {e.cautions.map((c, i) => (
                                  <p
                                    key={i}
                                    className="flex gap-2 text-xs leading-relaxed text-muted-foreground"
                                  >
                                    <AlertTriangle
                                      className="mt-0.5 size-3.5 shrink-0"
                                      aria-hidden="true"
                                    />
                                    {c}
                                  </p>
                                ))}
                              </div>
                            ) : null}

                            <div className="flex flex-col gap-1 text-xs leading-relaxed text-muted-foreground">
                              <p>
                                <span className="font-medium text-foreground">Storage: </span>
                                {e.crop.storageNote}
                              </p>
                              <p>
                                <span className="font-medium text-foreground">Market: </span>
                                {e.crop.marketNote}
                              </p>
                            </div>

                            {onSendToProfit ? (
                              <div className="flex flex-col gap-2 border-t border-border pt-4">
                                <p className="text-xs leading-relaxed text-muted-foreground">
                                  The figure above is gross margin — it covers seed, fertilizer,
                                  fuel, and labor, but not land rent or machinery. Run the full
                                  budget to see what it nets after those.
                                </p>
                                <button
                                  type="button"
                                  onClick={() => onSendToProfit(buildHandoff(e, inputs))}
                                  className="inline-flex w-fit items-center gap-2 rounded-md border border-primary bg-primary/10 px-3 py-2 text-sm font-medium transition-colors hover:bg-primary/20"
                                >
                                  <Calculator className="size-4" aria-hidden="true" />
                                  Run full profit budget for {e.crop.name.toLowerCase()}
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </Panel>
            </>
          )}

          {/* Ruled out */}
          {result.rejected.length > 0 ? (
            <Panel
              title={`Ruled out (${result.rejected.length})`}
              icon={<Ban className="size-4" aria-hidden="true" />}
            >
              <button
                type="button"
                aria-expanded={showRejected}
                onClick={() => setShowRejected((v) => !v)}
                className="flex items-center gap-2 text-sm font-medium text-primary"
              >
                {showRejected ? "Hide" : "Show"} what was ruled out and why
                <ChevronDown
                  className={`size-4 transition-transform ${showRejected ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </button>
              {showRejected ? (
                <ul className="mt-4 flex flex-col divide-y divide-border">
                  {result.rejected.map((e: CropEvaluation) => (
                    <li key={e.crop.id} className="flex flex-col gap-1 py-3">
                      <span className="text-sm font-medium">{e.crop.name}</span>
                      {e.blockers.map((b, i) => (
                        <span key={i} className="text-xs leading-relaxed text-muted-foreground">
                          {b}
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>
              ) : null}
            </Panel>
          ) : null}

          {/* Assumptions */}
          <Panel title="What is behind these numbers">
            <ul className="flex flex-col gap-2">
              {result.assumptions.map((a, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
                  <span aria-hidden="true">•</span>
                  {a}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Labor is costed at ${LABOR_RATE}/hour including your own time, so these figures are
              lower than the gross-margin numbers most crop budgets quote. Treat them as a starting
              point for a conversation with your extension office, not as a substitute for a local
              enterprise budget.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  )
}
