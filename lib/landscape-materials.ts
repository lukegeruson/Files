// Landscape Materials & Irrigation Planner engine.
//
// Two jobs live here:
//   1. "How much material do I need?" — area x depth converted to cubic feet,
//      cubic yards, tons, bags, pallets and an order quantity with waste.
//   2. "How much water does my yard need?" — area, sprinkler type and flow
//      turned into zones, runtimes and gallons.
//
// Everything is derived from the shared area math so the two halves of the tool
// agree with each other and with the cost calculator.

import { resolveRegion, type ResolvedRegion } from "@/lib/landscaping"
import { resolveStateFromZip } from "@/lib/zip"

// --- Shapes ----------------------------------------------------------------

export type ShapeKind = "rect" | "circle" | "triangle"

export type Shape = {
  id: string
  kind: ShapeKind
  /** rect: length · circle: diameter · triangle: base */
  a: number
  /** rect: width · triangle: height · unused for circle */
  b: number
}

export const SHAPE_LABELS: Record<ShapeKind, string> = {
  rect: "Rectangle / square",
  circle: "Circle",
  triangle: "Triangle",
}

/** What each shape's two inputs mean, shown next to the fields. */
export const SHAPE_FIELDS: Record<ShapeKind, { a: string; b: string | null; help: string }> = {
  rect: {
    a: "Length (ft)",
    b: "Width (ft)",
    help: "Measure the two sides with a tape. For an L-shaped area, split it into two rectangles and add both.",
  },
  circle: {
    a: "Diameter (ft)",
    b: null,
    help: "Measure straight across the widest point, through the middle — not around the edge.",
  },
  triangle: {
    a: "Base (ft)",
    b: "Height (ft)",
    help: "Base is any one side. Height is the straight-line distance from that side to the opposite corner.",
  },
}

export function shapeArea(shape: Shape): number {
  const a = Math.max(0, shape.a || 0)
  const b = Math.max(0, shape.b || 0)
  if (shape.kind === "rect") return a * b
  if (shape.kind === "circle") return Math.PI * (a / 2) ** 2
  return 0.5 * a * b
}

export function shapePerimeter(shape: Shape): number {
  const a = Math.max(0, shape.a || 0)
  const b = Math.max(0, shape.b || 0)
  if (shape.kind === "rect") return 2 * (a + b)
  if (shape.kind === "circle") return Math.PI * a
  // Assume a right triangle for the hypotenuse — close enough for edging.
  return a + b + Math.sqrt(a * a + b * b)
}

export function totalArea(shapes: Shape[]): number {
  return shapes.reduce((sum, s) => sum + shapeArea(s), 0)
}

export function totalPerimeter(shapes: Shape[]): number {
  return shapes.reduce((sum, s) => sum + shapePerimeter(s), 0)
}

export function describeShape(shape: Shape): string {
  const a = shape.a || 0
  const b = shape.b || 0
  if (shape.kind === "rect") return `${n(a)} ft x ${n(b)} ft`
  if (shape.kind === "circle") return `${n(a)} ft across`
  return `${n(a)} ft base x ${n(b)} ft high`
}

// --- Projects --------------------------------------------------------------

export type ProjectId =
  | "gravel"
  | "mulch"
  | "topsoil"
  | "sand"
  | "sod"
  | "seed"
  | "pavers"
  | "concrete"
  | "beds"
  | "irrigation"

export const PROJECT_LABELS: Record<ProjectId, string> = {
  gravel: "Gravel & rock",
  mulch: "Mulch",
  topsoil: "Topsoil & compost",
  sand: "Sand",
  sod: "Sod",
  seed: "Grass seed",
  pavers: "Pavers",
  concrete: "Concrete",
  beds: "Planting beds",
  irrigation: "Irrigation & watering",
}

export const PROJECT_QUESTIONS: Record<ProjectId, string> = {
  gravel: "How much gravel do I need?",
  mulch: "How much mulch do I need?",
  topsoil: "How much topsoil do I need?",
  sand: "How much sand do I need?",
  sod: "How much sod do I need?",
  seed: "How much grass seed do I need?",
  pavers: "How many pavers do I need?",
  concrete: "How much concrete do I need?",
  beds: "How many plants and how much mulch for my beds?",
  irrigation: "How much water does my yard need?",
}

/** Projects that are area x depth bulk material math. */
export const BULK_PROJECTS: ProjectId[] = ["gravel", "mulch", "topsoil", "sand"]

// --- Material variants -----------------------------------------------------

export type MaterialVariant = {
  value: string
  label: string
  /** Pounds per cubic yard, loose/delivered. Null when never sold by weight. */
  lbPerCuYd: number | null
  /** Delivered bulk price per cubic yard, national average. */
  pricePerCuYd: number
  /** Retail bagged price for one bag of bagCuFt. */
  pricePerBag: number
  bagCuFt: number
  bagLabel: string
  note: string
}

export const MATERIALS: Record<"gravel" | "mulch" | "topsoil" | "sand", MaterialVariant[]> = {
  gravel: [
    {
      value: "crushed",
      label: 'Crushed stone (#57, 3/4")',
      lbPerCuYd: 2800,
      pricePerCuYd: 55,
      pricePerBag: 6.5,
      bagCuFt: 0.5,
      bagLabel: "0.5 cu ft (50 lb) bag",
      note: "Angular, locks together. The standard base under patios, walkways and driveways.",
    },
    {
      value: "pea",
      label: "Pea gravel",
      lbPerCuYd: 2700,
      pricePerCuYd: 62,
      pricePerBag: 7,
      bagCuFt: 0.5,
      bagLabel: "0.5 cu ft (50 lb) bag",
      note: "Rounded and smooth, so it shifts underfoot. Good for paths and dog runs, poor as a base.",
    },
    {
      value: "river",
      label: "River rock (1-3 in)",
      lbPerCuYd: 2700,
      pricePerCuYd: 95,
      pricePerBag: 9,
      bagCuFt: 0.5,
      bagLabel: "0.5 cu ft (50 lb) bag",
      note: "Decorative ground cover and dry creek beds. Larger stone means deeper coverage.",
    },
    {
      value: "dg",
      label: "Decomposed granite",
      lbPerCuYd: 3000,
      pricePerCuYd: 70,
      pricePerBag: 8,
      bagCuFt: 0.5,
      bagLabel: "0.5 cu ft (50 lb) bag",
      note: "Compacts into a firm surface. Popular for xeriscape paths and patios.",
    },
    {
      value: "lava",
      label: "Lava rock",
      lbPerCuYd: 1400,
      pricePerCuYd: 120,
      pricePerBag: 8.5,
      bagCuFt: 0.5,
      bagLabel: "0.5 cu ft (50 lb) bag",
      note: "Very light, so a ton covers roughly twice the area of stone. Sold mostly by volume.",
    },
  ],
  mulch: [
    {
      value: "hardwood",
      label: "Shredded hardwood bark",
      lbPerCuYd: 800,
      pricePerCuYd: 40,
      pricePerBag: 4.25,
      bagCuFt: 2,
      bagLabel: "2 cu ft bag",
      note: "The default choice. Knits together on slopes and breaks down into the soil.",
    },
    {
      value: "cedar",
      label: "Cedar / cypress",
      lbPerCuYd: 700,
      pricePerCuYd: 52,
      pricePerBag: 5.25,
      bagCuFt: 2,
      bagLabel: "2 cu ft bag",
      note: "Lasts longer and resists insects. Costs more and fades to grey.",
    },
    {
      value: "dyed",
      label: "Dyed mulch (black/brown/red)",
      lbPerCuYd: 800,
      pricePerCuYd: 45,
      pricePerBag: 4,
      bagCuFt: 2,
      bagLabel: "2 cu ft bag",
      note: "Holds color about a season. Usually ground pallet wood rather than bark.",
    },
    {
      value: "playground",
      label: "Playground wood chips",
      lbPerCuYd: 700,
      pricePerCuYd: 48,
      pricePerBag: 5,
      bagCuFt: 2,
      bagLabel: "2 cu ft bag",
      note: "Needs 9-12 in under play equipment to meet fall-height guidance.",
    },
    {
      value: "pine",
      label: "Pine bark nuggets",
      lbPerCuYd: 650,
      pricePerCuYd: 55,
      pricePerBag: 5.5,
      bagCuFt: 2,
      bagLabel: "2 cu ft bag",
      note: "Chunky and slow to break down, but floats away in heavy rain or on slopes.",
    },
  ],
  topsoil: [
    {
      value: "screened",
      label: "Screened topsoil",
      lbPerCuYd: 2200,
      pricePerCuYd: 32,
      pricePerBag: 3.25,
      bagCuFt: 0.75,
      bagLabel: "0.75 cu ft bag",
      note: "General fill and lawn repair. Weight varies a lot with moisture.",
    },
    {
      value: "garden",
      label: "Garden soil blend",
      lbPerCuYd: 1700,
      pricePerCuYd: 48,
      pricePerBag: 5,
      bagCuFt: 1.5,
      bagLabel: "1.5 cu ft bag",
      note: "Topsoil cut with compost. Use it for beds and raised boxes, not for grading.",
    },
    {
      value: "compost",
      label: "Compost",
      lbPerCuYd: 1100,
      pricePerCuYd: 45,
      pricePerBag: 5.5,
      bagCuFt: 1,
      bagLabel: "1 cu ft bag",
      note: "Soil amendment, not a growing medium on its own. Mix into the top 6 in.",
    },
    {
      value: "raised",
      label: "Raised bed mix",
      lbPerCuYd: 1500,
      pricePerCuYd: 65,
      pricePerBag: 6.5,
      bagCuFt: 1.5,
      bagLabel: "1.5 cu ft bag",
      note: "Light and fast-draining, built for boxes and planters.",
    },
  ],
  sand: [
    {
      value: "bedding",
      label: "Paver / bedding sand",
      lbPerCuYd: 2700,
      pricePerCuYd: 42,
      pricePerBag: 6,
      bagCuFt: 0.5,
      bagLabel: "0.5 cu ft (50 lb) bag",
      note: "Coarse and sharp. Screeded 1 in thick under pavers — never use play sand here.",
    },
    {
      value: "play",
      label: "Play sand",
      lbPerCuYd: 2600,
      pricePerCuYd: 55,
      pricePerBag: 6.5,
      bagCuFt: 0.5,
      bagLabel: "0.5 cu ft (50 lb) bag",
      note: "Washed and screened for sandboxes. Budget 12 in of depth.",
    },
    {
      value: "masonry",
      label: "Masonry sand",
      lbPerCuYd: 2700,
      pricePerCuYd: 48,
      pricePerBag: 6.25,
      bagCuFt: 0.5,
      bagLabel: "0.5 cu ft (50 lb) bag",
      note: "Fine and uniform, for mortar and grout mixes.",
    },
    {
      value: "fill",
      label: "Fill sand",
      lbPerCuYd: 2800,
      pricePerCuYd: 28,
      pricePerBag: 5,
      bagCuFt: 0.5,
      bagLabel: "0.5 cu ft (50 lb) bag",
      note: "Cheap bulk fill for leveling and backfill. Not a finish material.",
    },
  ],
}

