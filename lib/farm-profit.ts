// Enterprise budget engine for the farm profitability calculator.
//
// The structure follows a standard extension enterprise budget: every cost is
// expressed per acre, split into variable (operating) and fixed (ownership)
// categories, so gross margin and both break-even measures fall out naturally.
//
// A deliberate note on how this relates to the crop selection tool: that tool
// compares crops on an *operating* margin (revenue less operating inputs and
// labor) because ownership costs are broadly similar across crops and would
// only add noise to a ranking. This calculator adds land rent, machinery
// ownership, insurance, utilities and overhead, so the profit it reports is
// lower and represents true net return. Both are correct for their purpose.

import { CROPS, CROP_BY_ID, LABOR_RATE, type CropGroup, type CropProfile } from "@/lib/crops"

/* ------------------------------------------------------------------ *
 * Cost taxonomy
 * ------------------------------------------------------------------ */

export type CostKind = "variable" | "fixed"

export type CostId =
  // Variable — inputs
  | "seed"
  | "fertilizer"
  | "chemicals"
  | "irrigation"
  // Variable — field operations
  | "fuel"
  | "repairs"
  | "labor"
  | "customWork"
  // Variable — post-harvest and market
  | "dryingProcessing"
  | "storage"
  | "transportation"
  | "marketing"
  // Variable — financing
  | "operatingInterest"
  // Fixed — ownership and overhead
  | "machinery"
  | "landRent"
  | "establishment"
  | "cropInsurance"
  | "utilities"
  | "overhead"
  | "other"

export type CostSection = "inputs" | "operations" | "postharvest" | "financing" | "ownership"

export const SECTION_LABELS: Record<CostSection, string> = {
  inputs: "Inputs",
  operations: "Field operations",
  postharvest: "Post-harvest and market",
  financing: "Financing",
  ownership: "Ownership and overhead",
}

export const COST_META: Record<
  CostId,
  { label: string; kind: CostKind; section: CostSection; detail: string; derived?: boolean }
> = {
  seed: {
    label: "Seed or plants",
    kind: "variable",
    section: "inputs",
    detail: "Seed, transplants, or replacement stock.",
  },
  fertilizer: {
    label: "Fertilizer and lime",
    kind: "variable",
    section: "inputs",
    detail: "Nitrogen, phosphorus, potassium, micronutrients, lime.",
  },
  chemicals: {
    label: "Herbicide, insecticide, fungicide",
    kind: "variable",
    section: "inputs",
    detail: "All crop protection chemistry and adjuvants.",
  },
  irrigation: {
    label: "Irrigation water and power",
    kind: "variable",
    section: "inputs",
    detail: "Pumping energy and water charges. Excludes the pivot or drip system itself.",
  },
  fuel: {
    label: "Fuel and oil",
    kind: "variable",
    section: "operations",
    detail: "Diesel, gas, and lubricants for field passes.",
  },
  repairs: {
    label: "Repairs and maintenance",
    kind: "variable",
    section: "operations",
    detail: "Parts and shop time. Scales with hours worked, so treated as variable.",
  },
  labor: {
    label: "Labor",
    kind: "variable",
    section: "operations",
    detail: "Hours per acre times your wage rate, including your own time.",
    derived: true,
  },
  customWork: {
    label: "Custom hire",
    kind: "variable",
    section: "operations",
    detail: "Work you pay someone else to do, such as combining or spraying.",
  },
  dryingProcessing: {
    label: "Drying, washing, processing",
    kind: "variable",
    section: "postharvest",
    detail: "Grain drying, or washing and packing for produce.",
  },
  storage: {
    label: "Storage and cooling",
    kind: "variable",
    section: "postharvest",
    detail: "Bin space, cold room energy, and shrink.",
  },
  transportation: {
    label: "Trucking and freight",
    kind: "variable",
    section: "postharvest",
    detail: "Hauling to the elevator, packer, or market.",
  },
  marketing: {
    label: "Packaging and marketing",
    kind: "variable",
    section: "postharvest",
    detail: "Boxes, containers, market fees, commissions, and promotion.",
  },
  operatingInterest: {
    label: "Operating interest",
    kind: "variable",
    section: "financing",
    detail: "Interest on the operating line carrying your variable costs.",
    derived: true,
  },
  machinery: {
    label: "Machinery ownership",
    kind: "fixed",
    section: "ownership",
    detail: "Depreciation plus interest on equipment. Committed whether or not you plant.",
  },
  landRent: {
    label: "Land rent or mortgage",
    kind: "fixed",
    section: "ownership",
    detail: "Cash rent, or principal and interest if you own the ground.",
  },
  establishment: {
    label: "Establishment (amortized)",
    kind: "fixed",
    section: "ownership",
    detail: "Perennial planting cost spread over the productive life of the stand.",
  },
  cropInsurance: {
    label: "Crop insurance",
    kind: "fixed",
    section: "ownership",
    detail: "Premium is committed up front regardless of what you harvest.",
  },
  utilities: {
    label: "Utilities",
    kind: "fixed",
    section: "ownership",
    detail: "Shop power, water, phone, and internet apportioned to the crop.",
  },
  overhead: {
    label: "General farm overhead",
    kind: "fixed",
    section: "ownership",
    detail: "Property tax, liability insurance, accounting, licenses, dues.",
  },
  other: {
    label: "Other farm expense",
    kind: "fixed",
    section: "ownership",
    detail: "Anything specific to your operation that is not listed above.",
  },
}

