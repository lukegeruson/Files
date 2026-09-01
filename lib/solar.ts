// Pure, dependency-free solar estimation engine.
// No database or React imports, so it is safe to use from client components.
//
// Every number produced here is an ESTIMATE derived from the documented
// assumptions below. Real quotes vary by installer, utility tariff, and roof.

import { resolveStateFromZip } from "@/lib/zip"

export type Orientation = "south" | "south-adjacent" | "east-west" | "north"
export type Shade = "none" | "light" | "moderate" | "heavy"
export type RoofType = "asphalt" | "metal" | "tile" | "flat"
export type RoofCondition = "new" | "good" | "aging" | "old"
export type Payment = "cash" | "finance" | "lease"
export type Verdict = "favorable" | "consider" | "not-yet"

export type SolarInputs = {
  zip: string
  monthlyBill: number
  /** Optional: if the homeowner knows their usage, it overrides the bill estimate. */
  monthlyKwh: number | null
  /** Optional: $/kWh. Falls back to the state average. */
  rate: number | null
  utility: string
  roofCondition: RoofCondition
  roofType: RoofType
  orientation: Orientation
  shade: Shade
  hasEv: boolean
  wantsBattery: boolean
  yearsInHome: number
  payment: Payment
}

export type Assumptions = {
  /** Installed cost before incentives, $ per watt. */
  pricePerWatt: number
  /** Federal residential clean energy credit, as a fraction. */
  itcPercent: number
  /** Additional state/local/utility rebate, flat $. */
  stateRebate: number
  /** Annual utility rate escalation. */
  rateEscalation: number
  /** Annual panel output loss. */
  degradation: number
  /** System derate: inverter, wiring, soiling, temperature. */
  derate: number
  loanApr: number
  loanTermYears: number
  /** Installed cost of a ~13.5 kWh home battery, before incentives. */
  batteryCost: number
  /** Analysis horizon in years. */
  horizonYears: number
  /** Extra annual load added by charging an EV at home. */
  evAnnualKwh: number
  /** PPA/lease price as a fraction of the retail utility rate. */
  ppaRateFactor: number
}

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  pricePerWatt: 3.0,
  itcPercent: 0.3,
  stateRebate: 0,
  rateEscalation: 0.03,
  degradation: 0.005,
  derate: 0.85,
  loanApr: 0.0699,
  loanTermYears: 20,
  batteryCost: 13000,
  horizonYears: 25,
  evAnnualKwh: 3200,
  ppaRateFactor: 0.75,
}

// --- Location data ---------------------------------------------------------
// sun = average daily peak sun hours (kWh/m2/day), rate = avg residential $/kWh.

type StateData = { name: string; sun: number; rate: number }

