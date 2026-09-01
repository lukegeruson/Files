"use client"

import { useEffect, useMemo, useState } from "react"
import { CircleAlert, Grid2x2, Info, LayoutGrid, Ruler, Zap } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Field, Panel, Segmented, Stat, selectClass } from "@/components/calculator-ui"
import { cn } from "@/lib/utils"
import { usePublishSolarScene } from "@/components/solar/solar-scene-context"
import { snapshotFromPanels } from "@/lib/solar-scene"
import {
  ORIENTATION_LABELS,
  SHADE_LABELS,
  number as fmtNumber,
  money,
  type Orientation,
  type Shade,
} from "@/lib/solar"
import {
  BASIS_LABELS,
  DEFAULT_PANEL_INPUTS,
  PANEL_OPTIONS,
  PANEL_SCENARIOS,
  PITCH_LABELS,
  computePanels,
  type RoofPitch,
  type UsageBasis,
} from "@/lib/solar-panels"

/** Visual approximation of the array on a roof face. */
function LayoutPreview({
  panelCount,
  perRow,
  rows,
}: {
  panelCount: number
  perRow: number
  rows: number
}) {
  // Keep the preview readable: cap drawn rows and note the overflow.
  const maxRows = 8
  const drawnRows = Math.min(rows, maxRows)
  const cells: number[] = []
  for (let r = 0; r < drawnRows; r++) {
    const remaining = panelCount - r * perRow
    cells.push(Math.max(0, Math.min(perRow, remaining)))
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex flex-col gap-1 rounded-md border border-dashed border-border bg-muted/40 p-3"
        role="img"
        aria-label={`Approximate layout: ${rows} rows of up to ${perRow} panels`}
      >
        {cells.map((count, r) => (
          <div key={r} className="flex gap-1">
            {Array.from({ length: count }).map((_, c) => (
              <div
                key={c}
                className="h-5 flex-1 rounded-sm border border-primary/40 bg-primary/25"
                style={{ maxWidth: `${100 / perRow}%` }}
              />
            ))}
          </div>
        ))}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {rows > maxRows
          ? `Showing ${maxRows} of ${rows} rows. `
          : ""}
        About {rows} {rows === 1 ? "row" : "rows"} of up to {perRow} panels across, based on your
        usable roof width. Real layouts shift around vents, chimneys and setbacks.
      </p>
    </div>
  )
}

