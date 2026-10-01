"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowRight,
  BatteryCharging,
  CircleAlert,
  CircleCheck,
  House,
  TrendingUp,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Field, Segmented, selectClass } from "@/components/calculator-ui"
import { cn } from "@/lib/utils"
import { usePublishSolarScene } from "@/components/solar/solar-scene-context"
import { snapshotFromSavings } from "@/lib/solar-scene"
import {
  DEFAULT_ASSUMPTIONS,
  ROOF_REPLACEMENT_COSTS,
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
    roofGrossCost: number
  },
  loanTermYears: number,
): number {
  const billSavings = year > 0 ? (result.savingsByYear[year - 1]?.cumulative ?? 0) : 0
  if (mode === "cash") return billSavings - result.netCost
  if (mode === "finance") {
    if (year === 0) return 0
    const paymentsSoFar = result.loanMonthlyPayment * 12 * Math.min(year, loanTermYears)
    return billSavings + result.itcAmount - paymentsSoFar
  }
  // A lease covers the panels, but a new roof is still paid for upfront.
  return result.leaseMonthlySavings * 12 * year - result.roofGrossCost
}

function AddOnToggle({
  id,
  checked,
  onChange,
  icon: Icon,
  label,
  title,
}: {
  id: string
  checked: boolean
  onChange: (checked: boolean) => void
  icon: typeof House
  label: string
  title: string
}) {
  return (
    <label
      htmlFor={id}
      title={title}
      className={cn(
        "flex w-full shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm transition-colors",
        checked
          ? "border-primary/60 bg-primary/5 text-foreground"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-primary"
      />
      <Icon className="size-4 text-primary" aria-hidden="true" />
      {label}
    </label>
  )
}

function signedMoney(value: number): string {
  return value < 0 ? `−${money(Math.abs(value))}` : money(value)
}

export function SolarSavingsTool() {

  // Step 1 — the fastest path to a number.
  const [zip, setZip] = useState("")
  const [bill, setBill] = useState("180")
  const [kwh, setKwh] = useState("")
  const [rate, setRate] = useState("")

  // Step 2 — roof and sun.
  const roofCondition: RoofCondition = "good"
  const [roofType, setRoofType] = useState<RoofType>("asphalt")
  const orientation: Orientation = "south"
  const [shade, setShade] = useState<Shade>("light")

  const [hasEv, setHasEv] = useState(false)
  const [wantsBattery, setWantsBattery] = useState(false)
  const [wantsNewRoof, setWantsNewRoof] = useState(false)
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
          utility: "",
          roofCondition,
          roofType,
          orientation,
          shade,
          hasEv,
          wantsBattery,
          wantsNewRoof,
          yearsInHome: YEARS_IN_HOME,
          payment,
        },
        assumptions,
      ),
    [
      zip, billNum, kwhNum, rate, roofCondition, roofType,
      orientation, shade, hasEv, wantsBattery, wantsNewRoof, payment, assumptions,
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
          netCostNote: `${money(result.grossCost + result.batteryGrossCost)} gross less ${money(result.itcAmount)} tax credit${result.roofGrossCost > 0 ? `, plus ${money(result.roofGrossCost)} new roof` : ""}`,
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
            netCost: result.roofGrossCost,
            netCostNote:
              result.roofGrossCost > 0
                ? "The installer owns the system; you pay for the new roof"
                : "No purchase; the installer owns the system",
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-8 lg:items-start">
        {/* Form */}
        <div className="lg:col-span-4 lg:col-start-1">
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-5 py-3">
              <h3 className="text-sm font-medium text-foreground">Your bill, roof & sun</h3>
            </div>

            <div className="p-5">
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
                  <div className="grid gap-4 sm:grid-cols-2">
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
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Do you have an EV?" hint="Adds home charging load.">
                      <Segmented
                        ariaLabel="Electric vehicle"
                        value={hasEv ? "yes" : "no"}
                        onChange={(v) => setHasEv(v === "yes")}
                        singleRow
                        options={[
                          { value: "no", label: "No" },
                          { value: "yes", label: "Yes", title: "Yes, I charge at home" },
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
                    <Field label="Shade level" htmlFor="solar-shade" hint="Biggest drag on production.">
                      <select
                        id="solar-shade"
                        className={selectClass}
                        value={shade}
                        onChange={(e) => setShade(e.target.value as Shade)}
                      >
                        {(Object.keys(SHADE_LABELS) as Shade[]).map((v) => (
                          <option key={v} value={v} title={SHADE_LABELS[v]}>
                            {SHADE_SHORT_LABELS[v]}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </div>

              <div className="mt-5 flex items-center justify-end border-t border-border pt-4">
                {refined ? (
                  <span className="text-sm text-muted-foreground">Results update as you edit</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setRefined(true)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    See my estimate
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Live results */}
        <div className={showResults ? "lg:col-span-4" : "lg:col-span-4 lg:self-stretch"}>
          <div className="flex h-full flex-col gap-4">
            {!showResults ? (
              <div className="h-full rounded-lg border border-dashed border-border bg-card p-6">
                <h3 className="font-serif text-lg font-semibold">Your estimate appears here</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Enter a ZIP code and your average monthly bill, then select See my estimate to see
                  cost, payback, and savings over time.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                  <section
                    aria-labelledby="savings-over-time-heading"
                    className="rounded-lg border border-border bg-card px-5 pt-3 pb-5"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex flex-col gap-4">
                        <div className="grid w-fit grid-cols-[auto_auto] items-end gap-x-2 gap-y-1.5 [&_label]:whitespace-nowrap max-sm:gap-x-1.5 max-sm:[&_label]:px-2">
                          <h3
                            id="savings-over-time-heading"
                            className="flex items-center gap-2 font-serif text-lg font-semibold leading-tight"
                          >
                            <TrendingUp className="size-4 text-primary" aria-hidden="true" />
                            Savings over time
                          </h3>
                          <div>
                            <AddOnToggle
                              id="solar-add-roof"
                              checked={wantsNewRoof}
                              onChange={setWantsNewRoof}
                              icon={House}
                              label="New roof"
                              title={`+${money(ROOF_REPLACEMENT_COSTS[roofType])}, not eligible for the tax credit`}
                            />
                          </div>
                          <div className="[&>div]:flex-nowrap [&_button]:whitespace-nowrap max-sm:[&_button]:px-2">
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
                          </div>
                          <AddOnToggle
                            id="solar-add-battery"
                            checked={wantsBattery}
                            onChange={setWantsBattery}
                            icon={BatteryCharging}
                            label="Battery"
                            title={`+${money(assumptions.batteryCost * (1 - assumptions.itcPercent))} after credit`}
                          />
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
                  </section>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