/** Typical depths, shown as guidance next to the depth field. */
export const DEPTH_GUIDE: Record<string, { depth: number; hint: string }> = {
  gravel: {
    depth: 3,
    hint: "2-3 in for decorative ground cover, 4 in for a walkway base, 6-8 in under a patio, 10-12 in for a driveway.",
  },
  mulch: {
    depth: 3,
    hint: "2-3 in in planting beds (never mound against trunks), 4 in for weed suppression, 9-12 in under play equipment.",
  },
  topsoil: {
    depth: 4,
    hint: "2 in to top-dress a lawn, 4-6 in for new grass, 8-12 in for vegetable beds.",
  },
  sand: {
    depth: 1,
    hint: '1 in screeded bedding under pavers, 2 in for leveling, 12 in for a sandbox.',
  },
}

// --- Sod -------------------------------------------------------------------

export type SodVariant = {
  value: string
  label: string
  pricePerSqft: number
  palletSqft: number
  note: string
}

export const SOD_TYPES: SodVariant[] = [
  { value: "fescue", label: "Tall fescue", pricePerSqft: 0.42, palletSqft: 500, note: "Cool-season all-rounder. Handles part shade better than most." },
  { value: "bluegrass", label: "Kentucky bluegrass", pricePerSqft: 0.48, palletSqft: 500, note: "Fine texture, self-repairing, but thirsty and needs full sun." },
  { value: "bermuda", label: "Bermuda", pricePerSqft: 0.4, palletSqft: 450, note: "Warm-season, heat and traffic tolerant, goes dormant brown in winter." },
  { value: "zoysia", label: "Zoysia", pricePerSqft: 0.62, palletSqft: 450, note: "Dense and slow-growing. Premium price, less mowing." },
  { value: "staug", label: "St. Augustine", pricePerSqft: 0.55, palletSqft: 400, note: "Gulf-coast standard. Shade tolerant, not cold hardy." },
  { value: "buffalo", label: "Buffalo grass", pricePerSqft: 0.58, palletSqft: 450, note: "Native and very low water once established." },
]

/** A sod roll is 2 ft x 5 ft. */
const SOD_ROLL_SQFT = 10

// --- Seed ------------------------------------------------------------------

export type SeedVariant = {
  value: string
  label: string
  /** Pounds per 1,000 sq ft for a brand-new lawn. */
  newRate: number
  /** Pounds per 1,000 sq ft when overseeding an existing lawn. */
  overRate: number
  pricePerLb: number
  note: string
}

export const SEED_TYPES: SeedVariant[] = [
  { value: "fescue", label: "Tall fescue", newRate: 8, overRate: 4, pricePerLb: 4.5, note: "Big seed, so it takes more pounds. Germinates in 7-14 days." },
  { value: "bluegrass", label: "Kentucky bluegrass", newRate: 2, overRate: 1, pricePerLb: 8, note: "Tiny seed, low rate. Slow: 14-28 days to germinate." },
  { value: "rye", label: "Perennial ryegrass", newRate: 8, overRate: 4, pricePerLb: 3.75, note: "Fastest germination, 5-10 days. Often used to overseed dormant Bermuda." },
  { value: "fine", label: "Fine fescue", newRate: 5, overRate: 2.5, pricePerLb: 5.5, note: "The best shade option and low input once established." },
  { value: "bermuda", label: "Bermuda (hulled)", newRate: 2, overRate: 1, pricePerLb: 12, note: "Needs soil above 65F to germinate. Sow late spring into summer." },
  { value: "sun-shade", label: "Sun & shade mix", newRate: 6, overRate: 3, pricePerLb: 4.25, note: "A blend that hedges across conditions. Convenient, never optimal." },
]

const SEED_BAG_LB = 25

// --- Pavers ----------------------------------------------------------------

export type PaverVariant = {
  value: string
  label: string
  sqft: number
  pricePerSqft: number
}

export const PAVER_SIZES: PaverVariant[] = [
  { value: "brick", label: '4 x 8 in brick paver', sqft: 0.222, pricePerSqft: 3.75 },
  { value: "holland", label: '6 x 9 in Holland stone', sqft: 0.375, pricePerSqft: 4.25 },
  { value: "square6", label: '6 x 6 in square', sqft: 0.25, pricePerSqft: 4.5 },
  { value: "square12", label: '12 x 12 in square', sqft: 1, pricePerSqft: 5.25 },
  { value: "large16", label: '16 x 16 in slab', sqft: 1.778, pricePerSqft: 6.5 },
  { value: "large24", label: '24 x 24 in slab', sqft: 4, pricePerSqft: 9 },
]

export type PaverUse = "walkway" | "patio" | "driveway"

export const PAVER_USES: Record<PaverUse, { label: string; baseIn: number; note: string }> = {
  walkway: { label: "Walkway / path", baseIn: 4, note: "Foot traffic only, so 4 in of compacted base is enough." },
  patio: { label: "Patio", baseIn: 6, note: "6 in of base handles furniture, grills and freeze-thaw movement." },
  driveway: { label: "Driveway", baseIn: 10, note: "Vehicles need 10-12 in of base, and thicker pavers rated for traffic." },
}

/** One 50 lb bag of polymeric joint sand fills roughly this much paver area. */
const JOINT_SAND_SQFT_PER_BAG = 75
const BEDDING_SAND_IN = 1

// --- Concrete --------------------------------------------------------------

/** An 80 lb bag of concrete mix yields about 0.6 cu ft. */
const CONCRETE_BAGS = [
  { value: "80", label: "80 lb bag", cuFt: 0.6, price: 6.75 },
  { value: "60", label: "60 lb bag", cuFt: 0.45, price: 5.5 },
  { value: "50", label: "50 lb bag", cuFt: 0.375, price: 4.95 },
]

