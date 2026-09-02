// Pure, dependency-free model powering the Landscape Planner Explorer.
//
// It turns a single control value — how "water-wise" the yard is, 0..1 — into a
// fully consistent plan: the areas of each material, irrigation zones, water
// use, material quantities and an itemized cost. The 3D clay scene and the
// metric labels both read from this one object, so the picture and the numbers
// can never disagree.
//
// This is an EDUCATIONAL visualization, not a landscape-architecture tool. The
// curves are smooth and stylized; the only promise is internal consistency —
// every square foot of the 1,000 sq ft yard is accounted for, and the water
// reduction always ties back to the traditional-lawn baseline.

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** The soft (plantable) part of the yard is a 6x5 grid of 30 sq ft tiles. */
export const GRID_COLS = 6
export const GRID_ROWS = 5
export const CELL_SQFT = 30
const SOFT_CELLS = GRID_COLS * GRID_ROWS // 30 tiles -> 900 sq ft
/** Patio + walkway are a fixed hardscape footprint outside the soft grid. */
const HARDSCAPE_SQFT = 100
export const TOTAL_AREA_SQFT = SOFT_CELLS * CELL_SQFT + HARDSCAPE_SQFT // 1,000

// Per-square-foot water use (gal / yr). Lawn is thirsty; beds sip, especially
// once drip irrigation replaces spray as the yard turns water-wise.
const LAWN_GAL_SQFT = 55
const PLANTING_GAL_SQFT_TRADITIONAL = 28
const PLANTING_GAL_SQFT_WATERWISE = 12

// Install / material costs. Deliberately round, contractor-ballpark figures.
const LAWN_COST_SQFT = 3.6
const PLANTING_COST_SQFT = 5.6
const GRAVEL_COST_SQFT = 3.2
const MULCH_COST_YARD = 55 // delivered + spread
const SPRAY_ZONE_COST = 300
const DRIP_ZONE_COST = 380
const HARDSCAPE_COST = 1500 // patio + walkway, fixed
const TREES_COST = 640 // three balled-and-burlapped shade trees

const MULCH_DEPTH_FT = 0.25 // 3" of mulch over every bed

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}
function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t))
}

// ---------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------

export type Material = "lawn" | "planting" | "mulch" | "gravel"

export type LandscapePlan = {
  /** Input, 0 = traditional lawn, 1 = fully water-wise. */
  waterWise: number
  totalAreaSqft: number
  hardscapeSqft: number
  /** Tile counts per material — the visual grid renders exactly these. */
  cells: Record<Material, number>
  /** Areas derived from the tile counts, so picture and metrics agree. */
  area: Record<Material, number>
  /** Total planting footprint (beds), the headline "planting area" metric. */
  plantingSqft: number
  mulchYards: number
  sprayZones: number
  dripZones: number
  totalZones: number
  annualIrrigationGal: number
  waterReductionPct: number
  estimatedCost: number
  /** Itemized costs, used by the element info cards. */
  cost: {
    lawn: number
    planting: number
    mulch: number
    gravel: number
    irrigation: number
    hardscape: number
    trees: number
  }
}

/** Round a fraction of the grid to a tile count. */
function tiles(frac: number): number {
  return Math.round(frac * SOFT_CELLS)
}

/**
 * Build a fully consistent plan for a given water-wise value. Deterministic and
 * pure, so the scene can memoize on the single number.
 */
export function computeLandscapePlan(waterWiseInput: number): LandscapePlan {
  const w = clamp01(waterWiseInput)

  // Tile counts. Fractions sum to 1 at both ends, so the grid is always full.
  //   traditional: lawn .68 / planting .20 / mulch .06 / gravel .06
  //   water-wise:  lawn .14 / planting .44 / mulch .16 / gravel .26
  let lawn = tiles(lerp(0.68, 0.14, w))
  let planting = tiles(lerp(0.2, 0.44, w))
  let mulch = tiles(lerp(0.06, 0.16, w))
  let gravel = SOFT_CELLS - lawn - planting - mulch
  // Rounding can push gravel negative; claw it back from the softest materials.
  while (gravel < 0) {
    if (mulch > 0) mulch--
    else if (planting > 0) planting--
    else lawn--
    gravel = SOFT_CELLS - lawn - planting - mulch
  }

  const cells: Record<Material, number> = { lawn, planting, mulch, gravel }
  const area: Record<Material, number> = {
    lawn: lawn * CELL_SQFT,
    planting: planting * CELL_SQFT,
    mulch: mulch * CELL_SQFT,
    gravel: gravel * CELL_SQFT,
  }

  // Beds (planting + dedicated mulch tiles) all get 3" of mulch.
  const mulchedSqft = area.planting + area.mulch
  const mulchYards = (mulchedSqft * MULCH_DEPTH_FT) / 27

  // Irrigation. Spray gives way to drip as the yard turns water-wise.
  const sprayZones = Math.max(0, Math.round(lerp(4, 1, w)))
  const dripZones = Math.max(0, Math.round(lerp(1, 3, w)))
  const totalZones = sprayZones + dripZones

  // Annual water. Baseline is the traditional end (w = 0) so reduction reads 0
  // there and climbs as lawn shrinks and beds move to drip.
  const plantingRate = lerp(
    PLANTING_GAL_SQFT_TRADITIONAL,
    PLANTING_GAL_SQFT_WATERWISE,
    w,
  )
  const annualIrrigationGal =
    area.lawn * LAWN_GAL_SQFT + area.planting * plantingRate

  const baseline =
    TOTAL_AREA_SQFT * 0 + // (keeps the intent explicit)
    tiles(0.68) * CELL_SQFT * LAWN_GAL_SQFT +
    tiles(0.2) * CELL_SQFT * PLANTING_GAL_SQFT_TRADITIONAL
  const waterReductionPct = Math.max(
    0,
    Math.round(((baseline - annualIrrigationGal) / baseline) * 100),
  )

  const cost = {
    lawn: area.lawn * LAWN_COST_SQFT,
    planting: area.planting * PLANTING_COST_SQFT,
    mulch: mulchYards * MULCH_COST_YARD,
    gravel: area.gravel * GRAVEL_COST_SQFT,
    irrigation: sprayZones * SPRAY_ZONE_COST + dripZones * DRIP_ZONE_COST,
    hardscape: HARDSCAPE_COST,
    trees: TREES_COST,
  }
  const estimatedCost = Math.round(
    cost.lawn +
      cost.planting +
      cost.mulch +
      cost.gravel +
      cost.irrigation +
      cost.hardscape +
      cost.trees,
  )

  return {
    waterWise: w,
    totalAreaSqft: TOTAL_AREA_SQFT,
    hardscapeSqft: HARDSCAPE_SQFT,
    cells,
    area,
    plantingSqft: area.planting,
    mulchYards,
    sprayZones,
    dripZones,
    totalZones,
    annualIrrigationGal: Math.round(annualIrrigationGal),
    waterReductionPct,
    estimatedCost,
    cost,
  }
}

