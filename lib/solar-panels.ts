// Panel-sizing engine for the "How many solar panels do I need?" calculator.
// Reuses the location + derate data that powers the savings tool so both tools
// agree on sun hours, utility rates, orientation and shade penalties.

import {
  ORIENTATION_FACTORS,
  SHADE_FACTORS,
  resolveLocation,
  type Orientation,
  type ResolvedLocation,
  type Shade,
} from "@/lib/solar"

// --- Types -----------------------------------------------------------------

/** What the homeowner knows about their consumption. */
export type UsageBasis = "bill" | "monthly-kwh" | "annual-kwh"

export type RoofPitch = "flat" | "low" | "typical" | "steep"

export type PanelInputs = {
  zip: string
  basis: UsageBasis
  /** Average monthly electric bill, $. Used when basis === "bill". */
  monthlyBill: number
  /** Average monthly consumption, kWh. Used when basis === "monthly-kwh". */
  monthlyKwh: number
  /** Known annual consumption, kWh. Used when basis === "annual-kwh". */
  annualKwh: number
  /** Share of consumption the array should cover, percent. */
  offsetPercent: number
  /** Nameplate watts of a single panel. */
  panelWatts: number
  orientation: Orientation
  shade: Shade
  pitch: RoofPitch
  /** System derate covering inverter, wiring, soiling and temperature losses. */
  derate: number
  /** Usable roof width for layout estimation, feet. */
  roofWidthFt: number
}

export type PanelComparison = {
  watts: number
  panelCount: number
  systemKw: number
  roofAreaSqFt: number
  /** True for the wattage currently selected. */
  selected: boolean
}

export type CalcStep = {
  label: string
  detail: string
  value: string
}

export type PanelResult = {
  /** False when there is not enough input to size anything yet. */
  ready: boolean
  location: ResolvedLocation
  rate: number
  annualKwh: number
  monthlyKwh: number
  /** Annual kWh produced per kW of installed capacity at this site. */
  productionPerKwYear: number
  /** Production the array needs to hit the requested offset. */
  targetAnnualKwh: number
  /** Ideal capacity before rounding to whole panels. */
  requiredKw: number
  panelCount: number
  /** Capacity after rounding up to whole panels. */
  systemKw: number
  annualProduction: number
  monthlyProduction: number
  /** Offset actually achieved after panel rounding, as a fraction. */
  offsetAchieved: number
  annualBillOffset: number
  panelAreaSqFt: number
  panelWidthFt: number
  panelHeightFt: number
  roofAreaSqFt: number
  layout: { rows: number; perRow: number; remainder: number }
  monthlyProfile: Array<{ month: string; kwh: number }>
  comparisons: PanelComparison[]
  steps: CalcStep[]
  notes: string[]
}

// --- Constants -------------------------------------------------------------

export const PANEL_OPTIONS = [350, 400, 450, 500] as const

export const PITCH_FACTORS: Record<RoofPitch, number> = {
  flat: 0.89,
  low: 0.96,
  typical: 1.0,
  steep: 0.97,
}

export const PITCH_LABELS: Record<RoofPitch, string> = {
  flat: "Flat / low-slope",
  low: "Shallow (10-20°)",
  typical: "Typical (20-35°)",
  steep: "Steep (35°+)",
}

export const BASIS_LABELS: Record<UsageBasis, string> = {
  bill: "Monthly bill",
  "monthly-kwh": "Monthly kWh",
  "annual-kwh": "Annual kWh",
}

/** Typical module efficiency, used to derive physical panel area from wattage. */
const PANEL_EFFICIENCY = 0.205
/** Panels are installed with gaps, walkways and fire setbacks. */
const ROOF_AREA_FACTOR = 1.25
/** Assumed physical width of a portrait-mounted residential module, feet. */
const PANEL_WIDTH_FT = 3.4
const SQ_M_TO_SQ_FT = 10.7639

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

/** Normalized seasonal production shape for the northern hemisphere. */
const SEASONAL_WEIGHTS = [
  0.062, 0.072, 0.088, 0.096, 0.102, 0.104,
  0.105, 0.1, 0.09, 0.077, 0.055, 0.049,
]

/** A typical US single-family home, kWh per year. */
export const TYPICAL_HOME_ANNUAL_KWH = 10800

// --- Helpers ---------------------------------------------------------------

