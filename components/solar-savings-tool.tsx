"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowRight,
  BatteryCharging,
  CircleAlert,
  CircleCheck,
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

  const assumptions: Assumptions = DEFAULT_ASSUMPTIONS

  const billNum = Number.parseFloat(bill) || 0
  const kwhNum = Number.parseFloat(kwh) || 0
  const ready = zip.replace(/\D/g, "").length >= 3 && (billNum > 0 || kwhNum > 0)
  const [refined, setRefined] = useState(false)
  const showResults = ready && refined

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
    publishScene(showResults ? snapshotFromSavings(result, wantsBattery) : null)
  }, [showResults, result, wantsBattery, publishScene])


  const milestones = [5, 10, 15, 20, 25].filter((y) => y <= assumptions.horizonYears)
  const maxCumulative = result.savingsByYear[result.savingsByYear.length - 1]?.cumulative || 1

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <h2 className="text-pretty font-serif text-3xl font-semibold tracking-tight md:text-4xl">
          Should you go solar? Find out now.
        </h2>
        <p className="text-pretty leading-relaxed text-muted-foreground">
          This tool estimates system size, cost after incentives, payback period, and 25-year
          savings.
        </p>
      </div>

      {/* Form aligned with the heading at half width; the empty-state placeholder sits to its right, full results stack below */}
      <div className="grid gap-6 lg:grid-cols-8 lg:items-start">
        {/* Form */}
        <div className="lg:col-span-4 lg:col-start-1">
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
                    onClick={() => {
                      setRefined(true)
                      setStep((s) => Math.min(STEPS.length - 1, s + 1))
                    }}
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
        <div className={showResults ? "lg:col-span-4" : "lg:col-span-2 lg:self-stretch"}>
          <div className="flex h-full flex-col gap-4">
            {!showResults ? (
              <div className="h-full rounded-lg border border-dashed border-border bg-card p-6">
                <h3 className="font-serif text-lg font-semibold">Your estimate appears here</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Enter a ZIP code and your average monthly bill, then select Refine estimate to see
                  system size, cost, payback, and savings over time.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                  <Panel
                    title="Cash vs. financing vs. lease"
                    icon={<TrendingUp className="size-4 text-primary" aria-hidden="true" />}
                  >
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

                    <div className="mt-5 border-t border-border pt-4">
                      <h4 className="text-sm font-medium">Cumulative savings over time (cash)</h4>
                      <dl className="mt-3 grid grid-cols-2 gap-4">
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
                      <div className="mt-4 flex h-44 gap-3">
                        {milestones.map((y) => {
                          const row = result.savingsByYear[y - 1]
                          const value = row?.cumulative ?? 0
                          const pct = Math.max(4, (value / maxCumulative) * 100)
                          return (
                            <div key={y} className="flex h-full flex-1 flex-col items-center gap-2">
                              <span className="font-serif text-xs tabular-nums text-muted-foreground">
                                {money(value)}
                              </span>
                              <div className="flex min-h-0 w-full flex-1 items-end">
                                <div
                                  className="w-full rounded-t bg-primary/70"
                                  style={{ height: `${pct}%` }}
                                  role="img"
                                  aria-label={`By year ${y}, about ${money(value)} saved`}
                                />
                              </div>
                              <span className="text-xs tabular-nums text-muted-foreground">Yr {y}</span>
                            </div>
                          )
                        })}
                      </div>
                      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                        Assumes utility rates rise {(assumptions.rateEscalation * 100).toFixed(1)}% a year and
                        panels lose {(assumptions.degradation * 100).toFixed(1)}% output annually.
                      </p>
                    </div>
                  </Panel>

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
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