export const COST_IDS = Object.keys(COST_META) as CostId[]

/** Lines the farmer types into directly. Labor and interest are computed. */
export const EDITABLE_COST_IDS = COST_IDS.filter((id) => !COST_META[id].derived)

export const SECTION_ORDER: CostSection[] = [
  "inputs",
  "operations",
  "postharvest",
  "financing",
  "ownership",
]

/* ------------------------------------------------------------------ *
 * Default budgets
 * ------------------------------------------------------------------ */

/**
 * How a crop group's operating input cost typically divides across the
 * variable lines. Each map sums to 1, so the seeded budget reproduces the
 * crop profile's operating cost exactly and the two tools stay reconciled.
 */
const VARIABLE_SHARES: Record<CropGroup, Partial<Record<CostId, number>>> = {
  grain: {
    seed: 0.17,
    fertilizer: 0.34,
    chemicals: 0.13,
    irrigation: 0.01,
    fuel: 0.11,
    repairs: 0.09,
    customWork: 0.03,
    dryingProcessing: 0.07,
    storage: 0.02,
    transportation: 0.02,
    marketing: 0.01,
  },
  oilseed: {
    seed: 0.28,
    fertilizer: 0.18,
    chemicals: 0.22,
    irrigation: 0.01,
    fuel: 0.11,
    repairs: 0.09,
    customWork: 0.03,
    dryingProcessing: 0.02,
    storage: 0.03,
    transportation: 0.02,
    marketing: 0.01,
  },
  legume: {
    seed: 0.26,
    fertilizer: 0.16,
    chemicals: 0.2,
    irrigation: 0.02,
    fuel: 0.12,
    repairs: 0.1,
    customWork: 0.04,
    dryingProcessing: 0.02,
    storage: 0.04,
    transportation: 0.03,
    marketing: 0.01,
  },
  forage: {
    seed: 0.1,
    fertilizer: 0.26,
    chemicals: 0.07,
    irrigation: 0.04,
    fuel: 0.18,
    repairs: 0.16,
    customWork: 0.08,
    storage: 0.06,
    transportation: 0.04,
    marketing: 0.01,
  },
  vegetable: {
    seed: 0.12,
    fertilizer: 0.12,
    chemicals: 0.07,
    irrigation: 0.06,
    fuel: 0.06,
    repairs: 0.06,
    customWork: 0.03,
    dryingProcessing: 0.09,
    storage: 0.07,
    transportation: 0.07,
    marketing: 0.25,
  },
  perennial: {
    seed: 0.04,
    fertilizer: 0.12,
    chemicals: 0.14,
    irrigation: 0.07,
    fuel: 0.07,
    repairs: 0.08,
    customWork: 0.03,
    dryingProcessing: 0.1,
    storage: 0.09,
    transportation: 0.06,
    marketing: 0.2,
  },
  cover: {
    seed: 0.55,
    fertilizer: 0.05,
    chemicals: 0.1,
    fuel: 0.18,
    repairs: 0.12,
  },
}