const STATES: Record<string, StateData> = {
  AL: { name: "Alabama", sun: 4.6, rate: 0.155 },
  AK: { name: "Alaska", sun: 3.2, rate: 0.245 },
  AZ: { name: "Arizona", sun: 6.5, rate: 0.145 },
  AR: { name: "Arkansas", sun: 4.7, rate: 0.125 },
  CA: { name: "California", sun: 5.6, rate: 0.31 },
  CO: { name: "Colorado", sun: 5.5, rate: 0.15 },
  CT: { name: "Connecticut", sun: 4.3, rate: 0.3 },
  DE: { name: "Delaware", sun: 4.4, rate: 0.145 },
  DC: { name: "Washington, DC", sun: 4.3, rate: 0.155 },
  FL: { name: "Florida", sun: 5.3, rate: 0.155 },
  GA: { name: "Georgia", sun: 4.9, rate: 0.14 },
  HI: { name: "Hawaii", sun: 5.6, rate: 0.42 },
  ID: { name: "Idaho", sun: 4.9, rate: 0.11 },
  IL: { name: "Illinois", sun: 4.4, rate: 0.16 },
  IN: { name: "Indiana", sun: 4.4, rate: 0.145 },
  IA: { name: "Iowa", sun: 4.5, rate: 0.135 },
  KS: { name: "Kansas", sun: 5.1, rate: 0.14 },
  KY: { name: "Kentucky", sun: 4.4, rate: 0.13 },
  LA: { name: "Louisiana", sun: 4.8, rate: 0.12 },
  ME: { name: "Maine", sun: 4.2, rate: 0.25 },
  MD: { name: "Maryland", sun: 4.4, rate: 0.16 },
  MA: { name: "Massachusetts", sun: 4.3, rate: 0.31 },
  MI: { name: "Michigan", sun: 4.1, rate: 0.19 },
  MN: { name: "Minnesota", sun: 4.4, rate: 0.145 },
  MS: { name: "Mississippi", sun: 4.7, rate: 0.13 },
  MO: { name: "Missouri", sun: 4.7, rate: 0.125 },
  MT: { name: "Montana", sun: 4.5, rate: 0.12 },
  NE: { name: "Nebraska", sun: 4.8, rate: 0.115 },
  NV: { name: "Nevada", sun: 6.4, rate: 0.15 },
  NH: { name: "New Hampshire", sun: 4.2, rate: 0.23 },
  NJ: { name: "New Jersey", sun: 4.4, rate: 0.18 },
  NM: { name: "New Mexico", sun: 6.5, rate: 0.145 },
  NY: { name: "New York", sun: 4.2, rate: 0.23 },
  NC: { name: "North Carolina", sun: 4.8, rate: 0.135 },
  ND: { name: "North Dakota", sun: 4.4, rate: 0.105 },
  OH: { name: "Ohio", sun: 4.2, rate: 0.155 },
  OK: { name: "Oklahoma", sun: 5.1, rate: 0.115 },
  OR: { name: "Oregon", sun: 4.1, rate: 0.115 },
  PA: { name: "Pennsylvania", sun: 4.2, rate: 0.175 },
  PR: { name: "Puerto Rico", sun: 5.3, rate: 0.22 },
  RI: { name: "Rhode Island", sun: 4.3, rate: 0.27 },
  SC: { name: "South Carolina", sun: 4.9, rate: 0.14 },
  SD: { name: "South Dakota", sun: 4.6, rate: 0.125 },
  TN: { name: "Tennessee", sun: 4.5, rate: 0.125 },
  TX: { name: "Texas", sun: 5.2, rate: 0.15 },
  UT: { name: "Utah", sun: 5.6, rate: 0.115 },
  VT: { name: "Vermont", sun: 4.2, rate: 0.21 },
  VA: { name: "Virginia", sun: 4.5, rate: 0.14 },
  WA: { name: "Washington", sun: 3.9, rate: 0.11 },
  WV: { name: "West Virginia", sun: 4.2, rate: 0.145 },
  WI: { name: "Wisconsin", sun: 4.3, rate: 0.165 },
  WY: { name: "Wyoming", sun: 5.2, rate: 0.11 },
}

export type ResolvedLocation = {
  stateCode: string
  stateName: string
  sunHours: number
  defaultRate: number
  /** True when the ZIP could not be matched and a national average was used. */
  isFallback: boolean
}

const NATIONAL: ResolvedLocation = {
  stateCode: "US",
  stateName: "national average",
  sunHours: 4.7,
  defaultRate: 0.165,
  isFallback: true,
}

export function resolveLocation(zip: string): ResolvedLocation {
  const state = resolveStateFromZip(zip)
  if (!state) return NATIONAL
  const data = STATES[state.code]
  if (!data) return NATIONAL
  return {
    stateCode: state.code,
    stateName: data.name,
    sunHours: data.sun,
    defaultRate: data.rate,
    isFallback: false,
  }
}

// --- Derate factors --------------------------------------------------------

export const ORIENTATION_FACTORS: Record<Orientation, number> = {
  south: 1.0,
  "south-adjacent": 0.96,
  "east-west": 0.87,
  north: 0.72,
}

export const SHADE_FACTORS: Record<Shade, number> = {
  none: 1.0,
  light: 0.93,
  moderate: 0.82,
  heavy: 0.65,
}

/** Roof type changes labor/mounting cost, not production. */
export const ROOF_COST_FACTORS: Record<RoofType, number> = {
  asphalt: 1.0,
  metal: 1.02,
  tile: 1.12,
  flat: 1.06,
}

export const ORIENTATION_LABELS: Record<Orientation, string> = {
  south: "Mostly south-facing",
  "south-adjacent": "Southeast or southwest",
  "east-west": "East and/or west",
  north: "Mostly north-facing",
}

export const SHADE_LABELS: Record<Shade, string> = {
  none: "Full sun, no shade",
  light: "Light shade",
  moderate: "Moderate shade",
  heavy: "Heavy shade",
}

export const ROOF_TYPE_LABELS: Record<RoofType, string> = {
  asphalt: "Asphalt shingle",
  metal: "Metal",
  tile: "Clay or concrete tile",
  flat: "Flat / low-slope",
}

export const ROOF_CONDITION_LABELS: Record<RoofCondition, string> = {
  new: "New (0-5 years)",
  good: "Good (6-14 years)",
  aging: "Aging (15-20 years)",
  old: "Old (20+ years)",
}