/** Physical dimensions and area of one module at a given wattage. */
export function panelGeometry(watts: number) {
  const areaSqM = watts / (1000 * PANEL_EFFICIENCY)
  const areaSqFt = areaSqM * SQ_M_TO_SQ_FT
  return {
    areaSqFt,
    widthFt: PANEL_WIDTH_FT,
    heightFt: areaSqFt / PANEL_WIDTH_FT,
  }
}

function safeCeil(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.ceil(value - 1e-9)
}

// --- Core math -------------------------------------------------------------

export function computePanels(inputs: PanelInputs): PanelResult {
  const location = resolveLocation(inputs.zip)
  const rate = location.defaultRate

  // 1. Resolve annual consumption from whichever basis the user chose.
  let annualKwh = 0
  if (inputs.basis === "bill") {
    annualKwh = rate > 0 ? (inputs.monthlyBill / rate) * 12 : 0
  } else if (inputs.basis === "monthly-kwh") {
    annualKwh = inputs.monthlyKwh * 12
  } else {
    annualKwh = inputs.annualKwh
  }
  annualKwh = Math.max(0, annualKwh)

  const geometry = panelGeometry(inputs.panelWatts)

  // 2. Site-specific yield per kW of capacity.
  const orientationFactor = ORIENTATION_FACTORS[inputs.orientation]
  const shadeFactor = SHADE_FACTORS[inputs.shade]
  const pitchFactor = PITCH_FACTORS[inputs.pitch]
  const productionPerKwYear =
    location.sunHours *
    365 *
    inputs.derate *
    orientationFactor *
    shadeFactor *
    pitchFactor

  const offsetFraction = Math.max(0, inputs.offsetPercent) / 100
  const targetAnnualKwh = annualKwh * offsetFraction
  const requiredKw = productionPerKwYear > 0 ? targetAnnualKwh / productionPerKwYear : 0

  // 3. Round up to whole panels, then recompute what that array actually does.
  const panelCount = safeCeil((requiredKw * 1000) / inputs.panelWatts)
  const systemKw = (panelCount * inputs.panelWatts) / 1000
  const annualProduction = systemKw * productionPerKwYear
  const offsetAchieved = annualKwh > 0 ? annualProduction / annualKwh : 0

  const roofAreaSqFt = panelCount * geometry.areaSqFt * ROOF_AREA_FACTOR

  // 4. Approximate layout on a rectangular roof face.
  const perRow = Math.max(1, Math.floor(inputs.roofWidthFt / geometry.widthFt))
  const rows = panelCount > 0 ? Math.ceil(panelCount / perRow) : 0
  const remainder = panelCount > 0 ? panelCount - (rows - 1) * perRow : 0

  const monthlyProfile = MONTH_NAMES.map((month, i) => ({
    month,
    kwh: annualProduction * SEASONAL_WEIGHTS[i],
  }))

  // 5. Same target, different module wattages.
  const comparisons: PanelComparison[] = PANEL_OPTIONS.map((watts) => {
    const count = safeCeil((requiredKw * 1000) / watts)
    const geo = panelGeometry(watts)
    return {
      watts,
      panelCount: count,
      systemKw: (count * watts) / 1000,
      roofAreaSqFt: count * geo.areaSqFt * ROOF_AREA_FACTOR,
      selected: watts === inputs.panelWatts,
    }
  })

  const ready = annualKwh > 0 && panelCount > 0

  const steps: CalcStep[] = [
    {
      label: "Annual electricity use",
      detail:
        inputs.basis === "bill"
          ? `$${inputs.monthlyBill.toFixed(0)}/mo ÷ $${rate.toFixed(3)}/kWh × 12`
          : inputs.basis === "monthly-kwh"
            ? `${Math.round(inputs.monthlyKwh)} kWh/mo × 12`
            : "Entered directly",
      value: `${Math.round(annualKwh).toLocaleString()} kWh/yr`,
    },
    {
      label: "Production per kW here",
      detail: `${location.sunHours} sun hours × 365 × ${Math.round(
        inputs.derate * 100,
      )}% derate × orientation ${orientationFactor.toFixed(2)} × shade ${shadeFactor.toFixed(
        2,
      )} × pitch ${pitchFactor.toFixed(2)}`,
      value: `${Math.round(productionPerKwYear).toLocaleString()} kWh/kW/yr`,
    },
    {
      label: `Production needed for ${Math.round(inputs.offsetPercent)}% offset`,
      detail: `${Math.round(annualKwh).toLocaleString()} kWh × ${Math.round(
        inputs.offsetPercent,
      )}%`,
      value: `${Math.round(targetAnnualKwh).toLocaleString()} kWh/yr`,
    },
    {
      label: "System size required",
      detail: `${Math.round(targetAnnualKwh).toLocaleString()} ÷ ${Math.round(
        productionPerKwYear,
      ).toLocaleString()}`,
      value: `${requiredKw.toFixed(2)} kW`,
    },
    {
      label: "Panels needed",
      detail: `${requiredKw.toFixed(2)} kW ÷ ${inputs.panelWatts} W, rounded up`,
      value: `${panelCount} panels`,
    },
    {
      label: "Roof area required",
      detail: `${panelCount} × ${geometry.areaSqFt.toFixed(1)} sq ft × ${ROOF_AREA_FACTOR} spacing`,
      value: `${Math.round(roofAreaSqFt).toLocaleString()} sq ft`,
    },
  ]

  const notes: string[] = []
  if (location.isFallback) {
    notes.push(
      "No ZIP match yet, so this uses national-average sun hours and electricity rates. Add your ZIP for a location-specific estimate.",
    )
  }
  if (inputs.shade === "heavy") {
    notes.push(
      "Heavy shade cuts output sharply, which is why the panel count climbs. A site survey may find a better roof face or recommend trimming.",
    )
  }
  if (inputs.orientation === "north") {
    notes.push(
      "North-facing roofs lose roughly a quarter of their output, so you need more panels for the same offset.",
    )
  }
  if (offsetAchieved > 0 && offsetAchieved - offsetFraction > 0.03) {
    notes.push(
      `Rounding up to whole panels pushes you to about ${Math.round(
        offsetAchieved * 100,
      )}% offset rather than exactly ${Math.round(inputs.offsetPercent)}%.`,
    )
  }
  if (inputs.offsetPercent > 100) {
    notes.push(
      "Many utilities will not credit production beyond your own consumption. Check net-metering rules before oversizing.",
    )
  }
  notes.push(
    "Final system size depends on your roof's usable area, obstructions, local code setbacks, utility interconnection limits, and a professional site assessment.",
  )

  return {
    ready,
    location,
    rate,
    annualKwh,
    monthlyKwh: annualKwh / 12,
    productionPerKwYear,
    targetAnnualKwh,
    requiredKw,
    panelCount,
    systemKw,
    annualProduction,
    monthlyProduction: annualProduction / 12,
    offsetAchieved,
    annualBillOffset: Math.min(annualProduction, annualKwh) * rate,
    panelAreaSqFt: geometry.areaSqFt,
    panelWidthFt: geometry.widthFt,
    panelHeightFt: geometry.heightFt,
    roofAreaSqFt,
    layout: { rows, perRow, remainder },
    monthlyProfile,
    comparisons,
    steps,
    notes,
  }
}