export function SolarPanelCalculator() {
  const [zip, setZip] = useState("")
  const [basis, setBasis] = useState<UsageBasis>("bill")
  const [monthlyBill, setMonthlyBill] = useState("180")
  const [monthlyKwh, setMonthlyKwh] = useState("1000")
  const [annualKwh, setAnnualKwh] = useState("10800")
  const [offsetPercent, setOffsetPercent] = useState(100)
  const [panelWatts, setPanelWatts] = useState(400)
  const [advanced, setAdvanced] = useState(false)

  // Advanced-only inputs, pre-filled with the easy-mode assumptions.
  const [orientation, setOrientation] = useState<Orientation>("south")
  const [shade, setShade] = useState<Shade>("none")
  const [pitch, setPitch] = useState<RoofPitch>("typical")
  const [derate, setDerate] = useState(85)
  const [roofWidthFt, setRoofWidthFt] = useState("30")

  const result = useMemo(
    () =>
      computePanels({
        ...DEFAULT_PANEL_INPUTS,
        zip,
        basis,
        monthlyBill: Number.parseFloat(monthlyBill) || 0,
        monthlyKwh: Number.parseFloat(monthlyKwh) || 0,
        annualKwh: Number.parseFloat(annualKwh) || 0,
        offsetPercent,
        panelWatts,
        // Easy mode keeps the optimistic-but-reasonable defaults.
        orientation: advanced ? orientation : "south",
        shade: advanced ? shade : "none",
        pitch: advanced ? pitch : "typical",
        derate: advanced ? derate / 100 : 0.85,
        roofWidthFt: advanced ? Number.parseFloat(roofWidthFt) || 30 : 30,
      }),
    [
      zip, basis, monthlyBill, monthlyKwh, annualKwh, offsetPercent, panelWatts,
      advanced, orientation, shade, pitch, derate, roofWidthFt,
    ],
  )

  // Feed the 3D explorer above the tabs. Publish only once the tool has enough
  // input to size a real array; otherwise the scene keeps its mock home.
  const publishScene = usePublishSolarScene()
  useEffect(() => {
    publishScene(result.ready ? snapshotFromPanels(result) : null)
  }, [result, publishScene])

  function applyScenario(id: string) {
    const scenario = PANEL_SCENARIOS.find((s) => s.id === id)
    if (!scenario) return
    const patch = scenario.patch
    if (patch.basis) setBasis(patch.basis)
    if (patch.monthlyBill !== undefined) setMonthlyBill(String(patch.monthlyBill))
    if (patch.monthlyKwh !== undefined) setMonthlyKwh(String(patch.monthlyKwh))
    if (patch.annualKwh !== undefined) setAnnualKwh(String(patch.annualKwh))
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <h2 className="text-balance font-serif text-3xl font-semibold tracking-tight md:text-4xl">
          How many solar panels do I need?
        </h2>
        <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">
          This calculator estimates system size, panel count, production, and the roof area you
          need.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {/* Inputs */}
        <div className="rounded-lg border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Start with a common scenario
            </p>
            <button
              type="button"
              onClick={() => setAdvanced((v) => !v)}
              aria-pressed={advanced}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm transition-colors",
                advanced
                  ? "border-primary bg-primary/15 font-medium text-foreground"
                  : "border-input bg-background text-muted-foreground hover:border-ring hover:text-foreground",
              )}
            >
              {advanced ? "Advanced mode on" : "Advanced mode"}
            </button>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-border px-5 py-4">
            {PANEL_SCENARIOS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => applyScenario(s.id)}
                title={s.description}
                className="rounded-full border border-input bg-background px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-5 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="What do you know?">
                <Segmented
                  value={basis}
                  onChange={setBasis}
                  ariaLabel="Usage basis"
                  options={(
                    advanced
                      ? (["bill", "monthly-kwh", "annual-kwh"] as UsageBasis[])
                      : (["bill", "monthly-kwh"] as UsageBasis[])
                  ).map((v) => ({ value: v, label: BASIS_LABELS[v] }))}
                />
              </Field>

              {basis === "bill" ? (
                <Field
                  label="Average monthly bill"
                  htmlFor="panel-bill"
                  hint={`Converted at ${money(result.rate, 3)}/kWh for ${result.location.stateName}.`}
                >
                  <Input
                    id="panel-bill"
                    inputMode="decimal"
                    value={monthlyBill}
                    onChange={(e) => setMonthlyBill(e.target.value)}
                    placeholder="180"
                  />
                </Field>
              ) : basis === "monthly-kwh" ? (
                <Field
                  label="Monthly usage (kWh)"
                  htmlFor="panel-kwh"
                  hint="Shown on your utility bill as kWh used."
                >
                  <Input
                    id="panel-kwh"
                    inputMode="decimal"
                    value={monthlyKwh}
                    onChange={(e) => setMonthlyKwh(e.target.value)}
                    placeholder="1000"
                  />
                </Field>
              ) : (
                <Field
                  label="Annual usage (kWh)"
                  htmlFor="panel-annual"
                  hint="Add up 12 months for the most accurate sizing."
                >
                  <Input
                    id="panel-annual"
                    inputMode="decimal"
                    value={annualKwh}
                    onChange={(e) => setAnnualKwh(e.target.value)}
                    placeholder="10800"
                  />
                </Field>
              )}

              <Field
                label="ZIP code"
                htmlFor="panel-zip"
                hint={
                  result.location.isFallback
                    ? "Using national averages until a ZIP is entered."
                    : `${result.location.stateName}: ${result.location.sunHours} peak sun hours/day.`
                }
              >
                <Input
                  id="panel-zip"
                  inputMode="numeric"
                  maxLength={5}
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  placeholder="85001"
                />
              </Field>

              <Field
                label={`Target offset — ${offsetPercent}%`}
                htmlFor="panel-offset"
                hint="How much of your yearly electricity the array should cover."
              >
                <input
                  id="panel-offset"
                  type="range"
                  min={10}
                  max={120}
                  step={5}
                  value={offsetPercent}
                  onChange={(e) => setOffsetPercent(Number(e.target.value))}
                  className="h-9 w-full accent-primary"
                />
              </Field>
            </div>

            <Field label="Panel wattage" hint="Higher-wattage panels mean fewer panels and less roof space.">
              <Segmented
                value={String(panelWatts)}
                onChange={(v) => setPanelWatts(Number(v))}
                ariaLabel="Panel wattage"
                options={PANEL_OPTIONS.map((w) => ({ value: String(w), label: `${w} W` }))}
              />
            </Field>

            {advanced ? (
              <div className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
                <Field label="Roof orientation" htmlFor="panel-orientation">
                  <select
                    id="panel-orientation"
                    className={selectClass}
                    value={orientation}
                    onChange={(e) => setOrientation(e.target.value as Orientation)}
                  >
                    {Object.entries(ORIENTATION_LABELS).map(([v, label]) => (
                      <option key={v} value={v}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Roof pitch" htmlFor="panel-pitch">
                  <select
                    id="panel-pitch"
                    className={selectClass}
                    value={pitch}
                    onChange={(e) => setPitch(e.target.value as RoofPitch)}
                  >
                    {Object.entries(PITCH_LABELS).map(([v, label]) => (
                      <option key={v} value={v}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Shading" htmlFor="panel-shade">
                  <select
                    id="panel-shade"
                    className={selectClass}
                    value={shade}
                    onChange={(e) => setShade(e.target.value as Shade)}
                  >
                    {Object.entries(SHADE_LABELS).map(([v, label]) => (
                      <option key={v} value={v}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label={`System losses — ${derate}% delivered`}
                  htmlFor="panel-derate"
                  hint="Inverter, wiring, soiling and heat losses. 85% is typical."
                >
                  <input
                    id="panel-derate"
                    type="range"
                    min={70}
                    max={95}
                    step={1}
                    value={derate}
                    onChange={(e) => setDerate(Number(e.target.value))}
                    className="h-9 w-full accent-primary"
                  />
                </Field>
                <Field
                  label="Usable roof width (ft)"
                  htmlFor="panel-width"
                  hint="Used to approximate how the panels lay out in rows."
                >
                  <Input
                    id="panel-width"
                    inputMode="decimal"
                    value={roofWidthFt}
                    onChange={(e) => setRoofWidthFt(e.target.value)}
                    placeholder="30"
                  />
                </Field>
              </div>
            ) : (
              <p className="flex items-start gap-2 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                Easy mode assumes an unshaded, south-facing roof at a typical pitch with 85% system
                efficiency. Turn on advanced mode to set orientation, pitch, shade and losses.
              </p>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="flex flex-col gap-4">
          {!result.ready ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-card px-6 py-14 text-center">
              <LayoutGrid className="size-5 text-muted-foreground" aria-hidden="true" />
              <h3 className="font-serif text-lg font-semibold">Your panel count appears here</h3>
              <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                Enter your monthly bill or usage above, or pick one of the common scenarios, to size
                a system.
              </p>
            </div>
          ) : (
            <>
              {/* Headline answer */}
              <div className="rounded-lg border border-primary bg-primary/10 p-6">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  You need about
                </p>
                <p className="mt-2 font-serif text-5xl font-semibold leading-none tabular-nums">
                  {result.panelCount} panels
                </p>
                <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
                  A {fmtNumber(result.systemKw, 2)} kW system of {panelWatts} W panels covering
                  about {Math.round(result.offsetAchieved * 100)}% of the{" "}
                  {fmtNumber(result.annualKwh)} kWh your home uses each year.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
                <Panel title="System summary" icon={<Zap className="size-4" aria-hidden="true" />}>
                  <div className="flex flex-col gap-3">
                    <Stat
                      label="System size"
                      value={`${fmtNumber(result.systemKw, 2)} kW`}
                      emphasis
                      sub={`${result.panelCount} × ${panelWatts} W panels`}
                    />
                    <Stat
                      label="Annual production"
                      value={`${fmtNumber(result.annualProduction)} kWh`}
                      sub={`${fmtNumber(result.monthlyProduction)} kWh per month on average`}
                    />
                    <Stat
                      label="Electricity offset"
                      value={`${Math.round(result.offsetAchieved * 100)}%`}
                      sub={`Worth about ${money(result.annualBillOffset)}/yr at ${money(result.rate, 3)}/kWh`}
                    />
                  </div>
                </Panel>

                <Panel title="Roof space" icon={<Ruler className="size-4" aria-hidden="true" />}>
                  <div className="flex flex-col gap-3">
                    <Stat
                      label="Roof area needed"
                      value={`${fmtNumber(result.roofAreaSqFt)} sq ft`}
                      emphasis
                      sub="Includes spacing and code setbacks"
                    />
                    <Stat
                      label="Per panel"
                      value={`${fmtNumber(result.panelAreaSqFt, 1)} sq ft`}
                      sub={`About ${fmtNumber(result.panelWidthFt, 1)} ft × ${fmtNumber(result.panelHeightFt, 1)} ft`}
                    />
                    <Stat
                      label="Yield at this site"
                      value={`${fmtNumber(result.productionPerKwYear)} kWh`}
                      sub="Per kW of capacity, per year"
                    />
                  </div>
                </Panel>

                <Panel
                  title="Approximate layout"
                  icon={<Grid2x2 className="size-4" aria-hidden="true" />}
                >
                  <LayoutPreview
                    panelCount={result.panelCount}
                    perRow={result.layout.perRow}
                    rows={result.layout.rows}
                  />
                </Panel>
              </div>

              {/* Panel size comparison */}
              <Panel title="Compare panel wattages">
                <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
                  Same target production, different module sizes. Higher-wattage panels cut the panel
                  count and the roof space you need.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[28rem] text-sm">
                    <caption className="sr-only">
                      Panel count and roof area by panel wattage
                    </caption>
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th scope="col" className="py-2 pr-3 font-medium">Panel</th>
                        <th scope="col" className="py-2 font-medium">Panels needed</th>
                        <th scope="col" className="py-2 font-medium">System size</th>
                        <th scope="col" className="py-2 font-medium">Roof area</th>
                      </tr>
                    </thead>
                    <tbody className="tabular-nums">
                      {result.comparisons.map((c) => (
                        <tr
                          key={c.watts}
                          className={cn(
                            "border-b border-border last:border-0",
                            c.selected && "bg-primary/10 font-medium",
                          )}
                        >
                          <th
                            scope="row"
                            className="py-2.5 pr-3 text-left font-normal text-foreground"
                          >
                            {c.watts} W{c.selected ? " (selected)" : ""}
                          </th>
                          <td className="py-2.5">{c.panelCount}</td>
                          <td className="py-2.5">{fmtNumber(c.systemKw, 2)} kW</td>
                          <td className="py-2.5">{fmtNumber(c.roofAreaSqFt)} sq ft</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>

              {/* Monthly production */}
              <Panel title="Estimated monthly production">
                <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                  Output swings with the seasons. Summer months overproduce and winter months fall
                  short, which is what annual net metering is designed to smooth out.
                </p>
                <div className="flex items-end gap-1.5" aria-hidden="true">
                  {result.monthlyProfile.map((m) => {
                    const peak = Math.max(...result.monthlyProfile.map((x) => x.kwh)) || 1
                    return (
                      <div key={m.month} className="flex flex-1 flex-col items-center gap-1.5">
                        <div
                          className="w-full rounded-t-sm bg-primary/70"
                          style={{ height: `${Math.max(4, (m.kwh / peak) * 96)}px` }}
                        />
                        <span className="text-[10px] text-muted-foreground">{m.month}</span>
                      </div>
                    )
                  })}
                </div>
                <table className="sr-only">
                  <caption>Estimated monthly production in kilowatt-hours</caption>
                  <tbody>
                    {result.monthlyProfile.map((m) => (
                      <tr key={m.month}>
                        <th scope="row">{m.month}</th>
                        <td>{Math.round(m.kwh)} kWh</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>

              {/* Transparent math */}
              <Panel title="How this was calculated">
                <ol className="flex flex-col gap-3">
                  {result.steps.map((s, i) => (
                    <li key={s.label} className="flex flex-col gap-0.5 border-t border-border pt-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <span className="text-sm font-medium">
                          {i + 1}. {s.label}
                        </span>
                        <span className="font-serif text-base tabular-nums">{s.value}</span>
                      </div>
                      <span className="text-xs leading-relaxed text-muted-foreground">
                        {s.detail}
                      </span>
                    </li>
                  ))}
                </ol>
              </Panel>

              {/* Caveats */}
              <Panel
                title="What this estimate cannot see"
                icon={<CircleAlert className="size-4" aria-hidden="true" />}
              >
                <ul className="flex flex-col gap-2">
                  {result.notes.map((note) => (
                    <li
                      key={note}
                      className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground"
                    >
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                      {note}
                    </li>
                  ))}
                </ul>
              </Panel>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