export const PAYMENT_LABELS: Record<Payment, string> = {
  cash: "Pay cash",
  finance: "Finance with a loan",
  lease: "Lease or PPA",
}

// --- Core math -------------------------------------------------------------

export type Scenario = {
  label: string
  detail: string
  paybackYears: number | null
  /** Lifetime bill savings minus the net system cost under this scenario. */
  netSavings: number
}

export type SolarResult = {
  location: ResolvedLocation
  rate: number
  rateIsAssumed: boolean
  annualKwh: number
  monthlyKwh: number
  evKwh: number

  productionPerKw: number
  systemSizeKw: number
  panelCount: number
  annualProduction: number
  offsetPercent: number

  grossCost: number
  batteryGrossCost: number
  itcAmount: number
  netCost: number

  year1Savings: number
  monthlySavings: number
  paybackYears: number | null
  cumulativeSavings: number
  netLifetimeGain: number
  roiPercent: number

  loanMonthlyPayment: number
  loanMonthlyDelta: number
  leaseMonthlySavings: number

  savingsByYear: Array<{ year: number; annual: number; cumulative: number }>
  scenarios: Scenario[]

  verdict: Verdict
  verdictHeadline: string
  reasons: string[]
  cautions: string[]
  batteryVerdict: "recommended" | "optional" | "skip"
  batteryReasons: string[]
  batteryPaybackYears: number | null
}

function loanPayment(principal: number, apr: number, years: number): number {
  if (principal <= 0) return 0
  const r = apr / 12
  const n = years * 12
  if (r === 0) return principal / n
  return (principal * r) / (1 - Math.pow(1 + r, -n))
}

function buildSavings(
  annualProduction: number,
  rate: number,
  a: Assumptions,
  years: number,
) {
  const rows: Array<{ year: number; annual: number; cumulative: number }> = []
  let cumulative = 0
  for (let y = 0; y < years; y++) {
    const annual =
      annualProduction *
      Math.pow(1 - a.degradation, y) *
      rate *
      Math.pow(1 + a.rateEscalation, y)
    cumulative += annual
    rows.push({ year: y + 1, annual, cumulative })
  }
  return rows
}

function paybackFrom(
  netCost: number,
  rows: Array<{ year: number; annual: number; cumulative: number }>,
): number | null {
  if (netCost <= 0) return 0
  for (const row of rows) {
    if (row.cumulative >= netCost) {
      const prior = row.cumulative - row.annual
      const fraction = row.annual > 0 ? (netCost - prior) / row.annual : 0
      return row.year - 1 + fraction
    }
  }
  return null
}