/** Ownership and overhead costs per acre, which the crop tool does not model. */
const FIXED_DEFAULTS: Record<CropGroup, Record<string, number>> = {
  grain: { machinery: 118, landRent: 245, cropInsurance: 26, utilities: 10, overhead: 42 },
  oilseed: { machinery: 105, landRent: 240, cropInsurance: 22, utilities: 9, overhead: 40 },
  legume: { machinery: 105, landRent: 190, cropInsurance: 20, utilities: 9, overhead: 38 },
  forage: { machinery: 95, landRent: 110, cropInsurance: 10, utilities: 8, overhead: 32 },
  vegetable: { machinery: 175, landRent: 210, cropInsurance: 14, utilities: 26, overhead: 85 },
  perennial: { machinery: 160, landRent: 190, cropInsurance: 30, utilities: 22, overhead: 75 },
  // A cover crop grows inside a rotation, so charging it full rent would
  // double-count ground the cash crop is already paying for.
  cover: { machinery: 35, landRent: 0, cropInsurance: 0, utilities: 4, overhead: 12 },
}

/**
 * Cash rent tracks land quality, and land quality tracks yield potential, so a
 * single flat figure per group badly misprices the low-revenue members. Charging
 * wheat and oats corn-belt rent put their break-even near $11.60/bu against a
 * realistic $7 — the crop looked catastrophic when the rent assumption was the
 * thing that was wrong. For field crops, rent scales with expected revenue
 * relative to the strongest crop in the same group.
 *
 * Vegetables, perennials, and cover crops stay flat on purpose: rent there
 * reflects the ground and its water, not whether you planted squash or tomatoes.
 */
const RENT_SCALES_WITH_REVENUE: ReadonlySet<CropGroup> = new Set<CropGroup>([
  "grain",
  "oilseed",
  "legume",
  "forage",
])

const GROUP_TOP_REVENUE: Partial<Record<CropGroup, number>> = (() => {
  const top: Partial<Record<CropGroup, number>> = {}
  for (const c of CROPS) {
    const revenue = c.yieldExpected * c.priceExpected
    if (revenue > (top[c.group] ?? 0)) top[c.group] = revenue
  }
  return top
})()

function landRentFor(crop: CropProfile, base: number): number {
  if (!RENT_SCALES_WITH_REVENUE.has(crop.group)) return base
  const top = GROUP_TOP_REVENUE[crop.group]
  if (!top) return base
  const ratio = (crop.yieldExpected * crop.priceExpected) / top
  // Even thin ground commands some rent, and the benchmark crop sets the top.
  return Math.round(base * Math.min(1, Math.max(0.4, ratio)))
}

export const DEFAULT_INTEREST_RATE = 8.5
export const DEFAULT_INTEREST_MONTHS = 7

export type Budget = Record<CostId, number>

function emptyBudget(): Budget {
  const b = {} as Budget
  for (const id of COST_IDS) b[id] = 0
  return b
}