// --- Scenario shortcuts ----------------------------------------------------

export type PanelScenario = {
  id: string
  label: string
  description: string
  patch: Partial<PanelInputs>
}

export const PANEL_SCENARIOS: PanelScenario[] = [
  {
    id: "bill-100",
    label: "$100/mo bill",
    description: "A $100 monthly electric bill",
    patch: { basis: "bill", monthlyBill: 100 },
  },
  {
    id: "kwh-500",
    label: "500 kWh/mo",
    description: "A small or efficient home",
    patch: { basis: "monthly-kwh", monthlyKwh: 500 },
  },
  {
    id: "kwh-1000",
    label: "1,000 kWh/mo",
    description: "An average US household",
    patch: { basis: "monthly-kwh", monthlyKwh: 1000 },
  },
  {
    id: "kwh-2000",
    label: "2,000 kWh/mo",
    description: "A large or all-electric home",
    patch: { basis: "monthly-kwh", monthlyKwh: 2000 },
  },
  {
    id: "typical",
    label: "Typical home",
    description: `About ${TYPICAL_HOME_ANNUAL_KWH.toLocaleString()} kWh per year`,
    patch: { basis: "annual-kwh", annualKwh: TYPICAL_HOME_ANNUAL_KWH },
  },
]

export const DEFAULT_PANEL_INPUTS: PanelInputs = {
  zip: "",
  basis: "bill",
  monthlyBill: 0,
  monthlyKwh: 0,
  annualKwh: 0,
  offsetPercent: 100,
  panelWatts: 400,
  orientation: "south",
  shade: "none",
  pitch: "typical",
  derate: 0.85,
  roofWidthFt: 30,
}
