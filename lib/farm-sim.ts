// Model for the Interactive Farm Simulator — the agriculture counterpart to the
// solar, landscape, and renovation clay explorers.
//
// HONESTY NOTE: every dollar, yield, and water figure here is an illustrative
// national-typical value for a prototype, NOT a local recommendation. The farm
// profitability calculator and crop selection tool carry the researched logic;
// this simulator exists to make the TRADE-OFFS between a single-crop and a
// diversified farm tactile and visual. All figures are rounded, whole-farm,
// per-season estimates.

export type CropId = "corn" | "soybeans" | "wheat" | "vegetables"

export type Crop = {
  id: CropId
  name: string
  /** Short label for chips and field tags. */
  short: string
  /** Legend / UI accent color (matches the mature clay field tone). */
  accent: string
  /**
   * Clay color keyframes walked across the season: prepared soil → first
   * sprouts → lush canopy → mature crop → harvested stubble.
   */
  clay: {
    soil: string
    sprout: string
    lush: string
    mature: string
    harvest: string
  }
  /** Relative mature canopy height, 0–1, for the miniature crop rows. */
  canopy: number
  /** Illustrative whole-season economics, per acre. */
  revenuePerAcre: number
  costPerAcre: number
  /** Seasonal water requirement, acre-inches per acre. */
  waterInches: number
}

export const CROPS: Crop[] = [
  {
    id: "corn",
    name: "Corn",
    short: "Corn",
    accent: "#5f7a34",
    clay: {
      soil: "#b28a58",
      sprout: "#a6bd72",
      lush: "#4f7a37",
      mature: "#5f7a34",
      harvest: "#ccb48c",
    },
    canopy: 1,
    revenuePerAcre: 828, // ~180 bu × $4.60
    costPerAcre: 520,
    waterInches: 24,
  },
  {
    id: "soybeans",
    name: "Soybeans",
    short: "Soy",
    accent: "#7f9f4a",
    clay: {
      soil: "#b28a58",
      sprout: "#9ab86a",
      lush: "#6a9e4f",
      mature: "#8f9a3f", // yellowing at maturity
      harvest: "#c9b48c",
    },
    canopy: 0.55,
    revenuePerAcre: 621, // ~54 bu × $11.50
    costPerAcre: 300,
    waterInches: 20,
  },
  {
    id: "wheat",
    name: "Wheat",
    short: "Wheat",
    accent: "#c9a83f",
    clay: {
      soil: "#b28a58",
      sprout: "#8fae5b",
      lush: "#b6a94f",
      mature: "#d8b64a", // golden
      harvest: "#d9c48f",
    },
    canopy: 0.7,
    revenuePerAcre: 403, // ~62 bu × $6.50
    costPerAcre: 235,
    waterInches: 16,
  },
  {
    id: "vegetables",
    name: "Vegetables",
    short: "Veg",
    accent: "#2f6b3f",
    clay: {
      soil: "#a9855a",
      sprout: "#5f9a55",
      lush: "#2f6b3f",
      mature: "#2f6b3f",
      harvest: "#bda678",
    },
    canopy: 0.5,
    revenuePerAcre: 8000, // high-value, labor-bound market garden
    costPerAcre: 5200,
    waterInches: 22,
  },
]

export const CROP_BY_ID: Record<CropId, Crop> = Object.fromEntries(
  CROPS.map((c) => [c.id, c]),
) as Record<CropId, Crop>

export const CROP_ORDER: CropId[] = ["corn", "soybeans", "wheat", "vegetables"]

/** Fallow / unplanted clay tones, used for leftover acreage. */
export const FALLOW_CLAY = {
  soil: "#c2a173",
  edge: "#a9855a",
}

export const TOTAL_ACRES = 100

/** Acreage allocated to each crop; the remainder is fallow. */
export type CropMix = Record<CropId, number>

export const SINGLE_CROP_MIX: CropMix = {
  corn: 100,
  soybeans: 0,
  wheat: 0,
  vegetables: 0,
}

export const DIVERSIFIED_MIX: CropMix = {
  corn: 40,
  soybeans: 25,
  wheat: 20,
  vegetables: 15,
}

export function emptyMix(): CropMix {
  return { corn: 0, soybeans: 0, wheat: 0, vegetables: 0 }
}

export function mixTotal(mix: CropMix): number {
  return CROP_ORDER.reduce((sum, id) => sum + mix[id], 0)
}

export function fallowAcres(mix: CropMix): number {
  return Math.max(0, TOTAL_ACRES - mixTotal(mix))
}

/** Linear blend between the single-crop and diversified presets, 0–1. */
export function mixFromDiversity(t: number): CropMix {
  const clamp = Math.max(0, Math.min(1, t))
  const blend = (a: number, b: number) => Math.round(a + (b - a) * clamp)
  const mix = emptyMix()
  for (const id of CROP_ORDER) {
    mix[id] = blend(SINGLE_CROP_MIX[id], DIVERSIFIED_MIX[id])
  }
  // Correct rounding drift so the planted total lands back on a clean number.
  const drift = mixTotal(mix) - Math.round(
    mixTotal(SINGLE_CROP_MIX) +
      (mixTotal(DIVERSIFIED_MIX) - mixTotal(SINGLE_CROP_MIX)) * clamp,
  )
  mix.corn = Math.max(0, mix.corn - drift)
  return mix
}

/* ------------------------------------------------------------------ *
 * Metrics
 * ------------------------------------------------------------------ */

export type RiskLevel = "Low" | "Moderate" | "Elevated" | "High"