const READY_MIX_PER_CUYD = 185
const SHORT_LOAD_FEE = 120
/** Wire mesh sheets are 5 ft x 10 ft. */
const MESH_SHEET_SQFT = 50

// --- Planting beds ---------------------------------------------------------

export type PlantSizeVariant = {
  value: string
  label: string
  price: number
  spacing: number
  note: string
}

export const PLANT_SIZES: PlantSizeVariant[] = [
  { value: "flat", label: "Annual flats / 4 in pots", price: 4.5, spacing: 1, note: "Fills in immediately, replaced each season." },
  { value: "1gal", label: "1 gallon perennials", price: 12, spacing: 2, note: "The value sweet spot. Fills in over one or two seasons." },
  { value: "3gal", label: "3 gallon shrubs", price: 38, spacing: 3, note: "Reads as established the first year." },
  { value: "5gal", label: "5 gallon shrubs", price: 65, spacing: 4, note: "Instant structure and screening, at roughly double the cost per plant." },
]

// --- Irrigation ------------------------------------------------------------

export type HeadType = {
  value: string
  label: string
  /** Inches of water applied per hour. */
  precipRate: number
  /** Gallons per minute per head. */
  gpm: number
  /** Throw radius in feet. */
  radius: number
  note: string
}

export const HEAD_TYPES: HeadType[] = [
  {
    value: "rotor",
    label: "Rotor (gear-drive)",
    precipRate: 0.4,
    gpm: 3,
    radius: 25,
    note: "Rotating stream for large lawns. Low precipitation rate means long runtimes.",
  },
  {
    value: "spray",
    label: "Fixed spray head",
    precipRate: 1.5,
    gpm: 1.6,
    radius: 12,
    note: "Fan of water for small areas. Applies water nearly 4x faster than a rotor.",
  },
  {
    value: "mp",
    label: "MP Rotator nozzle",
    precipRate: 0.4,
    gpm: 1,
    radius: 18,
    note: "Multi-stream retrofit for spray bodies. Efficient, wind resistant, long runtimes.",
  },
  {
    value: "impact",
    label: "Impact sprinkler",
    precipRate: 0.5,
    gpm: 3.5,
    radius: 30,
    note: "The classic clicking sprinkler. Durable and cheap, less uniform.",
  },
  {
    value: "hose",
    label: "Hose-end / oscillating",
    precipRate: 0.8,
    gpm: 4,
    radius: 20,
    note: "No system needed. Move it by hand and expect uneven coverage.",
  },
  {
    value: "drip",
    label: "Drip line (beds)",
    precipRate: 0.35,
    gpm: 0.6,
    radius: 0,
    note: "Emitters at the root zone. Around 90% efficient — the best choice for beds.",
  },
]

export type SoilType = "sand" | "loam" | "clay"

export const SOIL_LABELS: Record<SoilType, string> = {
  sand: "Sandy / fast draining",
  loam: "Loam / average",
  clay: "Clay / slow draining",
}

/** Maximum inches per hour the soil can absorb before water runs off. */
const SOIL_INTAKE: Record<SoilType, number> = { sand: 1.5, loam: 0.6, clay: 0.25 }
/** How many inches of water the soil holds in the root zone per application. */
const SOIL_HOLD: Record<SoilType, number> = { sand: 0.5, loam: 0.85, clay: 1.1 }

export type WaterSource = "municipal" | "well" | "hose"

export const SOURCE_LABELS: Record<WaterSource, string> = {
  municipal: "City water (dedicated line)",
  well: "Well pump",
  hose: "Hose bib / spigot",
}

/** Typical usable flow in GPM when the homeowner doesn't know their number. */
const SOURCE_GPM: Record<WaterSource, number> = { municipal: 12, well: 10, hose: 8 }

/**
 * Peak-season water need in inches per week, by state. Reflects reference
 * evapotranspiration: hot arid regions need far more than the "1 inch a week"
 * rule of thumb, cool coastal regions less.
 */
const WEEKLY_WATER: Record<string, number> = {
  AL: 1.3, AK: 0.6, AZ: 2.1, AR: 1.3, CA: 1.5, CO: 1.5, CT: 1.1,
  DE: 1.2, DC: 1.2, FL: 1.4, GA: 1.3, HI: 1.2, ID: 1.4, IL: 1.2,
  IN: 1.1, IA: 1.2, KS: 1.5, KY: 1.2, LA: 1.4, ME: 1.0, MD: 1.2,
  MA: 1.1, MI: 1.0, MN: 1.1, MS: 1.3, MO: 1.3, MT: 1.3, NE: 1.4,
  NV: 2.0, NH: 1.0, NJ: 1.2, NM: 1.9, NY: 1.1, NC: 1.2, ND: 1.2,
  OH: 1.1, OK: 1.6, OR: 1.1, PA: 1.1, PR: 1.4, RI: 1.1, SC: 1.3,
  SD: 1.3, TN: 1.2, TX: 1.7, UT: 1.7, VT: 1.0, VA: 1.2, WA: 1.0,
  WV: 1.1, WI: 1.0, WY: 1.4,
}

const NATIONAL_WEEKLY_WATER = 1.2

/** One inch of water over 1,000 sq ft is 623 gallons. */
const GAL_PER_INCH_PER_1000 = 623

// --- Shared helpers --------------------------------------------------------