export function computeSolar(
  input: SolarInputs,
  assumptions: Assumptions = DEFAULT_ASSUMPTIONS,
): SolarResult {
  const a = assumptions
  const location = resolveLocation(input.zip)

  const rateIsAssumed = !input.rate || input.rate <= 0
  const rate = rateIsAssumed ? location.defaultRate : (input.rate as number)

  // Usage: prefer explicit kWh, otherwise derive from the bill.
  const monthlyKwh =
    input.monthlyKwh && input.monthlyKwh > 0
      ? input.monthlyKwh
      : Math.max(0, input.monthlyBill) / rate
  const evKwh = input.hasEv ? a.evAnnualKwh : 0
  const annualKwh = monthlyKwh * 12 + evKwh

  // Production per installed kW, after orientation, shade, and system losses.
  const productionPerKw =
    location.sunHours *
    365 *
    a.derate *
    ORIENTATION_FACTORS[input.orientation] *
    SHADE_FACTORS[input.shade]

  // Size to offset ~100% of usage, rounded to the nearest 0.5 kW.
  const rawSize = productionPerKw > 0 ? annualKwh / productionPerKw : 0
  const systemSizeKw = Math.max(0, Math.round(rawSize * 2) / 2)
  const panelCount = Math.ceil((systemSizeKw * 1000) / 400)
  const annualProduction = systemSizeKw * productionPerKw
  const offsetPercent = annualKwh > 0 ? (annualProduction / annualKwh) * 100 : 0

  // Cost: price per watt, adjusted for roof type and system-size economics.
  const sizePremium = systemSizeKw > 0 && systemSizeKw < 5 ? 1.12 : systemSizeKw > 12 ? 0.94 : 1
  const effectivePpw = a.pricePerWatt * ROOF_COST_FACTORS[input.roofType] * sizePremium
  const grossCost = systemSizeKw * 1000 * effectivePpw
  const batteryGrossCost = input.wantsBattery ? a.batteryCost : 0
  const totalGross = grossCost + batteryGrossCost
  const itcAmount = totalGross * a.itcPercent
  const netCost = Math.max(0, totalGross - itcAmount - a.stateRebate)

  const savingsByYear = buildSavings(annualProduction, rate, a, a.horizonYears)
  const year1Savings = savingsByYear[0]?.annual ?? 0
  const monthlySavings = year1Savings / 12
  const cumulativeSavings = savingsByYear[savingsByYear.length - 1]?.cumulative ?? 0
  const paybackYears = paybackFrom(netCost, savingsByYear)

  // Financing comparison.
  const loanPrincipal = Math.max(0, totalGross - a.stateRebate)
  const loanMonthlyPayment = loanPayment(loanPrincipal, a.loanApr, a.loanTermYears)
  const loanMonthlyDelta = monthlySavings - loanMonthlyPayment
  const leaseMonthlySavings =
    (annualProduction * rate * (1 - a.ppaRateFactor)) / 12

  const netLifetimeGain =
    input.payment === "cash"
      ? cumulativeSavings - netCost
      : input.payment === "finance"
        ? cumulativeSavings + itcAmount - loanMonthlyPayment * 12 * a.loanTermYears
        : leaseMonthlySavings * 12 * a.horizonYears
  const roiPercent = netCost > 0 ? (netLifetimeGain / netCost) * 100 : 0

  // --- Sensitivity scenarios ---
  const scenarios: Scenario[] = []
  const pushScenario = (
    label: string,
    detail: string,
    over: Partial<Assumptions>,
    prodFactor = 1,
  ) => {
    const alt = { ...a, ...over }
    const altGross =
      systemSizeKw * 1000 * (alt.pricePerWatt * ROOF_COST_FACTORS[input.roofType] * sizePremium) +
      batteryGrossCost
    const altNet = Math.max(0, altGross - altGross * alt.itcPercent - alt.stateRebate)
    const rows = buildSavings(annualProduction * prodFactor, rate, alt, alt.horizonYears)
    scenarios.push({
      label,
      detail,
      paybackYears: paybackFrom(altNet, rows),
      netSavings: (rows[rows.length - 1]?.cumulative ?? 0) - altNet,
    })
  }

  pushScenario("Baseline", "Assumptions exactly as shown", {})
  pushScenario("Rates flat", "Utility rates never rise", { rateEscalation: 0 })
  pushScenario("Rates rise fast", "Utility rates rise 6%/yr", { rateEscalation: 0.06 })
  pushScenario("Cheaper install", "System costs 15% less", {
    pricePerWatt: a.pricePerWatt * 0.85,
  })
  pushScenario("Pricier install", "System costs 15% more", {
    pricePerWatt: a.pricePerWatt * 1.15,
  })
  pushScenario("Weak production", "Panels produce 10% less", {}, 0.9)
  pushScenario("Strong production", "Panels produce 10% more", {}, 1.1)
  pushScenario("No tax credit", "Federal credit unavailable", { itcPercent: 0 })

  // --- Recommendation ---
  const reasons: string[] = []
  const cautions: string[] = []
  let score = 0

  if (paybackYears === null) {
    score -= 3
    cautions.push(
      `At these numbers the system does not pay for itself within ${a.horizonYears} years.`,
    )
  } else if (paybackYears <= 8) {
    score += 2
    reasons.push(
      `Estimated payback of about ${paybackYears.toFixed(1)} years is well inside the panels' 25-year life.`,
    )
  } else if (paybackYears <= 13) {
    score += 1
    reasons.push(
      `Estimated payback of about ${paybackYears.toFixed(1)} years is reasonable but not fast.`,
    )
  } else {
    score -= 1
    cautions.push(
      `Estimated payback of about ${paybackYears.toFixed(1)} years is long, which weakens the financial case.`,
    )
  }

  if (rate >= 0.2) {
    score += 1
    reasons.push(
      `Your electricity rate of $${rate.toFixed(3)}/kWh is high, so every kWh you self-supply is worth more.`,
    )
  } else if (rate < 0.12) {
    score -= 1
    cautions.push(
      `Cheap electricity at $${rate.toFixed(3)}/kWh means each solar kWh displaces less money.`,
    )
  }

  if (offsetPercent >= 80) {
    reasons.push(
      `The roof can host roughly ${systemSizeKw.toFixed(1)} kW, covering about ${Math.round(offsetPercent)}% of your usage.`,
    )
  } else if (offsetPercent < 50) {
    score -= 1
    cautions.push(
      `Shade and orientation hold production to about ${Math.round(offsetPercent)}% of your usage.`,
    )
  }

  if (input.shade === "heavy") {
    score -= 2
    cautions.push("Heavy shade is the single biggest drag on output; consider trimming or a ground mount.")
  } else if (input.shade === "none") {
    score += 1
    reasons.push("An unshaded roof lets the array produce near its full potential.")
  }

  if (input.orientation === "north") {
    score -= 2
    cautions.push("A mostly north-facing roof loses roughly a quarter of its potential output.")
  } else if (input.orientation === "south") {
    score += 1
    reasons.push("South-facing pitch is the ideal orientation for output.")
  }

  if (paybackYears !== null && input.yearsInHome < paybackYears) {
    score -= 2
    cautions.push(
      `You expect to stay about ${input.yearsInHome} years, less than the ${paybackYears.toFixed(1)}-year payback, so you may not recoup the cost directly (though solar can lift resale value).`,
    )
  } else if (paybackYears !== null && input.yearsInHome >= paybackYears + 5) {
    score += 1
    reasons.push(
      `Staying about ${input.yearsInHome} years means you capture many years of free production after payback.`,
    )
  }

  if (input.roofCondition === "aging" || input.roofCondition === "old") {
    cautions.push(
      "Your roof is near the end of its life. Re-roof before installing, or you will pay to remove and reset the array later.",
    )
  }

  if (input.hasEv) {
    reasons.push(
      "Charging an EV at home raises your usage, which makes a larger array more valuable per dollar spent.",
    )
  }

  if (input.payment === "lease") {
    cautions.push(
      "With a lease or PPA the installer keeps the tax credit, so your savings are smaller than owning, though you avoid upfront cost.",
    )
  }

  const verdict: Verdict = score >= 2 ? "favorable" : score >= 0 ? "consider" : "not-yet"
  const verdictHeadline =
    verdict === "favorable"
      ? "Solar looks favorable for your home"
      : verdict === "consider"
        ? "Solar may be worth considering"
        : "Solar may not make financial sense yet"

  // --- Battery guidance ---
  const batteryReasons: string[] = []
  let batteryScore = 0
  if (rate >= 0.25) {
    batteryScore += 1
    batteryReasons.push(
      "Your high electricity rate makes shifting stored power into expensive evening hours worthwhile.",
    )
  }
  if (["CA", "HI", "MA", "NY", "AZ", "NV"].includes(location.stateCode)) {
    batteryScore += 1
    batteryReasons.push(
      `${location.stateName} commonly uses time-of-use rates or limited net metering, where a battery recovers value that exporting no longer pays for.`,
    )
  } else {
    batteryReasons.push(
      "If your utility still offers full-retail net metering, the grid already acts as a free battery, which weakens the economic case.",
    )
  }
  if (input.hasEv) {
    batteryReasons.push(
      "An EV concentrates load in the evening, which pairs well with stored solar.",
    )
  }
  if (input.wantsBattery) {
    batteryReasons.push(
      "For backup power during outages a battery is the only way solar keeps your lights on, since a grid-tied array shuts off without one.",
    )
  }
  const batteryVerdict: "recommended" | "optional" | "skip" =
    batteryScore >= 2 ? "recommended" : batteryScore >= 1 ? "optional" : "skip"

  // Marginal payback of adding the battery alone.
  const batteryNet = a.batteryCost * (1 - a.itcPercent)
  const batteryAnnualValue = annualProduction * rate * 0.12
  const batteryPaybackYears =
    batteryAnnualValue > 0 ? batteryNet / batteryAnnualValue : null

  return {
    location,
    rate,
    rateIsAssumed,
    annualKwh,
    monthlyKwh,
    evKwh,
    productionPerKw,
    systemSizeKw,
    panelCount,
    annualProduction,
    offsetPercent,
    grossCost,
    batteryGrossCost,
    itcAmount,
    netCost,
    year1Savings,
    monthlySavings,
    paybackYears,
    cumulativeSavings,
    netLifetimeGain,
    roiPercent,
    loanMonthlyPayment,
    loanMonthlyDelta,
    leaseMonthlySavings,
    savingsByYear,
    scenarios,
    verdict,
    verdictHeadline,
    reasons,
    cautions,
    batteryVerdict,
    batteryReasons,
    batteryPaybackYears,
  }
}

// --- Formatting helpers ----------------------------------------------------

export function money(value: number, digits = 0): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)
}

export function number(value: number, digits = 0): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)
}

export function years(value: number | null): string {
  if (value === null) return "Never"
  if (value <= 0) return "Immediate"
  return `${value.toFixed(1)} yrs`
}
