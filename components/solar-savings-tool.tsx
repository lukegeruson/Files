"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowRight,
  BatteryCharging,
  CircleAlert,
  CircleCheck,
  Info,
  TrendingUp,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Field, Panel, Segmented, Stat, selectClass } from "@/components/calculator-ui"
import { cn } from "@/lib/utils"
import { usePublishSolarScene } from "@/components/solar/solar-scene-context"
import { snapshotFromSavings } from "@/lib/solar-scene"
import {
  DEFAULT_ASSUMPTIONS,
  ORIENTATION_LABELS,
  PAYMENT_LABELS,
  ROOF_CONDITION_LABELS,
  ROOF_TYPE_LABELS,
  SHADE_LABELS,
  computeSolar,
  money,
  number as fmtNumber,
  years as fmtYears,
  type Assumptions,
  type Orientation,
  type Payment,
  type RoofCondition,
  type RoofType,
  type Shade,
} from "@/lib/solar"

// --- Main tool -------------------------------------------------------------

const STEPS = ["Your bill", "Roof & sun", "Your plans"] as const

export function SolarSavingsTool() {
  const [step, setStep] = useState(0)

  // Step 1 — the fastest path to a number.
  const [zip, setZip] = useState("")
  const [bill, setBill] = useState("180")
  const [kwh, setKwh] = useState("")
  const [rate, setRate] = useState("")
  const [utility, setUtility] = useState("")

  // Step 2 — roof and sun.
  const [roofCondition, setRoofCondition] = useState<RoofCondition>("good")
  const [roofType, setRoofType] = useState<RoofType>("asphalt")
  const [orientation, setOrientation] = useState<Orientation>("south")
  const [shade, setShade] = useState<Shade>("light")

  // Step 3 — plans.
  const [hasEv, setHasEv] = useState(false)
  const [wantsBattery, setWantsBattery] = useState(false)
  const [yearsInHome, setYearsInHome] = useState("15")
  const [payment, setPayment] = useState<Payment>("cash")

  // Editable assumptions.
  const [assumptions, setAssumptions] = useState<Assumptions>(DEFAULT_ASSUMPTIONS)
  const setAssumption = (key: keyof Assumptions, value: number) =>
    setAssumptions((prev) => ({ ...prev, [key]: value }))

  const billNum = Number.parseFloat(bill) || 0
  const kwhNum = Number.parseFloat(kwh) || 0
  const ready = zip.replace(/\D/g, "").length >= 3 && (billNum > 0 || kwhNum > 0)

  const result = useMemo(
    () =>
      computeSolar(
        {
          zip,
          monthlyBill: billNum,
          monthlyKwh: kwhNum > 0 ? kwhNum : null,
          rate: Number.parseFloat(rate) > 0 ? Number.parseFloat(rate) : null,
          utility,
          roofCondition,
          roofType,
          orientation,
          shade,
          hasEv,
          wantsBattery,
          yearsInHome: Number.parseFloat(yearsInHome) || 10,
          payment,
        },
        assumptions,
      ),
    [
      zip, billNum, kwhNum, rate, utility, roofCondition, roofType,
      orientation, shade, hasEv, wantsBattery, yearsInHome, payment, assumptions,
    ],
  )

  // Publish results up to the 3D explorer above the tabs. Only once the inputs
  // are sufficient for a real number; before that the scene keeps its mock so it
  // never shows a misleading half-filled house.
  const publishScene = usePublishSolarScene()
  useEffect(() => {
    publishScene(ready ? snapshotFromSavings(result, wantsBattery) : null)
  }, [ready, result, wantsBattery, publishScene])

  const verdictTone =
    result.verdict === "favorable"
      ? "border-primary bg-primary/10"
      : result.verdict === "consider"
        ? "border-border bg-accent"
        : "border-destructive/40 bg-destructive/5"

  const milestones = [5, 10, 15, 20, 25].filter((y) => y <= assumptions.horizonYears)
  const maxCumulative = result.savingsByYear[result.savingsByYear.length - 1]?.cumulative || 1

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <h2 className="text-balance font-serif text-3xl font-semibold tracking-tight md:text-4xl">
          Should you go solar? Find out now.
        </h2>
        <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">
          This tool estimates system size, cost after incentives, payback period, and 25-year
          savings.
        </p>
      </div>

      {/* Form + live results (always stacked: results stay below the form) */}
      <div className="flex flex-col gap-6">
        {/* Form */}
        <div>
          <div className="rounded-lg border border-border bg-card">
            {/* Step tabs */}
            <div className="flex border-b border-border">
              {STEPS.map((label, i) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setStep(i)}
                  aria-current={step === i ? "step" : undefined}
                  className={cn(
                    "flex-1 px-4 py-3 text-sm transition-colors",
                    step === i
                      ? "border-b-2 border-primary font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="tabular-nums text-muted-foreground">{i + 1}.</span> {label}
                </button>
              ))}
            </div>

            <div className="p-5">
              {step === 0 ? (
                <div className="flex flex-col gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="ZIP code" htmlFor="solar-zip" hint="Sets local sun hours and average rates.">
                      <Input
                        id="solar-zip"
                        inputMode="numeric"
                        placeholder="e.g. 85001"
                        value={zip}
                        maxLength={5}
                        onChange={(e) => setZip(e.target.value)}
                      />
                    </Field>
                    <Field label="Average monthly bill" htmlFor="solar-bill" hint="The fastest way to an estimate.">
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          $
                        </span>
                        <Input
                          id="solar-bill"
                          inputMode="decimal"
                          className="pl-7"
                          placeholder="180"
                          value={bill}
                          onChange={(e) => setBill(e.target.value)}
                        />
                      </div>
                    </Field>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Monthly kWh" htmlFor="solar-kwh" hint="Optional. Overrides the bill.">
                      <Input
                        id="solar-kwh"
                        inputMode="decimal"
                        placeholder="Optional"
                        value={kwh}
                        onChange={(e) => setKwh(e.target.value)}
                      />
                    </Field>
                    <Field label="Your rate ($/kWh)" htmlFor="solar-rate" hint="Optional. Found on your bill.">
                      <Input
                        id="solar-rate"
                        inputMode="decimal"
                        placeholder={result.location.defaultRate.toFixed(3)}
                        value={rate}
                        onChange={(e) => setRate(e.target.value)}
                      />
                    </Field>
                    <Field label="Utility" htmlFor="solar-utility" hint="Optional, for your notes.">
                      <Input
                        id="solar-utility"
                        placeholder="Optional"
                        value={utility}
                        onChange={(e) => setUtility(e.target.value)}
                      />
                    </Field>
                  </div>
                </div>
              ) : null}

              {step === 1 ? (
                <div className="flex flex-col gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Roof age & condition" htmlFor="solar-roof-age">
                      <select
                        id="solar-roof-age"
                        className={selectClass}
                        value={roofCondition}
                        onChange={(e) => setRoofCondition(e.target.value as RoofCondition)}
                      >
                        {Object.entries(ROOF_CONDITION_LABELS).map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Roof type" htmlFor="solar-roof-type" hint="Affects mounting labor cost.">
                      <select
                        id="solar-roof-type"
                        className={selectClass}
                        value={roofType}
                        onChange={(e) => setRoofType(e.target.value as RoofType)}
                      >
                        {Object.entries(ROOF_TYPE_LABELS).map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <Field label="Roof orientation" hint="South-facing pitch produces the most power.">
                    <Segmented
                      ariaLabel="Roof orientation"
                      value={orientation}
                      onChange={setOrientation}
                      options={(Object.keys(ORIENTATION_LABELS) as Orientation[]).map((v) => ({
                        value: v,
                        label: ORIENTATION_LABELS[v],
                      }))}
                    />
                  </Field>
                  <Field label="Shade level" hint="Shade is the biggest single drag on production.">
                    <Segmented
                      ariaLabel="Shade level"
                      value={shade}
                      onChange={setShade}
                      options={(Object.keys(SHADE_LABELS) as Shade[]).map((v) => ({
                        value: v,
                        label: SHADE_LABELS[v],
                      }))}
                    />
                  </Field>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="flex flex-col gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Do you have an EV?" hint="Adds home charging load to your usage.">
                      <Segmented
                        ariaLabel="Electric vehicle"
                        value={hasEv ? "yes" : "no"}
                        onChange={(v) => setHasEv(v === "yes")}
                        options={[
                          { value: "no", label: "No EV" },
                          { value: "yes", label: "Yes, I charge at home" },
                        ]}
                      />
                    </Field>
                    <Field label="Considering a battery?" hint="Adds storage cost and backup capability.">
                      <Segmented
                        ariaLabel="Battery storage"
                        value={wantsBattery ? "yes" : "no"}
                        onChange={(v) => setWantsBattery(v === "yes")}
                        options={[
                          { value: "no", label: "Panels only" },
                          { value: "yes", label: "Add a battery" },
                        ]}
                      />
                    </Field>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Years you expect to stay"
                      htmlFor="solar-years"
                      hint="Compared against payback to judge whether you recoup the cost."
                    >
                      <Input
                        id="solar-years"
                        inputMode="numeric"
                        value={yearsInHome}
                        onChange={(e) => setYearsInHome(e.target.value)}
                      />
                    </Field>
                    <Field label="How would you pay?" hint="Ownership earns the tax credit; leases do not.">
                      <Segmented
                        ariaLabel="Payment method"
                        value={payment}
                        onChange={setPayment}
                        options={(Object.keys(PAYMENT_LABELS) as Payment[]).map((v) => ({
                          value: v,
                          label: PAYMENT_LABELS[v],
                        }))}
                      />
                    </Field>
                  </div>
                </div>
              ) : null}

              {/* Step nav */}
              <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  disabled={step === 0}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                >
                  Back
                </button>
                {step < STEPS.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    Refine estimate
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </button>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    All questions answered
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Live results */}
        <div>
          <div className="flex flex-col gap-4">
            {!ready ? (
              <div className="rounded-lg border border-dashed border-border bg-card p-6">
                <h3 className="font-serif text-lg font-semibold">Your estimate appears here</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Enter a ZIP code and your average monthly bill to see system size, cost, payback,
                  and a recommendation. Everything else just refines the result.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
                <div className={cn("rounded-lg border p-5", verdictTone)}>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Recommendation
                  </p>
                  <p className="mt-2 text-balance font-serif text-xl font-semibold leading-snug">
                    {result.verdictHeadline}
                  </p>
                  <dl className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">Payback</dt>
                      <dd className="font-serif text-2xl tabular-nums">{fmtYears(result.paybackYears)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                        {assumptions.horizonYears}-yr savings
                      </dt>
                      <dd className="font-serif text-2xl tabular-nums">
                        {money(result.cumulativeSavings)}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-lg border border-border bg-card p-5">
                  <h3 className="font-serif text-lg font-semibold">Your estimate</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {result.location.isFallback
                      ? "Using national averages until a valid ZIP is entered."
                      : `Based on ${result.location.stateName} sun hours (${result.location.sunHours} kWh/m²/day).`}
                  </p>
                  <div className="mt-4 flex flex-col gap-3">
                    <Stat
                      label="System size"
                      value={`${fmtNumber(result.systemSizeKw, 1)} kW`}
                      sub={`About ${result.panelCount} panels at 400 W each`}
                      emphasis
                    />
                    <Stat
                      label="Annual production"
                      value={`${fmtNumber(result.annualProduction)} kWh`}
                      sub={`Covers about ${Math.round(result.offsetPercent)}% of your ${fmtNumber(result.annualKwh)} kWh usage`}
                    />
                    <Stat
                      label="Net cost after incentives"
                      value={money(result.netCost)}
                      sub={`${money(result.grossCost + result.batteryGrossCost)} gross less ${money(result.itcAmount)} tax credit`}
                    />
                    <Stat
                      label="Monthly savings, year 1"
                      value={money(result.monthlySavings)}
                      sub={`${money(result.year1Savings)} in the first year`}
                    />
                    <Stat
                      label="Estimated ROI"
                      value={`${fmtNumber(result.roiPercent)}%`}
                      sub={`Net gain of ${money(result.netLifetimeGain)} over ${assumptions.horizonYears} years`}
                    />
                  </div>
                </div>

                {/* Offset bar */}
                <div className="rounded-lg border border-border bg-card p-5">
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-serif text-base font-semibold">Electricity offset</h3>
                    <span className="font-serif text-xl tabular-nums">
                      {Math.round(result.offsetPercent)}%
                    </span>
                  </div>
                  <div
                    className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted"
                    role="img"
                    aria-label={`Solar covers about ${Math.round(result.offsetPercent)} percent of your electricity use`}
                  >
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(100, result.offsetPercent)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    The share of your yearly electricity this array would supply. Anything short of
                    100% still comes from the grid.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {ready ? (
        <>
          {/* Why this recommendation */}
          <div className="grid gap-6 md:grid-cols-2">
            <Panel title="Why this recommendation" icon={<CircleCheck className="size-4 text-primary" aria-hidden="true" />}>
              {result.reasons.length ? (
                <ul className="flex flex-col gap-2.5">
                  {result.reasons.map((r) => (
                    <li key={r} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
                      <CircleCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No strong positive factors stand out at these inputs.
                </p>
              )}
            </Panel>
            <Panel title="What to watch out for" icon={<CircleAlert className="size-4 text-primary" aria-hidden="true" />}>
              {result.cautions.length ? (
                <ul className="flex flex-col gap-2.5">
                  {result.cautions.map((c) => (
                    <li key={c} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
                      <CircleAlert className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nothing significant is working against solar at these inputs.
                </p>
              )}
            </Panel>
          </div>

          {/* Cumulative savings + cash vs finance */}
          <div className="grid gap-6 md:grid-cols-2">
            <Panel title="Cumulative savings over time" icon={<TrendingUp className="size-4 text-primary" aria-hidden="true" />}>
              <div className="flex h-40 items-end gap-3">
                {milestones.map((y) => {
                  const row = result.savingsByYear[y - 1]
                  const value = row?.cumulative ?? 0
                  const pct = Math.max(4, (value / maxCumulative) * 100)
                  return (
                    <div key={y} className="flex flex-1 flex-col items-center justify-end gap-2">
                      <span className="font-serif text-xs tabular-nums text-muted-foreground">
                        {money(value)}
                      </span>
                      <div
                        className="w-full rounded-t bg-primary/70"
                        style={{ height: `${pct}%` }}
                        role="img"
                        aria-label={`By year ${y}, about ${money(value)} saved`}
                      />
                      <span className="text-xs tabular-nums text-muted-foreground">Yr {y}</span>
                    </div>
                  )
                })}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Assumes utility rates rise {(assumptions.rateEscalation * 100).toFixed(1)}% a year and
                panels lose {(assumptions.degradation * 100).toFixed(1)}% output annually.
              </p>
            </Panel>

            <Panel title="Cash vs. financing vs. lease">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">
                    Comparison of paying cash, financing with a loan, and leasing
                  </caption>
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th scope="col" className="py-2 pr-3 font-medium">Option</th>
                      <th scope="col" className="py-2 pr-3 font-medium">Upfront</th>
                      <th scope="col" className="py-2 font-medium">Monthly effect</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-b border-border">
                      <th scope="row" className="py-2.5 pr-3 text-left font-normal text-foreground">Cash</th>
                      <td className="py-2.5 pr-3 tabular-nums">{money(result.netCost)}</td>
                      <td className="py-2.5 tabular-nums">+{money(result.monthlySavings)} saved</td>
                    </tr>
                    <tr className="border-b border-border">
                      <th scope="row" className="py-2.5 pr-3 text-left font-normal text-foreground">Loan</th>
                      <td className="py-2.5 pr-3 tabular-nums">{money(0)}</td>
                      <td className="py-2.5 tabular-nums">
                        {result.loanMonthlyDelta >= 0 ? "+" : "−"}
                        {money(Math.abs(result.loanMonthlyDelta))} net
                      </td>
                    </tr>
                    <tr>
                      <th scope="row" className="py-2.5 pr-3 text-left font-normal text-foreground">Lease / PPA</th>
                      <td className="py-2.5 pr-3 tabular-nums">{money(0)}</td>
                      <td className="py-2.5 tabular-nums">+{money(result.leaseMonthlySavings)} saved</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Loan assumes {(assumptions.loanApr * 100).toFixed(2)}% APR over{" "}
                {assumptions.loanTermYears} years on {money(result.grossCost + result.batteryGrossCost)}, with the
                tax credit returned to you. A lease or PPA has no upfront cost, but the installer keeps
                the tax credit and your savings are smaller.
              </p>
            </Panel>
          </div>

          {/* Sensitivity */}
          <Panel title="What if the assumptions are wrong?">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Payback depends heavily on utility rates, install price, and real production. These
              scenarios re-run the math with one variable changed at a time. Net gain is lifetime
              bill savings minus what the system costs you after incentives.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Sensitivity of payback and savings to key assumptions</caption>
                <thead>
                  <tr className="border-b border-border text-left">
                    <th scope="col" className="py-2 pr-3 font-medium">Scenario</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Change</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Payback</th>
                    <th scope="col" className="py-2 font-medium">
                      {assumptions.horizonYears}-yr net gain
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.scenarios.map((s) => (
                    <tr key={s.label} className="border-b border-border last:border-0">
                      <th scope="row" className="py-2.5 pr-3 text-left font-normal">{s.label}</th>
                      <td className="py-2.5 pr-3 text-muted-foreground">{s.detail}</td>
                      <td className="py-2.5 pr-3 tabular-nums text-muted-foreground">
                        {fmtYears(s.paybackYears)}
                      </td>
                      <td className="py-2.5 tabular-nums text-muted-foreground">
                        {money(s.netSavings)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          {/* Battery */}
          <Panel title="Should you add a battery?" icon={<BatteryCharging className="size-4 text-primary" aria-hidden="true" />}>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide",
                  result.batteryVerdict === "recommended"
                    ? "bg-primary/15 text-foreground"
                    : result.batteryVerdict === "optional"
                      ? "bg-accent text-accent-foreground"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {result.batteryVerdict === "recommended"
                  ? "A battery likely makes sense"
                  : result.batteryVerdict === "optional"
                    ? "A battery is optional here"
                    : "A battery is hard to justify financially"}
              </span>
              <span className="text-sm text-muted-foreground">
                Storage adds about {money(assumptions.batteryCost)} before the tax credit, or{" "}
                {money(assumptions.batteryCost * (1 - assumptions.itcPercent))} after.
              </span>
            </div>
            <ul className="mt-4 flex flex-col gap-2.5">
              {result.batteryReasons.map((r) => (
                <li key={r} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
                  <BatteryCharging className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              On bill savings alone a battery typically takes{" "}
              {result.batteryPaybackYears ? `${result.batteryPaybackYears.toFixed(0)} years or more` : "many years"}{" "}
              to pay back, so most homeowners buy one for backup power and resilience rather than pure return.
            </p>
          </Panel>

          {/* Assumptions */}
          <Panel title="Assumptions behind every number" icon={<Info className="size-4 text-primary" aria-hidden="true" />}>
            <p className="text-sm leading-relaxed text-muted-foreground">
              These are national averages, not quotes. Change any of them and every figure above
              updates.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Install price ($/watt)" htmlFor="a-ppw">
                <Input
                  id="a-ppw"
                  inputMode="decimal"
                  value={assumptions.pricePerWatt}
                  onChange={(e) => setAssumption("pricePerWatt", Number.parseFloat(e.target.value) || 0)}
                />
              </Field>
              <Field label="Federal credit (%)" htmlFor="a-itc">
                <Input
                  id="a-itc"
                  inputMode="decimal"
                  value={assumptions.itcPercent * 100}
                  onChange={(e) =>
                    setAssumption("itcPercent", (Number.parseFloat(e.target.value) || 0) / 100)
                  }
                />
              </Field>
              <Field label="Other rebates ($)" htmlFor="a-rebate">
                <Input
                  id="a-rebate"
                  inputMode="decimal"
                  value={assumptions.stateRebate}
                  onChange={(e) => setAssumption("stateRebate", Number.parseFloat(e.target.value) || 0)}
                />
              </Field>
              <Field label="Rate increase (%/yr)" htmlFor="a-esc">
                <Input
                  id="a-esc"
                  inputMode="decimal"
                  value={assumptions.rateEscalation * 100}
                  onChange={(e) =>
                    setAssumption("rateEscalation", (Number.parseFloat(e.target.value) || 0) / 100)
                  }
                />
              </Field>
            </div>
            <dl className="mt-5 grid gap-x-8 gap-y-3 border-t border-border pt-4 text-sm sm:grid-cols-2">
              {[
                ["Sun hours used", `${result.location.sunHours} kWh/m²/day (${result.location.stateName})`],
                ["Electricity rate", `${money(result.rate, 2)}/kWh ${result.rateIsAssumed ? "(state average)" : "(you provided)"}`],
                ["System losses", `${Math.round((1 - assumptions.derate) * 100)}% for inverter, wiring, heat, soiling`],
                ["Orientation factor", `${ORIENTATION_LABELS[orientation]} — ${Math.round((result.productionPerKw / (result.location.sunHours * 365 * assumptions.derate)) * 100)}% of ideal`],
                ["Panel degradation", `${(assumptions.degradation * 100).toFixed(1)}% output lost per year`],
                ["Production per kW", `${fmtNumber(result.productionPerKw)} kWh per kW per year`],
                ["EV load added", result.evKwh ? `${fmtNumber(result.evKwh)} kWh/yr` : "None"],
                ["Analysis horizon", `${assumptions.horizonYears} years`],
              ].map(([term, value]) => (
                <div key={term} className="flex flex-col gap-0.5">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">{term}</dt>
                  <dd className="text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
              Estimates only. Actual results depend on your utility&apos;s tariff and net metering
              rules, roof measurements, equipment, installer pricing, and your tax situation. The
              federal credit is nonrefundable, so it assumes you owe enough tax to use it. Get at
              least three quotes before deciding.
            </p>
          </Panel>
        </>
      ) : null}
    </div>
  )
}
