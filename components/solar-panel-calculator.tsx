"use client"

import { useEffect, useMemo, useState } from "react"
import { Info, Ruler, Zap } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Field, Panel, Segmented, Stat, selectClass } from "@/components/calculator-ui"
import { cn } from "@/lib/utils"
import { usePublishSolarScene } from "@/components/solar/solar-scene-context"
import { snapshotFromPanels } from "@/lib/solar-scene"
import {
  SHADE_LABELS,
  number as fmtNumber,
  money,
  type Shade,
} from "@/lib/solar"
import {
  BASIS_LABELS,
  DEFAULT_PANEL_INPUTS,
  PANEL_OPTIONS,
  PANEL_SCENARIOS,
  computePanels,
  type UsageBasis,
} from "@/lib/solar-panels"


export function SolarPanelCalculator() {
  const [zip, setZip] = useState("")
  const [basis, setBasis] = useState<UsageBasis>("bill")
  const [monthlyBill, setMonthlyBill] = useState("180")
  const [monthlyKwh, setMonthlyKwh] = useState("1000")
  const [offsetPercent, setOffsetPercent] = useState(100)
  const [panelWatts, setPanelWatts] = useState(400)
  const [advanced, setAdvanced] = useState(false)

  // Advanced-only inputs, pre-filled with the easy-mode assumptions.
  const [shade, setShade] = useState<Shade>("none")
  const [derate, setDerate] = useState(85)
  const [started, setStarted] = useState(false)
  const markStarted = () => {
    if (!started) setStarted(true)
  }

  const result = useMemo(
    () =>
      computePanels({
        ...DEFAULT_PANEL_INPUTS,
        zip,
        basis,
        monthlyBill: Number.parseFloat(monthlyBill) || 0,
        monthlyKwh: Number.parseFloat(monthlyKwh) || 0,
        annualKwh: 0,
        offsetPercent,
        panelWatts,
        // Easy mode keeps the optimistic-but-reasonable defaults.
        orientation: "south",
        shade: advanced ? shade : "none",
        pitch: "typical",
        derate: advanced ? derate / 100 : 0.85,
      }),
    [
      zip, basis, monthlyBill, monthlyKwh, offsetPercent, panelWatts,
      advanced, shade, derate,
    ],
  )

  // Feed the 3D explorer above the tabs. Publish only once the tool has enough
  // input to size a real array; otherwise the scene keeps its mock home.
  const publishScene = usePublishSolarScene()
  useEffect(() => {
    publishScene(started && result.ready ? snapshotFromPanels(result) : null)
  }, [result, publishScene])

  function applyScenario(id: string) {
    const scenario = PANEL_SCENARIOS.find((s) => s.id === id)
    if (!scenario) return
    const patch = scenario.patch
    if (patch.basis) setBasis(patch.basis)
    if (patch.monthlyBill !== undefined) setMonthlyBill(String(patch.monthlyBill))
    if (patch.monthlyKwh !== undefined) setMonthlyKwh(String(patch.monthlyKwh))
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

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {/* Inputs */}
        <div
          className="rounded-lg border border-border bg-card"
          onChangeCapture={markStarted}
          onClickCapture={markStarted}
        >
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
                  options={(["bill", "monthly-kwh"] as UsageBasis[]).map((v) => ({
                    value: v,
                    label: BASIS_LABELS[v],
                  }))}
                />
              </Field>

              {basis === "bill" ? (
                <Field
                  label="Average monthly bill"
                  htmlFor="panel-bill"
                  hint={`At ${money(result.rate, 3)}/kWh (${
                    result.location.stateName === "National average" ? "US avg." : result.location.stateName
                  })`}
                >
                  <Input
                    id="panel-bill"
                    inputMode="decimal"
                    value={monthlyBill}
                    onChange={(e) => setMonthlyBill(e.target.value)}
                    placeholder="180"
                  />
                </Field>
              ) : (
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
                hint="% of yearly usage solar covers."
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
                  hint="Output left after wiring/heat loss."
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
              </div>
            ) : (
              <p className="flex items-start gap-2 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                Easy mode assumes an unshaded, south-facing roof at a typical pitch with 85% system
                efficiency. Turn on advanced mode to set shading, system losses and roof width.
              </p>
            )}
          </div>
        </div>

        {/* Results */}
        <div
          className={cn(
            "flex min-w-0 flex-col gap-4",
            !(started && result.ready) && "lg:self-stretch",
          )}
        >
          {!(started && result.ready) ? (
            <div className="flex-1 rounded-lg border border-dashed border-border bg-card p-6">
              <h3 className="font-serif text-lg font-semibold">Your results will appear here</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Enter your ZIP code and monthly bill or usage, then adjust how much of your
                electricity you want solar to cover to see how many panels and what size system
                you need.
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

              <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
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
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
