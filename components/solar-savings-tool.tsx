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
import { Field, Segmented, selectClass } from "@/components/calculator-ui"
import { cn } from "@/lib/utils"
import { usePublishSolarScene } from "@/components/solar/solar-scene-context"
import { snapshotFromSavings } from "@/lib/solar-scene"
import {
  DEFAULT_ASSUMPTIONS,
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

const STEPS = ["Your bill", "Roof & sun"] as const
const YEARS_IN_HOME = 15

const SHADE_SHORT_LABELS: Record<Shade, string> = {
  none: "None",
  light: "Light",
  moderate: "Moderate",
  heavy: "Heavy",
}

function cumulativeFor(
  mode: Payment,
  year: number,
  result: {
    savingsByYear: Array<{ cumulative: number }>
    itcAmount: number
    netCost: number
    loanMonthlyPayment: number
    leaseMonthlySavings: number
  },
  loanTermYears: number,
): number {
  const billSavings = year > 0 ? (result.savingsByYear[year - 1]?.cumulative ?? 0) : 0
  if (mode === "cash") return billSavings - result.netCost
  if (year === 0) return 0
  if (mode === "finance") {
    const paymentsSoFar = result.loanMonthlyPayment * 12 * Math.min(year, loanTermYears)
    return billSavings + result.itcAmount - paymentsSoFar
  }
  return result.leaseMonthlySavings * 12 * year
}

function signedMoney(value: number): string {
  return value < 0 ? `−${money(Math.abs(value))}` : money(value)
}

export function SolarSavingsTool() {
  const [step, setStep] = useState(0)

  // Step 1 — the fastest path to a number.
  const [zip, setZip] = useState("")
  const [bill, setBill] = useState("180")
  const [kwh, setKwh] = useState("")
  const [rate, setRate] = useState("")
  const [utility, setUtility] = useState("")

  // Step 2 — roof and sun.
  const roofCondition: RoofCondition = "good"
  const [roofType, setRoofType] = useState<RoofType>("asphalt")
  const orientation: Orientation = "south"
  const [shade, setShade] = useState<Shade>("light")

  const [hasEv, setHasEv] = useState(false)
  const [wantsBattery, setWantsBattery] = useState(false)
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
          yearsInHome: YEARS_IN_HOME,
          payment,
        },
        assumptions,
      ),
    [
      zip, billNum, kwhNum, rate, utility, roofCondition, roofType,
      orientation, shade, hasEv, wantsBattery, payment, assumptions,
    ],
  )

  // Publish results up to the 3D explorer above the tabs. Only once the inputs
  // are sufficient for a real number; before that the scene keeps its mock so it
  // never shows a misleading half-filled house.
  const publishScene = usePublishSolarScene()
  useEffect(() => {
    publishScene(showResults ? snapshotFromSavings(result, wantsBattery) : null)
  }, [showResults, result, wantsBattery, publishScene])


  const milestones = [0, 5, 10, 15, 20, 25].filter((y) => y <= assumptions.horizonYears)
  const chartSeries = milestones.map((y) => ({
    year: y,
    value: cumulativeFor(payment, y, result, assumptions.loanTermYears),
  }))
  const maxPositive = Math.max(0, ...chartSeries.map((p) => p.value))
  const maxNegative = Math.max(0, ...chartSeries.map((p) => -p.value))
  const chartRange = Math.max(1, maxPositive + maxNegative)
  const positiveShare = (maxPositive / chartRange) * 100
  const horizonValue = cumulativeFor(
    payment,
    assumptions.horizonYears,
    result,
    assumptions.loanTermYears,
  )
  const chartSummary =
    payment === "cash"
      ? { label: "Payback", value: fmtYears(result.paybackYears) }
      : payment === "finance"
        ? {
            label: "Monthly net",
            value: `${result.loanMonthlyDelta >= 0 ? "+" : "−"}${money(Math.abs(result.loanMonthlyDelta))}`,
          }
        : { label: "Monthly saved", value: `+${money(result.leaseMonthlySavings)}` }

  const loanTotalPaid = result.loanMonthlyPayment * 12 * assumptions.loanTermYears
  const metrics =
    payment === "cash"
      ? {
          netCost: result.netCost,
          netCostNote: `${money(result.grossCost + result.batteryGrossCost)} gross less ${money(result.itcAmount)} tax credit`,
          monthly: result.monthlySavings,
          monthlyNote: `${money(result.year1Savings)} in the first year`,
        }
      : payment === "finance"
        ? {
            netCost: Math.max(0, loanTotalPaid - result.itcAmount),
            netCostNote: `${money(loanTotalPaid)} in loan payments over ${assumptions.loanTermYears} years less ${money(result.itcAmount)} tax credit`,
            monthly: result.loanMonthlyDelta,
            monthlyNote: `${money(result.monthlySavings)} bill savings less ${money(result.loanMonthlyPayment)} loan payment`,
          }
        : {
            netCost: 0,
            netCostNote: "No purchase; the installer owns the system",
            monthly: result.leaseMonthlySavings,
            monthlyNote: "Bill savings after your lease or PPA payment",
          }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <h2 className="text-pretty font-serif text-3xl font-semibold tracking-tight md:text-4xl">
          Should you go solar? Find out now.
        </h2>
        <p className="text-pretty leading-relaxed text-muted-foreground">
          This tool estimates cost after incentives, payback period, and 25-year savings.
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
                    <Field label="Do you have an EV?" hint="Adds home charging load to your usage.">
                      <Segmented
                        ariaLabel="Electric vehicle"
                        value={hasEv ? "yes" : "no"}
                        onChange={(v) => setHasEv(v === "yes")}
                        singleRow
                        options={[
                          { value: "no", label: "No EV" },
                          { value: "yes", label: "Yes, at home", title: "Yes, I charge at home" },
                        ]}
                      />
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
                  <Field label="Shade level" hint="Shade is the biggest single drag on production.">
                    <Segmented
                      ariaLabel="Shade level"
                      value={shade}
                      onChange={setShade}
                      singleRow
                      options={(Object.keys(SHADE_LABELS) as Shade[]).map((v) => ({
                        value: v,
                        label: SHADE_SHORT_LABELS[v],
                        title: SHADE_LABELS[v],
                      }))}
                    />
                  </Field>
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
                  cost, payback, and savings over time.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                  <section
                    aria-labelledby="savings-over-time-heading"
                    className="rounded-lg border border-border bg-card p-5"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex flex-col gap-4">
                        <h3
                          id="savings-over-time-heading"
                          className="flex items-center gap-2 font-serif text-lg font-semibold"
                        >
                          <TrendingUp className="size-4 text-primary" aria-hidden="true" />
                          Savings over time
                        </h3>
                        <div className="flex flex-wrap items-center gap-2">
                          <Segmented<Payment>
                          value={payment}
                          onChange={setPayment}
                          ariaLabel="Show cumulative savings for"
                          options={[
                            { value: "cash", label: "Cash" },
                            { value: "finance", label: "Loan" },
                            { value: "lease", label: "Lease / PPA" },
                          ]}
                          />
                          <label
                            htmlFor="solar-add-battery"
                            title={`+${money(assumptions.batteryCost * (1 - assumptions.itcPercent))} after credit`}
                            className={cn(
                              "flex w-fit shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-2 text-sm transition-colors",
                              wantsBattery
                                ? "border-primary/60 bg-primary/5 text-foreground"
                                : "border-border text-muted-foreground hover:text-foreground",
                            )}
                          >
                            <input
                              id="solar-add-battery"
                              type="checkbox"
                              checked={wantsBattery}
                              onChange={(e) => setWantsBattery(e.target.checked)}
                              className="size-4 accent-primary"
                            />
                            <BatteryCharging className="size-4 text-primary" aria-hidden="true" />
                            Battery
                          </label>
                        </div>
                        <dl className="grid grid-cols-2 gap-4">
                          <div>
                            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                              {chartSummary.label}
                            </dt>
                            <dd className="font-serif text-2xl tabular-nums">{chartSummary.value}</dd>
                          </div>
                          <div>
                            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                              {assumptions.horizonYears}-yr net savings
                            </dt>
                            <dd className="font-serif text-2xl tabular-nums">{signedMoney(horizonValue)}</dd>
                          </div>
                        </dl>
                      </div>
                      <dl
                        aria-label="Your estimate"
                        className="grid grid-cols-3 gap-3 rounded-md border border-border bg-muted/40 px-3 py-2.5 sm:grid-cols-1 sm:gap-2 sm:text-right"
                      >
                      <div title={metrics.netCostNote}>
                        <dt className="text-xs text-muted-foreground">Net cost</dt>
                        <dd className="font-serif text-base font-semibold tabular-nums">{money(metrics.netCost)}</dd>
                      </div>
                      <div title={metrics.monthlyNote}>
                        <dt className="text-xs text-muted-foreground">Monthly savings</dt>
                        <dd className="font-serif text-base font-semibold tabular-nums">{signedMoney(metrics.monthly)}</dd>
                        </div>
                        <div title={`Net gain of ${money(result.netLifetimeGain)} over ${assumptions.horizonYears} years`}>
                          <dt className="text-xs text-muted-foreground">Estimated ROI</dt>
                          <dd className="font-serif text-base font-semibold tabular-nums">{fmtNumber(result.roiPercent)}%</dd>
                        </div>
                      </dl>
                    </div>
                    <div className="mt-4 flex h-52 gap-2">
                      {chartSeries.map(({ year, value }) => {
                        const positivePct = value > 0 && maxPositive > 0 ? (value / maxPositive) * 100 : 0
                        const negativePct = value < 0 && maxNegative > 0 ? (-value / maxNegative) * 100 : 0
                        return (
                          <div key={year} className="flex h-full flex-1 flex-col items-center gap-2">
                            <span
                              className={cn(
                                "font-serif text-xs tabular-nums",
                                value < 0 ? "text-foreground" : "text-muted-foreground",
                              )}
                            >
                              {signedMoney(value)}
                            </span>
                            <div
                              className="flex min-h-0 w-full flex-1 flex-col"
                              role="img"
                              aria-label={
                                year === 0
                                  ? `Year 0, upfront: ${signedMoney(value)}`
                                  : `By year ${year}, about ${signedMoney(value)} ${value >= 0 ? "ahead" : "behind"}`
                              }
                            >
                              <div className="flex w-full items-end" style={{ height: `${positiveShare}%` }}>
                                <div
                                  className="w-full rounded-t bg-primary/70 transition-[height] duration-300"
                                  style={{ height: `${positivePct}%` }}
                                />
                              </div>
                              <div
                                className="flex w-full flex-1 items-start border-t border-foreground/40"
                              >
                                <div
                                  className="w-full rounded-b bg-muted-foreground/40 transition-[height] duration-300"
                                  style={{ height: `${negativePct}%` }}
                                />
                              </div>
                            </div>
                            <span className="text-xs tabular-nums text-muted-foreground">Yr {year}</span>
                          </div>
                        )
                      })}
                    </div>
                    <dl className="mt-4 flex flex-col gap-3 text-sm leading-relaxed">
                      {[
                        {
                          mode: "cash" as const,
                          term: "Cash",
                          description: `You buy the system outright and own it. You pay ${money(result.netCost)} upfront after the ${money(result.itcAmount)} tax credit, then keep every dollar of bill savings. Highest long-term return.`,
                        },
                        {
                          mode: "finance" as const,
                          term: "Loan",
                          description: `You own the system but borrow the cost, so nothing is due upfront. You repay it over ${assumptions.loanTermYears} years at ${(assumptions.loanApr * 100).toFixed(2)}% APR and still get the tax credit. Savings grow once the loan is paid off.`,
                        },
                        {
                          mode: "lease" as const,
                          term: "Lease / PPA",
                          description:
                            "An installer owns the panels on your roof. You pay a monthly lease, or a set rate for the power they produce (a power purchase agreement). No upfront cost, but the installer keeps the tax credit, so your savings are smaller.",
                        },
                      ]
                        .filter(({ mode }) => mode === payment)
                        .map(({ mode, term, description }) => (
                        <div
                          key={mode}
                          aria-live="polite"
                          className="rounded-md border border-primary/50 bg-primary/5 px-3 py-2.5"
                        >
                          <dt className="font-medium text-foreground">{term}</dt>
                          <dd className="mt-0.5 text-muted-foreground">{description}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="mt-3 rounded-md border border-border px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
                      <p>
                        <span className="font-medium text-foreground">
                          {result.batteryVerdict === "recommended"
                            ? "A battery likely makes sense."
                            : result.batteryVerdict === "optional"
                              ? "A battery is optional here."
                              : "A battery is hard to justify financially."}
                        </span>{" "}
                        {result.batteryReasons.join(" ")} On bill savings alone it takes{" "}
                        {result.batteryPaybackYears ? `${result.batteryPaybackYears.toFixed(0)}+ years` : "many years"}{" "}
                        to pay back, so most people add one for backup power rather than return.
                      </p>
                    </div>
                  </section>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