const n = (v: number) => (Math.round(v * 10) / 10).toLocaleString("en-US")
const int = (v: number) => Math.round(v).toLocaleString("en-US")
const money = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`

export type Metric = {
  label: string
  value: string
  hint?: string
  emphasis?: boolean
}

export type CostLine = { label: string; amount: number; note?: string }
export type Step = { label: string; detail: string }

export type MaterialPlan = {
  project: ProjectId
  area: number
  perimeter: number
  /** The single number the page leads with. */
  headline: { value: string; label: string; sub?: string }
  metrics: Metric[]
  /** What to actually buy. */
  order: Metric[]
  costs: CostLine[]
  costTotal: number
  costNote: string
  steps: Step[]
  tips: string[]
  region: ResolvedRegion
}

export type MaterialInputs = {
  project: ProjectId
  area: number
  perimeter: number
  depth: number
  wastePercent: number
  variant: string
  zip: string
  /** Buying loose by the yard vs bagged at a store. */
  supply: "bulk" | "bag"
  /** sod / seed */
  seedMode: "new" | "over"
  /** pavers */
  paverUse: PaverUse
  /** concrete */
  concreteBag: string
  concreteSupply: "ready" | "bag"
  /** beds */
  plantSize: string
  plantSpacing: number
}

// --- Bulk materials --------------------------------------------------------

function bulkPlan(inputs: MaterialInputs, region: ResolvedRegion): MaterialPlan {
  const key = inputs.project as "gravel" | "mulch" | "topsoil" | "sand"
  const variants = MATERIALS[key]
  const variant = variants.find((v) => v.value === inputs.variant) ?? variants[0]

  const area = inputs.area
  const depth = Math.max(0, inputs.depth)
  const waste = Math.max(0, inputs.wastePercent) / 100

  const cuFt = area * (depth / 12)
  const cuYd = cuFt / 27
  const cuYdOrder = cuYd * (1 + waste)
  const tons = variant.lbPerCuYd ? (cuYdOrder * variant.lbPerCuYd) / 2000 : null
  const bags = Math.ceil((cuFt * (1 + waste)) / variant.bagCuFt)

  // Bulk yards are usually sold in half-yard increments.
  const orderYards = Math.max(0.5, Math.ceil(cuYdOrder * 2) / 2)

  const priceIndex = 0.4 + 0.6 * region.index // materials travel; labor doesn't
  const bulkCost = orderYards * variant.pricePerCuYd * priceIndex
  const bagCost = bags * variant.pricePerBag * priceIndex
  const deliveryLoads = Math.ceil(orderYards / 10)
  const delivery = orderYards > 0 ? deliveryLoads * 95 : 0

  const usingBulk = inputs.supply === "bulk"
  const costs: CostLine[] = usingBulk
    ? [
        { label: `${variant.label} — ${n(orderYards)} cu yd bulk`, amount: bulkCost },
        {
          label: `Delivery (${deliveryLoads} ${deliveryLoads === 1 ? "load" : "loads"})`,
          amount: delivery,
          note: "Most yards charge per truckload within a set radius.",
        },
      ]
    : [{ label: `${variant.label} — ${int(bags)} x ${variant.bagLabel}`, amount: bagCost }]

  const costTotal = costs.reduce((s, c) => s + c.amount, 0)

  const metrics: Metric[] = [
    { label: "Area", value: `${int(area)} sq ft` },
    { label: "Depth", value: `${n(depth)} in` },
    { label: "Volume needed", value: `${n(cuFt)} cu ft`, hint: "Area x depth, before waste." },
    {
      label: "Cubic yards needed",
      value: `${n(cuYd)} cu yd`,
      hint: "Bulk material is sold by the cubic yard: 27 cu ft.",
      emphasis: true,
    },
  ]
  if (tons !== null) {
    metrics.push({
      label: "Weight",
      value: `${n(tons)} tons`,
      hint: `${variant.label} weighs about ${int(variant.lbPerCuYd!)} lb per cubic yard.`,
    })
  }

  const order: Metric[] = usingBulk
    ? [
        {
          label: "Order this much",
          value: `${n(orderYards)} cu yd`,
          hint: `Includes ${Math.round(waste * 100)}% overage, rounded up to the half yard.`,
          emphasis: true,
        },
        ...(tons !== null ? [{ label: "If priced by the ton", value: `${n(tons)} tons` }] : []),
        {
          label: "Truckloads",
          value: `${deliveryLoads} ${deliveryLoads === 1 ? "load" : "loads"}`,
          hint: "A standard dump truck carries about 10 cubic yards.",
        },
      ]
    : [
        {
          label: "Bags to buy",
          value: `${int(bags)} bags`,
          hint: `${variant.bagLabel}, including ${Math.round(waste * 100)}% overage.`,
          emphasis: true,
        },
        {
          label: "Car trips",
          value: `${Math.ceil(bags / 15)} trips`,
          hint: "Roughly 15 bags fit in a sedan trunk or SUV cargo area.",
        },
      ]

  const bulkEquivalent = Math.ceil(27 / variant.bagCuFt)
  const tips: string[] = [
    `One cubic yard equals ${bulkEquivalent} ${variant.bagLabel}s. Above about 3 cubic yards, bulk delivery is almost always cheaper than bagged.`,
    variant.note,
  ]
  if (inputs.project === "mulch") {
    tips.push(
      "Keep mulch 2-3 in deep and pull it back from trunks and stems. Piling it into volcanoes around trees traps moisture and invites rot.",
    )
  }
  if (inputs.project === "gravel") {
    tips.push(
      "Lay landscape fabric under decorative gravel, not under a compacted base. Fabric under a base course prevents the stone from interlocking with the subgrade.",
    )
  }
  if (inputs.project === "topsoil") {
    tips.push(
      "Soil settles roughly 15-20% after watering. Order on the generous side and grade slightly high if you are filling to a fixed elevation.",
    )
  }
  if (inputs.project === "sand" && variant.value === "bedding") {
    tips.push(
      "Screed bedding sand to a consistent 1 in and do not compact it before laying pavers. Compaction happens after, through the pavers.",
    )
  }

  const steps: Step[] = [
    {
      label: "1. Find the area",
      detail: `${int(area)} sq ft of coverage.`,
    },
    {
      label: "2. Convert depth to feet",
      detail: `${n(depth)} in / 12 = ${(depth / 12).toFixed(3)} ft.`,
    },
    {
      label: "3. Multiply for volume",
      detail: `${int(area)} sq ft x ${(depth / 12).toFixed(3)} ft = ${n(cuFt)} cu ft.`,
    },
    {
      label: "4. Convert to cubic yards",
      detail: `${n(cuFt)} cu ft / 27 = ${n(cuYd)} cu yd.`,
    },
    {
      label: `5. Add ${Math.round(waste * 100)}% waste`,
      detail: `${n(cuYd)} x ${(1 + waste).toFixed(2)} = ${n(cuYdOrder)} cu yd, ordered as ${n(orderYards)} cu yd.`,
    },
  ]
  if (tons !== null) {
    steps.push({
      label: "6. Convert yards to tons",
      detail: `${n(orderYards)} cu yd x ${int(variant.lbPerCuYd!)} lb / 2,000 = ${n(tons)} tons.`,
    })
  }

  return {
    project: inputs.project,
    area,
    perimeter: inputs.perimeter,
    headline: {
      value: usingBulk ? `${n(orderYards)} cu yd` : `${int(bags)} bags`,
      label: usingBulk ? `of ${variant.label.toLowerCase()} to order` : `of ${variant.label.toLowerCase()}`,
      sub:
        tons !== null && usingBulk
          ? `About ${n(tons)} tons · covers ${int(area)} sq ft at ${n(depth)} in`
          : `Covers ${int(area)} sq ft at ${n(depth)} in deep`,
    },
    metrics,
    order,
    costs,
    costTotal,
    costNote: usingBulk
      ? `Delivered bulk pricing for ${region.stateName}. Yards quote per cubic yard or per ton — ask which.`
      : `Retail bagged pricing for ${region.stateName}, before tax.`,
    steps,
    tips,
    region,
  }
}

// --- Sod -------------------------------------------------------------------

function sodPlan(inputs: MaterialInputs, region: ResolvedRegion): MaterialPlan {
  const variant = SOD_TYPES.find((v) => v.value === inputs.variant) ?? SOD_TYPES[0]
  const area = inputs.area
  const waste = Math.max(0, inputs.wastePercent) / 100
  const withWaste = area * (1 + waste)
  const rolls = Math.ceil(withWaste / SOD_ROLL_SQFT)
  const pallets = withWaste / variant.palletSqft
  const fullPallets = Math.floor(pallets)
  const remainderRolls = Math.ceil(((pallets - fullPallets) * variant.palletSqft) / SOD_ROLL_SQFT)

  const priceIndex = 0.5 + 0.5 * region.index
  const sodCost = withWaste * variant.pricePerSqft * priceIndex
  const prepSoil = (area * (2 / 12)) / 27 // 2 in of topsoil prep
  const soilCost = prepSoil * 32 * priceIndex
  const starterBags = Math.ceil(area / 5000)
  const fertCost = starterBags * 22
  const delivery = withWaste > 0 ? 85 : 0

  const costs: CostLine[] = [
    { label: `${variant.label} sod — ${int(withWaste)} sq ft`, amount: sodCost },
    {
      label: `Topsoil for prep — ${n(prepSoil)} cu yd`,
      amount: soilCost,
      note: "2 in tilled in before laying. Skip only if your grade and soil are already good.",
    },
    { label: `Starter fertilizer — ${starterBags} bag${starterBags === 1 ? "" : "s"}`, amount: fertCost },
    { label: "Delivery", amount: delivery },
  ]
  const costTotal = costs.reduce((s, c) => s + c.amount, 0)

  const waterGal = (area / 1000) * 0.75 * GAL_PER_INCH_PER_1000

  return {
    project: "sod",
    area,
    perimeter: inputs.perimeter,
    headline: {
      value: `${int(withWaste)} sq ft`,
      label: "of sod to order",
      sub: `${fullPallets > 0 ? `${fullPallets} full pallet${fullPallets === 1 ? "" : "s"}` : "Under one pallet"}${
        remainderRolls > 0 ? ` + ${remainderRolls} rolls` : ""
      }`,
    },
    metrics: [
      { label: "Lawn area", value: `${int(area)} sq ft` },
      {
        label: "Sod to order",
        value: `${int(withWaste)} sq ft`,
        hint: `Includes ${Math.round(waste * 100)}% for trimming around curves and edges.`,
        emphasis: true,
      },
      { label: "Rolls", value: `${int(rolls)} rolls`, hint: "A standard roll is 2 ft x 5 ft = 10 sq ft." },
      {
        label: "Pallets",
        value: n(Math.ceil(pallets * 10) / 10),
        hint: `${variant.label} pallets cover about ${int(variant.palletSqft)} sq ft each.`,
      },
      {
        label: "Water for week one",
        value: `${int(waterGal)} gal / day`,
        hint: "New sod needs daily light watering until the roots knit down, usually 2 weeks.",
      },
    ],
    order: [
      {
        label: "Order",
        value:
          fullPallets > 0
            ? `${fullPallets} pallet${fullPallets === 1 ? "" : "s"}${remainderRolls > 0 ? ` + ${remainderRolls} rolls` : ""}`
            : `${int(rolls)} loose rolls`,
        emphasis: true,
        hint:
          fullPallets > 0
            ? "Most farms sell full pallets plus loose rolls for the remainder."
            : "Too small for a full pallet — buy loose rolls by the piece.",
      },
      {
        label: "Install within",
        value: "24 hours",
        hint: "Sod is a living product. Stacked on a pallet in summer heat it can cook in a day.",
      },
    ],
    costs,
    costTotal,
    costNote: `Material only for ${region.stateName}. Professional installation typically adds $0.60-1.20 per sq ft.`,
    steps: [
      { label: "1. Measure the lawn", detail: `${int(area)} sq ft to cover.` },
      {
        label: `2. Add ${Math.round(waste * 100)}% for cuts`,
        detail: `${int(area)} x ${(1 + waste).toFixed(2)} = ${int(withWaste)} sq ft. Curves and beds waste more than straight edges.`,
      },
      {
        label: "3. Convert to rolls",
        detail: `${int(withWaste)} / 10 sq ft per roll = ${int(rolls)} rolls.`,
      },
      {
        label: "4. Convert to pallets",
        detail: `${int(withWaste)} / ${int(variant.palletSqft)} sq ft per pallet = ${n(pallets)} pallets.`,
      },
    ],
    tips: [
      variant.note,
      "Lay sod in a running-bond pattern like brickwork, with tight seams and no gaps. Stagger the joints so seams don't line up.",
      "Water within 30 minutes of laying the first piece. Sod that dries at the edges shrinks and leaves permanent gaps.",
      "Seeding the same area costs roughly 80% less, but takes a full season to fill in and needs consistent moisture.",
    ],
    region,
  }
}

// --- Seed ------------------------------------------------------------------

function seedPlan(inputs: MaterialInputs, region: ResolvedRegion): MaterialPlan {
  const variant = SEED_TYPES.find((v) => v.value === inputs.variant) ?? SEED_TYPES[0]
  const area = inputs.area
  const isNew = inputs.seedMode === "new"
  const rate = isNew ? variant.newRate : variant.overRate
  const thousands = area / 1000
  const lbs = thousands * rate
  const waste = Math.max(0, inputs.wastePercent) / 100
  const lbsOrder = lbs * (1 + waste)
  const bags = Math.ceil(lbsOrder / SEED_BAG_LB)

  const priceIndex = 0.7 + 0.3 * region.index
  const seedCost = lbsOrder * variant.pricePerLb * priceIndex
  const starterBags = Math.ceil(area / 5000)
  const fertCost = starterBags * 24
  const strawBales = isNew ? Math.ceil(area / 800) : 0
  const strawCost = strawBales * 9
  const topdressYd = isNew ? (area * (0.25 / 12)) / 27 : 0
  const topdressCost = topdressYd * 45 * priceIndex

  const costs: CostLine[] = [
    { label: `${variant.label} seed — ${n(lbsOrder)} lb`, amount: seedCost },
    { label: `Starter fertilizer — ${starterBags} bag${starterBags === 1 ? "" : "s"}`, amount: fertCost },
  ]
  if (isNew) {
    costs.push(
      {
        label: `Straw mulch — ${strawBales} bale${strawBales === 1 ? "" : "s"}`,
        amount: strawCost,
        note: "Holds moisture and stops seed washing away. One bale covers about 800 sq ft thinly.",
      },
      {
        label: `Compost top-dressing — ${n(topdressYd)} cu yd`,
        amount: topdressCost,
        note: 'A 1/4 in blanket of compost improves germination noticeably.',
      },
    )
  }
  const costTotal = costs.reduce((s, c) => s + c.amount, 0)

  return {
    project: "seed",
    area,
    perimeter: inputs.perimeter,
    headline: {
      value: `${n(lbsOrder)} lb`,
      label: `of ${variant.label.toLowerCase()} seed`,
      sub: `${bags} x ${SEED_BAG_LB} lb bag${bags === 1 ? "" : "s"} · ${isNew ? "new lawn" : "overseeding"} rate`,
    },
    metrics: [
      { label: "Area to seed", value: `${int(area)} sq ft` },
      {
        label: "Seeding rate",
        value: `${n(rate)} lb / 1,000 sq ft`,
        hint: isNew
          ? "Full rate for bare soil. Doubling it does not give a thicker lawn — seedlings just compete and thin out."
          : "Half rate over existing grass. The established lawn is already holding the space.",
      },
      {
        label: "Seed needed",
        value: `${n(lbsOrder)} lb`,
        hint: `${n(thousands)} thousand sq ft x ${n(rate)} lb, plus ${Math.round(waste * 100)}% overage.`,
        emphasis: true,
      },
      { label: "Bags", value: `${bags} x ${SEED_BAG_LB} lb`, hint: "Round up — leftover seed keeps a year if sealed and cool." },
    ],
    order: [
      { label: "Buy", value: `${bags} bag${bags === 1 ? "" : "s"} (${SEED_BAG_LB} lb each)`, emphasis: true },
      {
        label: "Best sowing window",
        value: isNew ? "Late summer to early fall" : "Early fall",
        hint: "Cool nights, warm soil and less weed pressure. Spring is a distant second.",
      },
    ],
    costs,
    costTotal,
    costNote: `Seed and amendments for ${region.stateName}. Hydroseeding a lawn this size typically runs $0.10-0.20 per sq ft installed.`,
    steps: [
      { label: "1. Measure the area", detail: `${int(area)} sq ft = ${n(thousands)} thousand sq ft.` },
      {
        label: "2. Look up the rate",
        detail: `${variant.label} at the ${isNew ? "new lawn" : "overseeding"} rate is ${n(rate)} lb per 1,000 sq ft.`,
      },
      { label: "3. Multiply", detail: `${n(thousands)} x ${n(rate)} = ${n(lbs)} lb of seed.` },
      {
        label: `4. Add ${Math.round(waste * 100)}% overage`,
        detail: `${n(lbs)} x ${(1 + waste).toFixed(2)} = ${n(lbsOrder)} lb, which is ${bags} bag${bags === 1 ? "" : "s"}.`,
      },
    ],
    tips: [
      variant.note,
      "Seed-to-soil contact matters more than quantity. Rake lightly so seed sits in the top 1/4 in, then roll or tamp.",
      "Keep the top inch damp for 2-3 weeks: short cycles several times a day beats one long soak.",
      "Skip weed-and-feed and pre-emergent herbicide for the first two mowings. Both stop grass seed from germinating.",
    ],
    region,
  }
}

// --- Pavers ----------------------------------------------------------------

function paverPlan(inputs: MaterialInputs, region: ResolvedRegion): MaterialPlan {
  const variant = PAVER_SIZES.find((v) => v.value === inputs.variant) ?? PAVER_SIZES[1]
  const use = PAVER_USES[inputs.paverUse]
  const area = inputs.area
  const waste = Math.max(0, inputs.wastePercent) / 100
  const withWaste = area * (1 + waste)
  const count = Math.ceil(withWaste / variant.sqft)

  const baseCuYd = (area * (use.baseIn / 12)) / 27
  const baseOrder = Math.max(0.5, Math.ceil(baseCuYd * 1.15 * 2) / 2)
  const baseTons = (baseOrder * 2800) / 2000
  const sandCuYd = (area * (BEDDING_SAND_IN / 12)) / 27
  const sandOrder = Math.max(0.5, Math.ceil(sandCuYd * 1.1 * 2) / 2)
  const jointBags = Math.ceil(area / JOINT_SAND_SQFT_PER_BAG)
  const edging = Math.ceil(inputs.perimeter || Math.sqrt(area) * 4)
  const fabric = Math.ceil(area * 1.1)

  const priceIndex = 0.4 + 0.6 * region.index
  const costs: CostLine[] = [
    { label: `${variant.label} — ${int(count)} pavers`, amount: withWaste * variant.pricePerSqft * priceIndex },
    {
      label: `Base gravel — ${n(baseOrder)} cu yd (${n(baseTons)} tons)`,
      amount: baseOrder * 55 * priceIndex + Math.ceil(baseOrder / 10) * 95,
      note: `${use.baseIn} in compacted for a ${inputs.paverUse}.`,
    },
    {
      label: `Bedding sand — ${n(sandOrder)} cu yd`,
      amount: sandOrder * 42 * priceIndex + 95,
      note: "1 in screeded, never compacted before laying.",
    },
    { label: `Polymeric joint sand — ${jointBags} bag${jointBags === 1 ? "" : "s"}`, amount: jointBags * 28 },
    { label: `Edge restraint — ${int(edging)} lin ft`, amount: edging * 2.6 },
    { label: `Geotextile fabric — ${int(fabric)} sq ft`, amount: fabric * 0.28 },
    { label: "Plate compactor rental (2 days)", amount: 180 },
  ]
  const costTotal = costs.reduce((s, c) => s + c.amount, 0)

  return {
    project: "pavers",
    area,
    perimeter: inputs.perimeter,
    headline: {
      value: `${int(count)} pavers`,
      label: `of ${variant.label.toLowerCase()}`,
      sub: `Plus ${n(baseOrder)} cu yd base and ${n(sandOrder)} cu yd bedding sand`,
    },
    metrics: [
      { label: "Paved area", value: `${int(area)} sq ft` },
      {
        label: "Pavers needed",
        value: `${int(count)} pieces`,
        hint: `${int(withWaste)} sq ft (with ${Math.round(waste * 100)}% cutting waste) / ${variant.sqft} sq ft per paver.`,
        emphasis: true,
      },
      {
        label: "Base gravel",
        value: `${n(baseOrder)} cu yd`,
        hint: `${use.baseIn} in compacted depth. ${use.note}`,
      },
      { label: "Base weight", value: `${n(baseTons)} tons`, hint: "Useful when the yard prices crushed stone by the ton." },
      { label: "Bedding sand", value: `${n(sandOrder)} cu yd`, hint: "A screeded 1 in layer directly under the pavers." },
      { label: "Joint sand", value: `${jointBags} bags`, hint: `Polymeric sand, about ${JOINT_SAND_SQFT_PER_BAG} sq ft per 50 lb bag.` },
      { label: "Edge restraint", value: `${int(edging)} lin ft`, hint: "Without it the outer courses creep and the field opens up." },
    ],
    order: [
      { label: "Pavers", value: `${int(count)} pieces`, emphasis: true },
      { label: "Excavation depth", value: `${n(use.baseIn + BEDDING_SAND_IN + 2.375)} in`, hint: "Base + bedding sand + paver thickness. Dig to this before anything goes in." },
      { label: "Spoil to haul away", value: `${n((area * ((use.baseIn + BEDDING_SAND_IN + 2.375) / 12)) / 27)} cu yd`, hint: "Excavated soil swells about 25% once loose." },
    ],
    costs,
    costTotal,
    costNote: `DIY material pricing for ${region.stateName}. Installed by a contractor, expect $14-28 per sq ft all in.`,
    steps: [
      { label: "1. Find the area", detail: `${int(area)} sq ft of finished surface.` },
      {
        label: `2. Add ${Math.round(waste * 100)}% cutting waste`,
        detail: `${int(area)} x ${(1 + waste).toFixed(2)} = ${int(withWaste)} sq ft. Diagonal or curved layouts waste more, so use 10-15%.`,
      },
      {
        label: "3. Divide by paver size",
        detail: `${int(withWaste)} / ${variant.sqft} sq ft = ${int(count)} pavers.`,
      },
      {
        label: "4. Size the base",
        detail: `${int(area)} sq ft x ${use.baseIn} in / 12 / 27 = ${n(baseCuYd)} cu yd, ordered as ${n(baseOrder)} cu yd with compaction allowance.`,
      },
      {
        label: "5. Size the bedding sand",
        detail: `${int(area)} sq ft x 1 in / 12 / 27 = ${n(sandCuYd)} cu yd.`,
      },
    ],
    tips: [
      "Compact the base in 2-3 in lifts, not all at once. A 6 in layer compacted in one pass stays loose underneath and the patio settles.",
      'Slope the surface away from the house at 1/8 to 1/4 in per foot. On a 12 ft patio that is 1.5-3 in of fall — build it in deliberately.',
      "Order 5-10% extra pavers from the same batch. Dye lots vary, and a repair years later will never match.",
      use.note,
    ],
    region,
  }
}

// --- Concrete --------------------------------------------------------------

function concretePlan(inputs: MaterialInputs, region: ResolvedRegion): MaterialPlan {
  const thickness = Math.max(1, inputs.depth)
  const area = inputs.area
  const waste = Math.max(0, inputs.wastePercent) / 100
  const cuFt = area * (thickness / 12)
  const cuYd = cuFt / 27
  const cuYdOrder = cuYd * (1 + waste)
  const bagSpec = CONCRETE_BAGS.find((b) => b.value === inputs.concreteBag) ?? CONCRETE_BAGS[0]
  const bags = Math.ceil((cuFt * (1 + waste)) / bagSpec.cuFt)
  const meshSheets = Math.ceil((area * 1.05) / MESH_SHEET_SQFT)
  const usingReady = inputs.concreteSupply === "ready"

  const priceIndex = 0.5 + 0.5 * region.index
  const readyYards = Math.max(0.5, Math.ceil(cuYdOrder * 4) / 4)
  const readyCost = readyYards * READY_MIX_PER_CUYD * priceIndex
  const shortLoad = readyYards < 3 ? SHORT_LOAD_FEE : 0

  const costs: CostLine[] = usingReady
    ? [
        { label: `Ready-mix concrete — ${n(readyYards)} cu yd`, amount: readyCost },
        ...(shortLoad
          ? [{ label: "Short load fee", amount: shortLoad, note: "Most plants surcharge orders under 3 cubic yards." }]
          : []),
        { label: `Wire mesh — ${meshSheets} sheet${meshSheets === 1 ? "" : "s"}`, amount: meshSheets * 12 },
        { label: "Form lumber & stakes", amount: Math.ceil(inputs.perimeter || Math.sqrt(area) * 4) * 2.4 },
      ]
    : [
        { label: `${bagSpec.label} concrete mix — ${int(bags)} bags`, amount: bags * bagSpec.price * priceIndex },
        { label: `Wire mesh — ${meshSheets} sheet${meshSheets === 1 ? "" : "s"}`, amount: meshSheets * 12 },
        { label: "Mixer rental (1 day)", amount: bags > 25 ? 85 : 0 },
        { label: "Form lumber & stakes", amount: Math.ceil(inputs.perimeter || Math.sqrt(area) * 4) * 2.4 },
      ]
  const costTotal = costs.reduce((s, c) => s + c.amount, 0)

  return {
    project: "concrete",
    area,
    perimeter: inputs.perimeter,
    headline: {
      value: usingReady ? `${n(readyYards)} cu yd` : `${int(bags)} bags`,
      label: usingReady ? "of ready-mix concrete" : `of ${bagSpec.label} mix`,
      sub: `${int(area)} sq ft slab at ${n(thickness)} in thick`,
    },
    metrics: [
      { label: "Slab area", value: `${int(area)} sq ft` },
      { label: "Thickness", value: `${n(thickness)} in`, hint: "4 in for patios and walkways, 5-6 in for driveways and anything carrying vehicles." },
      { label: "Volume", value: `${n(cuFt)} cu ft`, hint: "Area x thickness in feet." },
      {
        label: "Cubic yards",
        value: `${n(cuYdOrder)} cu yd`,
        hint: `Includes ${Math.round(waste * 100)}% for spillage and uneven subgrade.`,
        emphasis: true,
      },
      {
        label: "Bagged equivalent",
        value: `${int(bags)} x ${bagSpec.label}`,
        hint: `Each ${bagSpec.label} yields about ${bagSpec.cuFt} cu ft.`,
      },
      { label: "Wire mesh", value: `${meshSheets} sheets`, hint: "5 ft x 10 ft sheets. Keep it mid-slab on chairs, not lying on the ground." },
    ],
    order: [
      usingReady
        ? { label: "Order", value: `${n(readyYards)} cu yd delivered`, emphasis: true, hint: "Plants sell in 1/4 yard increments." }
        : { label: "Buy", value: `${int(bags)} bags`, emphasis: true, hint: `That is about ${int(bags * Number(bagSpec.value))} lb of mix — plan the vehicle accordingly.` },
      {
        label: "Crossover point",
        value: `${n(Math.ceil((3 * 27) / bagSpec.cuFt))} bags = 3 cu yd`,
        hint: "Past roughly 2 cubic yards, ready-mix is cheaper and far less work than mixing bags.",
      },
    ],
    costs,
    costTotal,
    costNote: `Material pricing for ${region.stateName}. A finished slab poured by a contractor typically runs $8-15 per sq ft.`,
    steps: [
      { label: "1. Find the area", detail: `${int(area)} sq ft.` },
      { label: "2. Convert thickness", detail: `${n(thickness)} in / 12 = ${(thickness / 12).toFixed(3)} ft.` },
      { label: "3. Multiply", detail: `${int(area)} x ${(thickness / 12).toFixed(3)} = ${n(cuFt)} cu ft.` },
      { label: "4. Divide by 27", detail: `${n(cuFt)} / 27 = ${n(cuYd)} cu yd.` },
      {
        label: `5. Add ${Math.round(waste * 100)}% waste`,
        detail: `${n(cuYd)} x ${(1 + waste).toFixed(2)} = ${n(cuYdOrder)} cu yd. Never order short — a cold joint mid-pour is permanent.`,
      },
    ],
    tips: [
      "Order slightly over. Running out mid-pour leaves a cold joint you cannot undo; a little extra becomes a splash pad or a post footing.",
      'Cut or tool control joints every 8-10 ft, no deeper than a quarter of the slab thickness. Concrete cracks — joints decide where.',
      "Pour onto a compacted, damp subgrade. Dry ground wicks water out of the mix and weakens the bottom of the slab.",
      "Keep it damp for the first week. Curing is a chemical reaction, not drying, and fast-dried concrete loses real strength.",
    ],
    region,
  }
}

// --- Planting beds ---------------------------------------------------------

function bedPlan(inputs: MaterialInputs, region: ResolvedRegion): MaterialPlan {
  const size = PLANT_SIZES.find((p) => p.value === inputs.plantSize) ?? PLANT_SIZES[1]
  const spacing = Math.max(0.5, inputs.plantSpacing || size.spacing)
  const area = inputs.area
  const mulchDepth = Math.max(0, inputs.depth)

  const squareCount = Math.ceil(area / (spacing * spacing))
  const triangularCount = Math.ceil(area / (spacing * spacing * 0.866))
  const mulchCuYd = (area * (mulchDepth / 12)) / 27
  const mulchOrder = Math.max(0.5, Math.ceil(mulchCuYd * 1.1 * 2) / 2)
  const amendCuYd = (area * (3 / 12)) / 27
  const amendOrder = Math.max(0.5, Math.ceil(amendCuYd * 2) / 2)
  const edging = Math.ceil(inputs.perimeter || Math.sqrt(area) * 4)
  const fabric = Math.ceil(area * 1.1)

  const priceIndex = 0.5 + 0.5 * region.index
  const costs: CostLine[] = [
    { label: `${size.label} — ${squareCount} plants`, amount: squareCount * size.price * priceIndex },
    {
      label: `Compost / soil amendment — ${n(amendOrder)} cu yd`,
      amount: amendOrder * 45 * priceIndex + 95,
      note: "3 in tilled into the top 6 in of existing soil.",
    },
    {
      label: `Mulch — ${n(mulchOrder)} cu yd`,
      amount: mulchOrder * 40 * priceIndex + 95,
      note: `${n(mulchDepth)} in over the finished bed.`,
    },
    { label: `Bed edging — ${int(edging)} lin ft`, amount: edging * 3.2 },
    { label: `Landscape fabric — ${int(fabric)} sq ft`, amount: fabric * 0.22, note: "Optional. Better under gravel than under mulch." },
  ]
  const costTotal = costs.reduce((s, c) => s + c.amount, 0)

  return {
    project: "beds",
    area,
    perimeter: inputs.perimeter,
    headline: {
      value: `${squareCount} plants`,
      label: `at ${n(spacing)} ft spacing`,
      sub: `Plus ${n(mulchOrder)} cu yd of mulch and ${n(amendOrder)} cu yd of compost`,
    },
    metrics: [
      { label: "Bed area", value: `${int(area)} sq ft` },
      {
        label: "Plants (square grid)",
        value: `${squareCount} plants`,
        hint: `${int(area)} sq ft / (${n(spacing)} ft x ${n(spacing)} ft).`,
        emphasis: true,
      },
      {
        label: "Plants (staggered grid)",
        value: `${triangularCount} plants`,
        hint: "Offsetting every other row fills space about 15% denser and reads more natural.",
      },
      { label: "Mulch", value: `${n(mulchOrder)} cu yd`, hint: `${n(mulchDepth)} in deep across the bed.` },
      { label: "Compost to till in", value: `${n(amendOrder)} cu yd`, hint: "3 in worked into the top 6 in. This is the single best thing you can do for a new bed." },
      { label: "Edging", value: `${int(edging)} lin ft`, hint: "Keeps mulch in and grass roots out." },
    ],
    order: [
      { label: "Plants", value: `${squareCount} at ${n(spacing)} ft on center`, emphasis: true },
      {
        label: "Spacing rule",
        value: `${n(spacing)} ft`,
        hint: "Space for the mature width on the tag, not the pot you're holding. Crowded beds need thinning in year three.",
      },
    ],
    costs,
    costTotal,
    costNote: `Material pricing for ${region.stateName}. Professional installation typically doubles the plant cost.`,
    steps: [
      { label: "1. Find the bed area", detail: `${int(area)} sq ft.` },
      {
        label: "2. Square the spacing",
        detail: `${n(spacing)} ft x ${n(spacing)} ft = ${n(spacing * spacing)} sq ft per plant.`,
      },
      {
        label: "3. Divide",
        detail: `${int(area)} / ${n(spacing * spacing)} = ${squareCount} plants on a square grid.`,
      },
      {
        label: "4. Add mulch volume",
        detail: `${int(area)} x ${n(mulchDepth)} in / 12 / 27 = ${n(mulchCuYd)} cu yd, ordered as ${n(mulchOrder)}.`,
      },
    ],
    tips: [
      size.note,
      "Plant in odd-numbered groups of the same species rather than one of everything. Repetition reads as design; variety reads as a collection.",
      "Dig the hole twice as wide as the pot but no deeper. The root flare must sit at or slightly above grade.",
      "Water deeply twice a week for the first season, not lightly every day. Deep watering drives roots down.",
    ],
    region,
  }
}

// --- Irrigation ------------------------------------------------------------

export type IrrigationInputs = {
  zip: string
  lawnArea: number
  bedArea: number
  source: WaterSource
  /** Measured GPM, or 0 to use the source default. */
  gpm: number
  head: string
  bedHead: string
  soil: SoilType
  /** Waterings per week. */
  frequency: number
  /** Override the regional weekly inches when the user knows better. */
  weeklyInchesOverride: number | null
  slope: boolean
}

export type Zone = {
  name: string
  area: number
  heads: number
  gpm: number
  runtimeMin: number
  gallonsPerRun: number
  precipRate: number
  cycles: number
}

export type IrrigationPlan = {
  region: ResolvedRegion
  weeklyInches: number
  isRegionFallback: boolean
  lawnArea: number
  bedArea: number
  availableGpm: number
  zones: Zone[]
  zoneCount: number
  gallonsPerWatering: number
  weeklyGallons: number
  monthlyGallons: number
  weeklyCost: number
  monthlyCost: number
  totalRuntimeMin: number
  inchesPerWatering: number
  metrics: Metric[]
  steps: Step[]
  tips: string[]
  warnings: string[]
}

/** Average residential water plus sewer cost per 1,000 gallons. */
const WATER_COST_PER_1000GAL = 11.5

export function planIrrigation(inputs: IrrigationInputs): IrrigationPlan {
  const state = resolveStateFromZip(inputs.zip)
  const region = resolveRegion(inputs.zip)
  const regionalInches = state ? WEEKLY_WATER[state.code] ?? NATIONAL_WEEKLY_WATER : NATIONAL_WEEKLY_WATER
  const weeklyInches = inputs.weeklyInchesOverride ?? regionalInches

  const lawnHead = HEAD_TYPES.find((h) => h.value === inputs.head) ?? HEAD_TYPES[0]
  const bedHead = HEAD_TYPES.find((h) => h.value === inputs.bedHead) ?? HEAD_TYPES[5]
  const availableGpm = inputs.gpm > 0 ? inputs.gpm : SOURCE_GPM[inputs.source]
  const frequency = Math.max(1, inputs.frequency)
  const inchesPerWatering = weeklyInches / frequency

  const zones: Zone[] = []
  const warnings: string[] = []

  function buildZones(label: string, area: number, head: HeadType, efficiency: number) {
    if (area <= 0) return
    // Head-to-head coverage: one head per radius-squared of area.
    const areaPerHead = head.radius > 0 ? head.radius ** 2 : 250
    const totalHeads = Math.max(1, Math.ceil(area / areaPerHead))
    // A zone can only run as many heads as the water supply will feed.
    const headsPerZone = Math.max(1, Math.floor(availableGpm / head.gpm))
    const zoneCount = Math.max(1, Math.ceil(totalHeads / headsPerZone))
    const headsEach = Math.ceil(totalHeads / zoneCount)
    const areaEach = area / zoneCount

    // Gross inches account for distribution losses.
    const grossInches = inchesPerWatering / efficiency
    const runtime = (grossInches / head.precipRate) * 60

    // Cycle-and-soak when the application rate outruns what the soil absorbs.
    const intake = SOIL_INTAKE[inputs.soil] * (inputs.slope ? 0.6 : 1)
    const needsCycles = head.precipRate > intake
    const maxMinutesPerCycle = needsCycles ? (SOIL_HOLD[inputs.soil] / head.precipRate) * 60 : runtime
    const cycles = needsCycles ? Math.max(1, Math.ceil(runtime / maxMinutesPerCycle)) : 1

    for (let i = 0; i < zoneCount; i += 1) {
      zones.push({
        name: zoneCount > 1 ? `${label} zone ${i + 1}` : label,
        area: areaEach,
        heads: headsEach,
        gpm: headsEach * head.gpm,
        runtimeMin: runtime,
        gallonsPerRun: (areaEach / 1000) * inchesPerWatering * GAL_PER_INCH_PER_1000 / efficiency,
        precipRate: head.precipRate,
        cycles,
      })
    }

    if (needsCycles) {
      warnings.push(
        `${label}: ${head.label.toLowerCase()} applies ${n(head.precipRate)} in/hr but ${SOIL_LABELS[inputs.soil].toLowerCase()} soil${
          inputs.slope ? " on a slope" : ""
        } only absorbs about ${n(intake)} in/hr. Split each watering into ${cycles} cycles with 30-60 minutes between them or you will get runoff.`,
      )
    }
  }

  // Sprinklers lose water to wind and overspray; drip is far more efficient.
  buildZones("Lawn", inputs.lawnArea, lawnHead, lawnHead.value === "drip" ? 0.9 : 0.7)
  buildZones("Beds", inputs.bedArea, bedHead, bedHead.value === "drip" ? 0.9 : 0.7)

  const gallonsPerWatering = zones.reduce((s, z) => s + z.gallonsPerRun, 0)
  const weeklyGallons = gallonsPerWatering * frequency
  const monthlyGallons = weeklyGallons * 4.33
  const totalRuntimeMin = zones.reduce((s, z) => s + z.runtimeMin, 0)

  const metrics: Metric[] = [
    {
      label: "Water needed",
      value: `${n(weeklyInches)} in / week`,
      hint: state
        ? `Peak-season need for ${region.stateName}. The "1 inch a week" rule is a national average.`
        : "National average. Enter a ZIP for a regional figure.",
      emphasis: true,
    },
    {
      label: "Per watering",
      value: `${n(inchesPerWatering)} in`,
      hint: `${n(weeklyInches)} in spread over ${frequency} watering${frequency === 1 ? "" : "s"} a week.`,
    },
    {
      label: "Zones needed",
      value: `${zones.length}`,
      hint: `Limited by ${n(availableGpm)} GPM of supply — each zone can only run as many heads as the water feeds.`,
    },
    {
      label: "Gallons per watering",
      value: `${int(gallonsPerWatering)} gal`,
      hint: "Across all zones, including distribution losses.",
    },
    {
      label: "Weekly water use",
      value: `${int(weeklyGallons)} gal`,
      hint: `About ${money((weeklyGallons / 1000) * WATER_COST_PER_1000GAL)} a week at average combined water and sewer rates.`,
    },
    {
      label: "Monthly water use",
      value: `${int(monthlyGallons)} gal`,
      hint: `Roughly ${money((monthlyGallons / 1000) * WATER_COST_PER_1000GAL)} a month during peak season.`,
    },
  ]

  const steps: Step[] = [
    {
      label: "1. Weekly water need",
      detail: `${region.stateName} needs about ${n(weeklyInches)} in per week in peak season, based on reference evapotranspiration.`,
    },
    {
      label: "2. Split by frequency",
      detail: `${n(weeklyInches)} in / ${frequency} watering${frequency === 1 ? "" : "s"} = ${n(inchesPerWatering)} in per watering.`,
    },
    {
      label: "3. Adjust for efficiency",
      detail: `Sprinklers lose water to wind and overspray, so gross application is ${n(inchesPerWatering / 0.7)} in for spray-type heads (70% efficient) and ${n(inchesPerWatering / 0.9)} in for drip (90%).`,
    },
    {
      label: "4. Divide by precipitation rate",
      detail: `${lawnHead.label} applies ${n(lawnHead.precipRate)} in/hr, so runtime = ${n(inchesPerWatering / 0.7)} / ${n(lawnHead.precipRate)} x 60 = ${int((inchesPerWatering / 0.7 / lawnHead.precipRate) * 60)} minutes.`,
    },
    {
      label: "5. Convert to gallons",
      detail: `1 in over 1,000 sq ft is ${GAL_PER_INCH_PER_1000} gallons, so ${int(inputs.lawnArea + inputs.bedArea)} sq ft x ${n(inchesPerWatering)} in = ${int(gallonsPerWatering)} gallons per watering.`,
    },
  ]

  const tips: string[] = [
    `Water deeply and infrequently. ${frequency <= 3 ? `${frequency} long sessions a week drives` : "Two or three long sessions a week drive"} roots down; daily sprinkles keep them shallow and make the lawn less drought tolerant.`,
    "Run zones between 4 and 8 a.m. Wind is lowest, evaporation is minimal, and leaves dry before nightfall, which limits disease.",
    "Check the math with a real measurement: set out a few straight-sided cans, run a zone 15 minutes, and measure the depth. That is your actual precipitation rate.",
    lawnHead.note,
  ]
  if (inputs.bedArea > 0 && bedHead.value !== "drip") {
    tips.push(
      "Beds are the best candidate for drip. Emitters at the root zone cut bed water use by roughly half and keep foliage dry.",
    )
  }
  if (weeklyInches > 1.5) {
    tips.push(
      `${region.stateName} is a high-demand climate. A smart controller with a local weather feed typically trims 20-30% off these numbers by skipping unnecessary cycles.`,
    )
  }
  if (inputs.slope) {
    tips.push(
      "On a slope, water migrates downhill through the soil. Run the uphill zone shorter than the downhill one and expect the bottom to stay wetter.",
    )
  }

  return {
    region,
    weeklyInches,
    isRegionFallback: !state,
    lawnArea: inputs.lawnArea,
    bedArea: inputs.bedArea,
    availableGpm,
    zones,
    zoneCount: zones.length,
    gallonsPerWatering,
    weeklyGallons,
    monthlyGallons,
    weeklyCost: (weeklyGallons / 1000) * WATER_COST_PER_1000GAL,
    monthlyCost: (monthlyGallons / 1000) * WATER_COST_PER_1000GAL,
    totalRuntimeMin,
    inchesPerWatering,
    metrics,
    steps,
    tips,
    warnings,
  }
}

// --- Entry point -----------------------------------------------------------

export function planMaterial(inputs: MaterialInputs): MaterialPlan {
  const region = resolveRegion(inputs.zip)
  if (BULK_PROJECTS.includes(inputs.project)) return bulkPlan(inputs, region)
  if (inputs.project === "sod") return sodPlan(inputs, region)
  if (inputs.project === "seed") return seedPlan(inputs, region)
  if (inputs.project === "pavers") return paverPlan(inputs, region)
  if (inputs.project === "concrete") return concretePlan(inputs, region)
  return bedPlan(inputs, region)
}

/** Default variant for each project so switching projects never lands on an empty select. */
export function defaultVariant(project: ProjectId): string {
  if (BULK_PROJECTS.includes(project)) {
    return MATERIALS[project as "gravel" | "mulch" | "topsoil" | "sand"][0].value
  }
  if (project === "sod") return SOD_TYPES[0].value
  if (project === "seed") return SEED_TYPES[0].value
  if (project === "pavers") return PAVER_SIZES[1].value
  return ""
}

/** Default depth (inches) for each project. */
export function defaultDepth(project: ProjectId): number {
  if (DEPTH_GUIDE[project]) return DEPTH_GUIDE[project].depth
  if (project === "concrete") return 4
  if (project === "beds") return 3
  return 3
}

/** Default waste percentage — cutting waste varies a lot by project. */
export function defaultWaste(project: ProjectId): number {
  if (project === "sod") return 5
  if (project === "pavers") return 10
  if (project === "seed") return 5
  if (project === "concrete") return 10
  return 10
}

export { CONCRETE_BAGS, GAL_PER_INCH_PER_1000, SOD_ROLL_SQFT, SEED_BAG_LB }