/** Builds a per-acre starting budget from a crop profile. */
export function budgetForCrop(crop: CropProfile): Budget {
  const budget = emptyBudget()
  const shares = VARIABLE_SHARES[crop.group]

  for (const [id, share] of Object.entries(shares)) {
    budget[id as CostId] = Math.round(crop.inputCostPerAcre * (share as number))
  }

  const fixed = FIXED_DEFAULTS[crop.group]
  for (const [id, value] of Object.entries(fixed)) {
    budget[id as CostId] = value
  }
  budget.landRent = landRentFor(crop, fixed.landRent ?? 0)

  // Perennials carry a real establishment outlay spread over stand life.
  const establish = crop.establishCostPerAcre ?? 0
  if (establish > 0) {
    const years = crop.standYears ?? Math.max(1, (crop.establishYears ?? 1) + 4)
    budget.establishment = Math.round(establish / years)
  }

  return budget
}

/* ------------------------------------------------------------------ *
 * Inputs
 * ------------------------------------------------------------------ */

export type ProfitInputs = {
  /** Crop id from the crop library, or "custom" for a hand-entered budget. */
  cropId: string
  cropName: string
  yieldUnit: string
  acres: number
  yieldPerAcre: number
  pricePerUnit: number
  budget: Budget
  laborHoursPerAcre: number
  laborRate: number
  interestRatePct: number
  interestMonths: number
  /** Scenario swing, percent, applied to yield and price independently. */
  yieldSwingPct: number
  priceSwingPct: number
}

export function inputsForCrop(cropId: string, acres = 40): ProfitInputs {
  const crop = CROP_BY_ID[cropId]
  if (!crop) return customInputs(acres)
  return {
    cropId: crop.id,
    cropName: crop.name,
    yieldUnit: crop.yieldUnit,
    acres,
    yieldPerAcre: crop.yieldExpected,
    pricePerUnit: crop.priceExpected,
    budget: budgetForCrop(crop),
    laborHoursPerAcre: crop.laborHoursPerAcre,
    laborRate: LABOR_RATE,
    interestRatePct: DEFAULT_INTEREST_RATE,
    interestMonths: DEFAULT_INTEREST_MONTHS,
    // Use the crop's own published range rather than a flat percentage.
    yieldSwingPct: Math.round(((crop.yieldHigh - crop.yieldExpected) / crop.yieldExpected) * 100),
    priceSwingPct: Math.round(((crop.priceHigh - crop.priceExpected) / crop.priceExpected) * 100),
  }
}

function customInputs(acres: number): ProfitInputs {
  const budget = emptyBudget()
  const fixed = FIXED_DEFAULTS.grain
  for (const [id, value] of Object.entries(fixed)) budget[id as CostId] = value
  return {
    cropId: "custom",
    cropName: "Custom crop",
    yieldUnit: "unit",
    acres,
    yieldPerAcre: 100,
    pricePerUnit: 5,
    budget,
    laborHoursPerAcre: 4,
    laborRate: LABOR_RATE,
    interestRatePct: DEFAULT_INTEREST_RATE,
    interestMonths: DEFAULT_INTEREST_MONTHS,
    yieldSwingPct: 15,
    priceSwingPct: 20,
  }
}

/** Seeds this calculator from a crop selection tool recommendation. */
export function inputsFromHandoff(h: {
  cropId: string
  acres: number
  expectedYieldPerAcre: number
  expectedPrice: number
}): ProfitInputs {
  const base = inputsForCrop(h.cropId, h.acres)
  // Keep the yield and price the first tool actually showed, which already
  // reflect that farm's soil and irrigation, not just the crop average.
  return { ...base, yieldPerAcre: h.expectedYieldPerAcre, pricePerUnit: h.expectedPrice }
}

/* ------------------------------------------------------------------ *
 * Computation
 * ------------------------------------------------------------------ */

export type CostLine = {
  id: CostId
  label: string
  kind: CostKind
  section: CostSection
  perAcre: number
  total: number
  shareOfTotal: number
}