// ---------------------------------------------------------------------------
// Selectable elements (floating info cards)
// ---------------------------------------------------------------------------

export type ElementId =
  | "lawn"
  | "planting"
  | "mulch"
  | "gravel"
  | "drip"
  | "patio"
  | "trees"

export type ElementInfo = {
  id: ElementId
  title: string
  blurb: string
}

export const ELEMENT_INFO: Record<ElementId, ElementInfo> = {
  lawn: {
    id: "lawn",
    title: "Lawn",
    blurb:
      "Turf grass is lush underfoot but the thirstiest surface in the yard — it drives most of the irrigation bill.",
  },
  planting: {
    id: "planting",
    title: "Planting bed",
    blurb:
      "Native and low-water plants, grouped by how much they drink so a single drip zone can serve the whole bed.",
  },
  mulch: {
    id: "mulch",
    title: "Mulch",
    blurb:
      "A few inches of bark over every bed locks moisture into the soil, suppresses weeds and slowly feeds the plants.",
  },
  gravel: {
    id: "gravel",
    title: "Decorative gravel",
    blurb:
      "Crushed stone gives structure and paths with zero irrigation — the biggest water saver as the yard turns water-wise.",
  },
  drip: {
    id: "drip",
    title: "Drip irrigation",
    blurb:
      "Emitters deliver water straight to the roots with almost no evaporation, replacing wasteful overhead spray zones.",
  },
  patio: {
    id: "patio",
    title: "Patio & walkway",
    blurb:
      "A stone gathering space and connecting path — permanent hardscape that never needs a drop of water.",
  },
  trees: {
    id: "trees",
    title: "Shade trees",
    blurb:
      "Canopy trees cool the yard and house, cutting the water the plants below them lose to the summer sun.",
  },
}

/** One element's card contents, computed from the current plan. */
export type ElementCard = {
  title: string
  stat: string
  tone: string
  cost: number
  blurb: string
}

export function elementCard(plan: LandscapePlan, id: ElementId): ElementCard {
  const info = ELEMENT_INFO[id]
  switch (id) {
    case "lawn":
      return {
        title: info.title,
        stat: `${formatArea(plan.area.lawn)}`,
        tone: "High water use",
        cost: plan.cost.lawn,
        blurb: info.blurb,
      }
    case "planting":
      return {
        title: info.title,
        stat: `${formatArea(plan.area.planting)}`,
        tone: "Low-water plants",
        cost: plan.cost.planting,
        blurb: info.blurb,
      }
    case "mulch":
      return {
        title: info.title,
        stat: `${plan.mulchYards.toFixed(1)} yd³`,
        tone: "Retains soil moisture",
        cost: plan.cost.mulch,
        blurb: info.blurb,
      }
    case "gravel":
      return {
        title: info.title,
        stat: `${formatArea(plan.area.gravel)}`,
        tone: "Zero irrigation",
        cost: plan.cost.gravel,
        blurb: info.blurb,
      }
    case "drip":
      return {
        title: info.title,
        stat: `${plan.dripZones} drip ${plan.dripZones === 1 ? "zone" : "zones"}`,
        tone: `${plan.sprayZones} spray ${plan.sprayZones === 1 ? "zone" : "zones"} remain`,
        cost: plan.cost.irrigation,
        blurb: info.blurb,
      }
    case "patio":
      return {
        title: info.title,
        stat: `${formatArea(plan.hardscapeSqft)}`,
        tone: "Gathering space",
        cost: plan.cost.hardscape,
        blurb: info.blurb,
      }
    case "trees":
      return {
        title: info.title,
        stat: "3 shade trees",
        tone: "Cooling & shade",
        cost: plan.cost.trees,
        blurb: info.blurb,
      }
  }
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function money(value: number, digits = 0): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)
}

export function formatArea(sqft: number): string {
  return `${Math.round(sqft).toLocaleString("en-US")} sq ft`
}

export function formatGallons(gal: number): string {
  return `${Math.round(gal).toLocaleString("en-US")} gal`
}