export type FarmMetrics = {
  revenue: number
  cost: number
  profit: number
  /** Season water requirement in acre-inches and million gallons. */
  waterAcreInches: number
  waterMGal: number
  plantedAcres: number
  fallowAcres: number
  /** Herfindahl-style crop concentration, 0–100 (100 = single crop). */
  concentration: number
  risk: RiskLevel
}

const GALLONS_PER_ACRE_INCH = 27_154

export function computeMetrics(mix: CropMix): FarmMetrics {
  let revenue = 0
  let cost = 0
  let waterAcreInches = 0
  for (const id of CROP_ORDER) {
    const acres = mix[id]
    const crop = CROP_BY_ID[id]
    revenue += acres * crop.revenuePerAcre
    cost += acres * crop.costPerAcre
    waterAcreInches += acres * crop.waterInches
  }

  const planted = mixTotal(mix)
  // Concentration over the PLANTED acreage (fallow ground is not a crop).
  let hhi = 0
  if (planted > 0) {
    for (const id of CROP_ORDER) {
      const share = mix[id] / planted
      hhi += share * share
    }
  }
  const concentration = Math.round(hhi * 100)

  let risk: RiskLevel = "Low"
  if (planted === 0) risk = "Low"
  else if (hhi >= 0.75) risk = "High"
  else if (hhi >= 0.5) risk = "Elevated"
  else if (hhi >= 0.32) risk = "Moderate"
  else risk = "Low"

  return {
    revenue,
    cost,
    profit: revenue - cost,
    waterAcreInches,
    waterMGal: (waterAcreInches * GALLONS_PER_ACRE_INCH) / 1_000_000,
    plantedAcres: planted,
    fallowAcres: Math.max(0, TOTAL_ACRES - planted),
    concentration,
    risk,
  }
}

export const RISK_COLORS: Record<RiskLevel, string> = {
  Low: "#4f8a4f",
  Moderate: "#c79a3a",
  Elevated: "#c9743a",
  High: "#c1553f",
}

/* ------------------------------------------------------------------ *
 * Field allocation
 * ------------------------------------------------------------------ */

// The miniature farm is a fixed set of softly-rounded field plots. Each plot is
// painted with whichever crop the current mix assigns to it, so changing the
// mix visibly re-tiles the model rather than editing a spreadsheet.
export type FieldPlot = {
  id: string
  /** Position + size on the farm plane, in % of the stage. */
  x: number
  y: number
  w: number
  h: number
  /** Nominal acreage this plot represents. */
  acres: number
  /** Per-corner border radius (px) for an organic, hand-shaped clay edge. */
  radius: string
  /** Slight rotation so the plots don't read as a rigid grid. */
  tilt: number
}

// Six plots laid over the lower-right of the stage (the farmstead sits upper
// left). Acreages sum to TOTAL_ACRES.
export const FIELD_PLOTS: FieldPlot[] = [
  { id: "f1", x: 40, y: 20, w: 27, h: 24, acres: 20, radius: "42% 38% 40% 44%", tilt: -2 },
  { id: "f2", x: 69, y: 22, w: 25, h: 22, acres: 16, radius: "40% 46% 38% 42%", tilt: 2 },
  { id: "f3", x: 38, y: 46, w: 30, h: 26, acres: 22, radius: "44% 40% 46% 38%", tilt: 1 },
  { id: "f4", x: 70, y: 46, w: 26, h: 26, acres: 18, radius: "38% 44% 42% 40%", tilt: -2 },
  { id: "f5", x: 41, y: 74, w: 28, h: 22, acres: 14, radius: "46% 40% 40% 44%", tilt: 2 },
  { id: "f6", x: 71, y: 73, w: 24, h: 23, acres: 10, radius: "40% 42% 46% 38%", tilt: -1 },
]

/**
 * Assign each field plot to a crop (or fallow) so the painted plot areas track
 * the acreage mix as closely as the fixed plots allow. Greedy largest-need
 * assignment: repeatedly give the next plot (largest first) to whichever crop
 * is furthest below its target acreage.
 */
export function allocateFields(mix: CropMix): Record<string, CropId | null> {
  const plots = [...FIELD_PLOTS].sort((a, b) => b.acres - a.acres)
  const remaining: Record<CropId, number> = { ...mix }
  const result: Record<string, CropId | null> = {}

  for (const plot of plots) {
    // Pick the crop with the most unmet acreage that this plot can still serve.
    let best: CropId | null = null
    let bestNeed = plot.acres * 0.35 // require a plot to be >~1/3 justified
    for (const id of CROP_ORDER) {
      if (remaining[id] > bestNeed) {
        bestNeed = remaining[id]
        best = id
      }
    }
    result[plot.id] = best
    if (best) remaining[best] -= plot.acres
  }
  return result
}

/* ------------------------------------------------------------------ *
 * Season
 * ------------------------------------------------------------------ */

export type SeasonPhase = "spring" | "summer" | "fall"

export function seasonPhase(t: number): SeasonPhase {
  if (t < 0.37) return "spring"
  if (t < 0.7) return "summer"
  return "fall"
}

export const SEASON_LABELS: Record<SeasonPhase, string> = {
  spring: "Spring",
  summer: "Summer",
  fall: "Fall",
}

/** Anchor points on the 0–1 timeline for the phase buttons. */
export const SEASON_ANCHORS: Record<SeasonPhase, number> = {
  spring: 0.12,
  summer: 0.52,
  fall: 0.9,
}

/* ------------------------------------------------------------------ *
 * Formatting
 * ------------------------------------------------------------------ */

export function usd(value: number): string {
  const rounded = Math.round(value)
  return rounded.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  })
}

export function usdCompact(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1000) {
    return `${value < 0 ? "-" : ""}$${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`
  }
  return usd(value)
}