export type ProfitResult = {
  acres: number
  yieldPerAcre: number
  pricePerUnit: number
  totalProduction: number

  revenuePerAcre: number
  totalRevenue: number

  lines: CostLine[]
  variablePerAcre: number
  fixedPerAcre: number
  totalCostPerAcre: number
  variableTotal: number
  fixedTotal: number
  totalCost: number

  grossMarginPerAcre: number
  grossMarginTotal: number
  profitPerAcre: number
  totalProfit: number

  roiPct: number
  marginPct: number
  costPerUnit: number

  breakEvenPrice: number
  breakEvenPriceVariable: number
  breakEvenYield: number
  breakEvenYieldVariable: number
  minRevenueRequired: number

  /** How far price can fall before the crop stops covering total cost. */
  priceCushionPct: number
  yieldCushionPct: number
}

function safeDiv(a: number, b: number): number {
  return b > 0 ? a / b : 0
}

export function computeProfit(inputs: ProfitInputs): ProfitResult {
  const acres = Math.max(0, inputs.acres)
  const yieldPerAcre = Math.max(0, inputs.yieldPerAcre)
  const pricePerUnit = Math.max(0, inputs.pricePerUnit)

  const budget = { ...inputs.budget }
  budget.labor = Math.max(0, inputs.laborHoursPerAcre) * Math.max(0, inputs.laborRate)

  // Interest accrues on the variable costs the operating line has to carry,
  // so it is computed after the other variable lines are known.
  const variableBeforeInterest = COST_IDS.filter(
    (id) => COST_META[id].kind === "variable" && id !== "operatingInterest",
  ).reduce((sum, id) => sum + Math.max(0, budget[id] || 0), 0)

  budget.operatingInterest =
    variableBeforeInterest * (inputs.interestRatePct / 100) * (inputs.interestMonths / 12)

  const variablePerAcre = variableBeforeInterest + budget.operatingInterest
  const fixedPerAcre = COST_IDS.filter((id) => COST_META[id].kind === "fixed").reduce(
    (sum, id) => sum + Math.max(0, budget[id] || 0),
    0,
  )
  const totalCostPerAcre = variablePerAcre + fixedPerAcre

  const lines: CostLine[] = COST_IDS.map((id) => {
    const perAcre = Math.max(0, budget[id] || 0)
    return {
      id,
      label: COST_META[id].label,
      kind: COST_META[id].kind,
      section: COST_META[id].section,
      perAcre,
      total: perAcre * acres,
      shareOfTotal: safeDiv(perAcre, totalCostPerAcre) * 100,
    }
  })

  const revenuePerAcre = yieldPerAcre * pricePerUnit
  const totalRevenue = revenuePerAcre * acres
  const totalProduction = yieldPerAcre * acres

  const grossMarginPerAcre = revenuePerAcre - variablePerAcre
  const profitPerAcre = revenuePerAcre - totalCostPerAcre

  // Break-even price and cost per unit are the same quantity in an enterprise
  // budget; both names are surfaced because farmers use them interchangeably.
  const breakEvenPrice = safeDiv(totalCostPerAcre, yieldPerAcre)
  const breakEvenPriceVariable = safeDiv(variablePerAcre, yieldPerAcre)
  const breakEvenYield = safeDiv(totalCostPerAcre, pricePerUnit)
  const breakEvenYieldVariable = safeDiv(variablePerAcre, pricePerUnit)

  return {
    acres,
    yieldPerAcre,
    pricePerUnit,
    totalProduction,
    revenuePerAcre,
    totalRevenue,
    lines,
    variablePerAcre,
    fixedPerAcre,
    totalCostPerAcre,
    variableTotal: variablePerAcre * acres,
    fixedTotal: fixedPerAcre * acres,
    totalCost: totalCostPerAcre * acres,
    grossMarginPerAcre,
    grossMarginTotal: grossMarginPerAcre * acres,
    profitPerAcre,
    totalProfit: profitPerAcre * acres,
    roiPct: safeDiv(profitPerAcre, totalCostPerAcre) * 100,
    marginPct: safeDiv(profitPerAcre, revenuePerAcre) * 100,
    costPerUnit: breakEvenPrice,
    breakEvenPrice,
    breakEvenPriceVariable,
    breakEvenYield,
    breakEvenYieldVariable,
    minRevenueRequired: totalCostPerAcre * acres,
    priceCushionPct: pricePerUnit > 0 ? ((pricePerUnit - breakEvenPrice) / pricePerUnit) * 100 : 0,
    yieldCushionPct: yieldPerAcre > 0 ? ((yieldPerAcre - breakEvenYield) / yieldPerAcre) * 100 : 0,
  }
}

/* ------------------------------------------------------------------ *
 * Scenarios
 * ------------------------------------------------------------------ */

export type ScenarioId = "worst" | "expected" | "best"

export const SCENARIO_META: Record<ScenarioId, { label: string; detail: string }> = {
  worst: {
    label: "Worst case",
    detail: "Yield and price both come in below plan.",
  },
  expected: {
    label: "Expected case",
    detail: "Your entered yield and price.",
  },
  best: {
    label: "Best case",
    detail: "Yield and price both come in above plan.",
  },
}

export type Scenario = {
  id: ScenarioId
  yieldPerAcre: number
  pricePerUnit: number
  result: ProfitResult
}

export function buildScenarios(inputs: ProfitInputs): Scenario[] {
  const yieldSwing = Math.max(0, inputs.yieldSwingPct) / 100
  const priceSwing = Math.max(0, inputs.priceSwingPct) / 100

  const variants: Array<{ id: ScenarioId; y: number; p: number }> = [
    { id: "worst", y: 1 - yieldSwing, p: 1 - priceSwing },
    { id: "expected", y: 1, p: 1 },
    { id: "best", y: 1 + yieldSwing, p: 1 + priceSwing },
  ]

  return variants.map(({ id, y, p }) => {
    const yieldPerAcre = Math.round(inputs.yieldPerAcre * y * 100) / 100
    const pricePerUnit = Math.round(inputs.pricePerUnit * p * 1000) / 1000
    return {
      id,
      yieldPerAcre,
      pricePerUnit,
      result: computeProfit({ ...inputs, yieldPerAcre, pricePerUnit }),
    }
  })
}

/* ------------------------------------------------------------------ *
 * Price x yield sensitivity
 * ------------------------------------------------------------------ */

export type SensitivityCell = {
  profitPerAcre: number
  aboveBreakEven: boolean
}

export type Sensitivity = {
  priceSteps: number[]
  yieldSteps: number[]
  /** Indexed [yieldIndex][priceIndex] so it reads like the rendered table. */
  grid: SensitivityCell[][]
}

const STEP_PCT = [-20, -10, 0, 10, 20]

export function buildSensitivity(inputs: ProfitInputs): Sensitivity {
  const priceSteps = STEP_PCT.map(
    (pct) => Math.round(inputs.pricePerUnit * (1 + pct / 100) * 1000) / 1000,
  )
  const yieldSteps = STEP_PCT.map(
    (pct) => Math.round(inputs.yieldPerAcre * (1 + pct / 100) * 100) / 100,
  )

  const grid = yieldSteps.map((y) =>
    priceSteps.map((p) => {
      const r = computeProfit({ ...inputs, yieldPerAcre: y, pricePerUnit: p })
      return { profitPerAcre: r.profitPerAcre, aboveBreakEven: r.profitPerAcre >= 0 }
    }),
  )

  return { priceSteps, yieldSteps, grid }
}

/* ------------------------------------------------------------------ *
 * Improvement levers
 * ------------------------------------------------------------------ */

export type Lever = {
  id: string
  label: string
  detail: string
  deltaTotal: number
  deltaPerAcre: number
  newProfitPerAcre: number
  /** True when the lever only magnifies the current result rather than fixing it. */
  scalesOnly?: boolean
}

function scaleLines(budget: Budget, ids: CostId[], factor: number): Budget {
  const next = { ...budget }
  for (const id of ids) next[id] = (next[id] || 0) * factor
  return next
}

const INPUT_LINE_IDS: CostId[] = ["seed", "fertilizer", "chemicals", "irrigation"]

/**
 * Tests a handful of realistic management changes and ranks them by how much
 * total profit each one adds, answering "what would improve this the most".
 */
export function buildLevers(inputs: ProfitInputs): Lever[] {
  const base = computeProfit(inputs)
  const levers: Lever[] = []

  const add = (
    id: string,
    label: string,
    detail: string,
    patch: Partial<ProfitInputs>,
    scalesOnly = false,
  ) => {
    const next = computeProfit({ ...inputs, ...patch })
    levers.push({
      id,
      label,
      detail,
      deltaTotal: next.totalProfit - base.totalProfit,
      deltaPerAcre: next.profitPerAcre - base.profitPerAcre,
      newProfitPerAcre: next.profitPerAcre,
      scalesOnly,
    })
  }

  add("yield", "Raise yield 10%", "Better genetics, fertility, or timeliness.", {
    yieldPerAcre: inputs.yieldPerAcre * 1.1,
  })
  add("price", "Sell 10% higher", "Improved marketing, grading, or timing.", {
    pricePerUnit: inputs.pricePerUnit * 1.1,
  })
  add("inputs", "Cut input cost 10%", "Soil testing, variable rate, better buying.", {
    budget: scaleLines(inputs.budget, INPUT_LINE_IDS, 0.9),
  })
  add("rent", "Cut land rent 15%", "Renegotiate, or shift to cheaper ground.", {
    budget: { ...inputs.budget, landRent: (inputs.budget.landRent || 0) * 0.85 },
  })
  add("labor", "Cut labor hours 15%", "Better workflow, tooling, or mechanization.", {
    laborHoursPerAcre: inputs.laborHoursPerAcre * 0.85,
  })
  add(
    "acres",
    "Add 25% more acres",
    // Every cost here is per acre, so acreage multiplies the existing result.
    // If profit per acre is negative, more acres deepens the loss.
    "Spreads nothing: per-acre economics are unchanged.",
    { acres: inputs.acres * 1.25 },
    true,
  )

  return levers.sort((a, b) => b.deltaTotal - a.deltaTotal)
}

/* ------------------------------------------------------------------ *
 * Comparison mode
 * ------------------------------------------------------------------ */

export type Comparison = {
  cropId: string
  cropName: string
  yieldUnit: string
  result: ProfitResult
}

/**
 * Runs the same acreage and overhead assumptions across several crops. Each
 * crop keeps its own default budget, yield, and price so the comparison
 * reflects genuinely different enterprises rather than one budget relabeled.
 */
export function compareCrops(cropIds: string[], acres: number): Comparison[] {
  return cropIds
    .filter((id) => CROP_BY_ID[id])
    .map((id) => {
      const inputs = inputsForCrop(id, acres)
      return {
        cropId: id,
        cropName: inputs.cropName,
        yieldUnit: inputs.yieldUnit,
        result: computeProfit(inputs),
      }
    })
}

/* ------------------------------------------------------------------ *
 * Formatting
 * ------------------------------------------------------------------ */

export function formatUsd(n: number): string {
  const sign = n < 0 ? "-" : ""
  const abs = Math.abs(n)
  if (abs >= 1000) return `${sign}$${Math.round(abs).toLocaleString()}`
  return `${sign}$${Math.round(abs)}`
}

export function formatUnitPrice(n: number): string {
  if (n >= 100) return `$${Math.round(n).toLocaleString()}`
  if (n >= 10) return `$${n.toFixed(1)}`
  return `$${n.toFixed(2)}`
}

export function formatPct(n: number): string {
  const rounded = Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 10) / 10
  return `${rounded > 0 ? "+" : ""}${rounded}%`
}

export function formatUnits(n: number, unit: string): string {
  const rounded = n >= 100 ? Math.round(n) : Math.round(n * 10) / 10
  return `${rounded.toLocaleString()} ${unit}`
}
