// Pure, dependency-free landscape cost estimation engine.
//
// Design goal: material QUANTITY math (cubic yards, sod pallets, plant counts,
// irrigation zones) and PRICING live in the same model, so every component the
// homeowner selects feeds one combined project estimate instead of behaving
// like a disconnected mini-calculator.
//
// Every figure is an ESTIMATE built from the documented baseline rates below.
// Real bids vary by contractor, access, season, and site conditions.

import { resolveStateFromZip } from "@/lib/zip"

// --- Shared types ----------------------------------------------------------

export type Quality = "basic" | "mid" | "premium"
export type Mode = "pro" | "diy"
export type Scope = "front" | "back" | "side" | "whole"

export type ComponentId =
  | "sod"
  | "seed"
  | "mulch"
  | "topsoil"
  | "gravel"
  | "trees"
  | "shrubs"
  | "flowers"
  | "patio"
  | "walkway"
  | "pavers"
  | "wall"
  | "fence"
  | "irrigation"
  | "drainage"
  | "lighting"
  | "grading"
  | "firepit"
  | "removal"

export type GroupId = "lawn" | "beds" | "plants" | "hardscape" | "systems" | "site"

export const GROUP_LABELS: Record<GroupId, string> = {
  lawn: "Lawn & ground cover",
  beds: "Beds & bulk materials",
  plants: "Trees & plants",
  hardscape: "Hardscape & structures",
  systems: "Systems",
  site: "Site work & outdoor living",
}

/** Every numeric field a component might use. Components declare which apply. */
export type NumericKey = "area" | "length" | "width" | "height" | "depth" | "count"

export type ComponentState = {
  enabled: boolean
  area: number
  length: number
  width: number
  height: number
  depth: number
  count: number
  option: string
}

export type OptionSpec = { value: string; label: string }

export type FieldSpec = {
  key: NumericKey
  label: string
  unit: string
  step?: number
  hint?: string
}

export type Quantity = { label: string; value: string }

/** DIY suitability, surfaced so the tool can warn instead of just quoting. */
export type DiyFit = "yes" | "partial" | "no"

export type RawCost = {
  quantities: Quantity[]
  materials: number
  labor: number
  equipment: number
  delivery: number
  removal: number
  /** Equipment rental a DIYer would pay instead of contractor equipment. */
  diyEquipment?: number
}

export type ComponentDef = {
  id: ComponentId
  label: string
  group: GroupId
  /** Short plain-English description of what the line covers. */
  blurb: string
  fields: FieldSpec[]
  options?: { label: string; choices: OptionSpec[] }
  defaults: Partial<ComponentState>
  /** Share of total yard area used when auto-filling from yard size. */
  autofillShare?: number
  diy: DiyFit
  diyNote?: string
  calc: (s: ComponentState) => RawCost
}

export type LineItem = {
  id: ComponentId
  label: string
  quantities: Quantity[]
  materials: number
  labor: number
  equipment: number
  delivery: number
  removal: number
  total: number
  diy: DiyFit
  diyNote?: string
}

export type ResolvedRegion = {
  stateCode: string
  stateName: string
  /** Cost index where 1.0 is the national average. */
  index: number
  isFallback: boolean
}

export type LandscapeInputs = {
  zip: string
  yardArea: number
  scope: Scope
  quality: Quality
  mode: Mode
  contingencyPercent: number
  components: Record<ComponentId, ComponentState>
}

export type Bucket = {
  key: "materials" | "labor" | "equipment" | "delivery" | "removal" | "contingency"
  label: string
  amount: number
}

export type Driver = { label: string; amount: number; share: number }

export type Saving = { title: string; detail: string; savesAbout: number | null }

export type LandscapeResult = {
  region: ResolvedRegion
  lines: LineItem[]
  buckets: Bucket[]
  subtotal: number
  contingency: number
  total: number
  low: number
  high: number
  perSqft: number | null
  drivers: Driver[]
  savings: Saving[]
  /** True when nothing is selected yet. */
  isEmpty: boolean
}

// --- Regional cost index ---------------------------------------------------
// Reflects prevailing landscape labor and delivered material costs relative to
// the national average. Labor is far more regional than materials, so the two
// are weighted differently when the index is applied.

const REGION_INDEX: Record<string, number> = {
  AL: 0.88, AK: 1.35, AZ: 1.02, AR: 0.86, CA: 1.32, CO: 1.12, CT: 1.22,
  DE: 1.05, DC: 1.3, FL: 1.0, GA: 0.95, HI: 1.42, ID: 0.98, IL: 1.12,
  IN: 0.93, IA: 0.92, KS: 0.9, KY: 0.9, LA: 0.9, ME: 1.05, MD: 1.15,
  MA: 1.28, MI: 0.95, MN: 1.08, MS: 0.85, MO: 0.92, MT: 0.95, NE: 0.9,
  NV: 1.08, NH: 1.1, NJ: 1.22, NM: 0.92, NY: 1.35, NC: 0.95, ND: 0.9,
  OH: 0.95, OK: 0.88, OR: 1.14, PA: 1.02, PR: 0.8, RI: 1.15, SC: 0.93,
  SD: 0.88, TN: 0.92, TX: 0.97, UT: 1.0, VT: 1.08, VA: 1.06, WA: 1.2,
  WV: 0.88, WI: 1.0, WY: 0.92,
}

const NATIONAL_REGION: ResolvedRegion = {
  stateCode: "US",
  stateName: "national average",
  index: 1,
  isFallback: true,
}

export function resolveRegion(zip: string): ResolvedRegion {
  const state = resolveStateFromZip(zip)
  if (!state) return NATIONAL_REGION
  const index = REGION_INDEX[state.code]
  if (!index) return NATIONAL_REGION
  return { stateCode: state.code, stateName: state.name, index, isFallback: false }
}

// --- Quality tiers ---------------------------------------------------------
// Quality mostly changes what you buy (materials); it changes labor less,
// because installing a better paver takes somewhat—not proportionally—longer.

const QUALITY_MATERIAL: Record<Quality, number> = { basic: 0.78, mid: 1, premium: 1.55 }
const QUALITY_LABOR: Record<Quality, number> = { basic: 0.9, mid: 1, premium: 1.22 }

export const QUALITY_LABELS: Record<Quality, string> = {
  basic: "Basic",
  mid: "Mid-range",
  premium: "Premium",
}

export const SCOPE_LABELS: Record<Scope, string> = {
  front: "Front yard",
  back: "Backyard",
  side: "Side yard",
  whole: "Whole property",
}

/** Typical share of a lot that each scope represents, used for size presets. */
export const SCOPE_SHARE: Record<Scope, number> = {
  front: 0.3,
  back: 0.55,
  side: 0.15,
  whole: 1,
}

// --- Small math helpers ----------------------------------------------------

const round = (n: number) => Math.round(n)
const cuYd = (areaSqft: number, depthIn: number) => (areaSqft * (depthIn / 12)) / 27
/** Bulk material arrives by truck; most yards charge per load. */
const bulkDelivery = (yards: number) => (yards <= 0 ? 0 : Math.ceil(yards / 10) * 95)
const qty = (label: string, value: string): Quantity => ({ label, value })
const n1 = (v: number) => (Math.round(v * 10) / 10).toLocaleString("en-US")
const int = (v: number) => Math.round(v).toLocaleString("en-US")

// --- Component catalogue ---------------------------------------------------
// Baseline rates are mid-quality, national-average, professionally installed
// unless noted. The engine applies quality, region, and DIY adjustments.

export const COMPONENTS: ComponentDef[] = [
  {
    id: "sod",
    label: "Lawn / sod",
    group: "lawn",
    blurb: "Rolled turf for instant lawn, including bed prep.",
    fields: [{ key: "area", label: "Area to sod", unit: "sq ft", step: 50 }],
    defaults: { area: 1500 },
    autofillShare: 0.45,
    diy: "yes",
    diyNote: "Very DIY-friendly, but sod is perishable and heavy.",
    calc: (s) => {
      const area = Math.max(0, s.area)
      const withWaste = area * 1.07
      const pallets = area > 0 ? Math.ceil(withWaste / 450) : 0
      return {
        quantities: [
          qty("Lawn area", `${int(area)} sq ft`),
          qty("Sod to order", `${int(withWaste)} sq ft (incl. 7% trim waste)`),
          qty("Pallets", `${pallets} (450 sq ft each)`),
        ],
        materials: withWaste * 0.45,
        labor: area * 0.95,
        equipment: 0,
        delivery: pallets * 45,
        removal: 0,
        diyEquipment: area > 0 ? 95 : 0,
      }
    },
  },
  {
    id: "seed",
    label: "Grass seed",
    group: "lawn",
    blurb: "Seeded or hydroseeded lawn. Cheaper than sod, slower to establish.",
    fields: [{ key: "area", label: "Area to seed", unit: "sq ft", step: 50 }],
    defaults: { area: 2000 },
    autofillShare: 0.45,
    diy: "yes",
    calc: (s) => {
      const area = Math.max(0, s.area)
      const lbs = area / 250
      return {
        quantities: [
          qty("Seed needed", `${n1(lbs)} lb`),
          qty("Coverage", `${int(area)} sq ft`),
        ],
        materials: area * 0.09,
        labor: area * 0.14,
        equipment: 0,
        delivery: 0,
        removal: 0,
        diyEquipment: area > 0 ? 75 : 0,
      }
    },
  },
  {
    id: "mulch",
    label: "Mulch beds",
    group: "beds",
    blurb: "Bark or wood mulch spread over planting beds.",
    fields: [
      { key: "area", label: "Bed area", unit: "sq ft", step: 25 },
      { key: "depth", label: "Depth", unit: "in", step: 0.5, hint: "3 in is standard." },
    ],
    defaults: { area: 600, depth: 3 },
    autofillShare: 0.12,
    diy: "yes",
    calc: (s) => {
      const yards = cuYd(Math.max(0, s.area), Math.max(0, s.depth)) * 1.1
      return {
        quantities: [
          qty("Mulch needed", `${n1(yards)} cu yd`),
          qty("Bagged equivalent", `${int(yards * 13.5)} bags (2 cu ft)`),
        ],
        materials: yards * 45,
        labor: yards * 55,
        equipment: 0,
        delivery: bulkDelivery(yards),
        removal: 0,
      }
    },
  },
  {
    id: "topsoil",
    label: "Topsoil",
    group: "beds",
    blurb: "Screened soil to build beds or correct thin, poor ground.",
    fields: [
      { key: "area", label: "Area to cover", unit: "sq ft", step: 25 },
      { key: "depth", label: "Depth", unit: "in", step: 0.5 },
    ],
    defaults: { area: 800, depth: 4 },
    diy: "yes",
    calc: (s) => {
      const yards = cuYd(Math.max(0, s.area), Math.max(0, s.depth)) * 1.08
      return {
        quantities: [
          qty("Topsoil needed", `${n1(yards)} cu yd`),
          qty("Approx. weight", `${n1(yards * 1.1)} tons`),
        ],
        materials: yards * 42,
        labor: yards * 48,
        equipment: 0,
        delivery: bulkDelivery(yards),
        removal: 0,
      }
    },
  },
  {
    id: "gravel",
    label: "Gravel / decorative rock",
    group: "beds",
    blurb: "Crushed stone or river rock for beds, paths, and dry areas.",
    fields: [
      { key: "area", label: "Area to cover", unit: "sq ft", step: 25 },
      { key: "depth", label: "Depth", unit: "in", step: 0.5 },
    ],
    defaults: { area: 400, depth: 3 },
    diy: "yes",
    calc: (s) => {
      const yards = cuYd(Math.max(0, s.area), Math.max(0, s.depth)) * 1.05
      return {
        quantities: [
          qty("Gravel needed", `${n1(yards)} cu yd`),
          qty("Approx. weight", `${n1(yards * 1.4)} tons`),
        ],
        materials: yards * 58,
        labor: yards * 62,
        equipment: 0,
        delivery: bulkDelivery(yards),
        removal: 0,
      }
    },
  },
  {
    id: "trees",
    label: "Trees",
    group: "plants",
    blurb: "Nursery trees, planted and staked.",
    fields: [{ key: "count", label: "How many trees", unit: "trees", step: 1 }],
    options: {
      label: "Tree size",
      choices: [
        { value: "small", label: "Small (5–8 ft)" },
        { value: "medium", label: "Medium (8–12 ft)" },
        { value: "large", label: "Large (12 ft+)" },
      ],
    },
    defaults: { count: 3, option: "medium" },
    diy: "partial",
    diyNote: "Small trees are manageable; large balled stock needs equipment.",
    calc: (s) => {
      const count = Math.max(0, Math.round(s.count))
      const unit = s.option === "small" ? 165 : s.option === "large" ? 850 : 385
      const labor = s.option === "small" ? 70 : s.option === "large" ? 340 : 155
      return {
        quantities: [
          qty("Trees", `${count}`),
          qty("Avg. cost each", `$${int(unit + labor)} installed`),
        ],
        materials: count * unit,
        labor: count * labor,
        equipment: s.option === "large" ? count * 60 : 0,
        delivery: count > 0 ? 85 : 0,
        removal: 0,
      }
    },
  },
  {
    id: "shrubs",
    label: "Shrubs & plants",
    group: "plants",
    blurb: "Foundation shrubs, grasses, and perennials in containers.",
    fields: [{ key: "count", label: "How many plants", unit: "plants", step: 1 }],
    options: {
      label: "Container size",
      choices: [
        { value: "1gal", label: "1 gallon" },
        { value: "3gal", label: "3 gallon" },
        { value: "5gal", label: "5 gallon" },
      ],
    },
    defaults: { count: 15, option: "3gal" },
    diy: "yes",
    calc: (s) => {
      const count = Math.max(0, Math.round(s.count))
      const unit = s.option === "1gal" ? 18 : s.option === "5gal" ? 78 : 42
      const labor = s.option === "1gal" ? 22 : s.option === "5gal" ? 62 : 38
      return {
        quantities: [
          qty("Plants", `${count}`),
          qty("Avg. cost each", `$${int(unit + labor)} installed`),
        ],
        materials: count * unit,
        labor: count * labor,
        equipment: 0,
        delivery: count > 0 ? 55 : 0,
        removal: 0,
      }
    },
  },
  {
    id: "flowers",
    label: "Flower beds",
    group: "plants",
    blurb: "Annual or perennial beds including soil amendment and edging.",
    fields: [{ key: "area", label: "Bed area", unit: "sq ft", step: 10 }],
    defaults: { area: 200 },
    diy: "yes",
    calc: (s) => {
      const area = Math.max(0, s.area)
      return {
        quantities: [
          qty("Bed area", `${int(area)} sq ft`),
          qty("Plants (approx.)", `${int(area * 0.9)} at 1 per sq ft`),
        ],
        materials: area * 5.5,
        labor: area * 6.5,
        equipment: 0,
        delivery: 0,
        removal: 0,
      }
    },
  },
  {
    id: "patio",
    label: "Patio",
    group: "hardscape",
    blurb: "Outdoor living surface on a compacted, drained base.",
    fields: [{ key: "area", label: "Patio area", unit: "sq ft", step: 10 }],
    options: {
      label: "Surface",
      choices: [
        { value: "concrete", label: "Poured concrete" },
        { value: "stamped", label: "Stamped concrete" },
        { value: "paver", label: "Pavers" },
        { value: "flagstone", label: "Natural flagstone" },
      ],
    },
    defaults: { area: 300, option: "paver" },
    autofillShare: 0.08,
    diy: "partial",
    diyNote: "Base prep is the hard part; a failed base ruins the surface.",
    calc: (s) => {
      const area = Math.max(0, s.area)
      const rates: Record<string, [number, number]> = {
        concrete: [7, 6.5],
        stamped: [9, 11],
        paver: [11, 13],
        flagstone: [16, 16],
      }
      const [mat, lab] = rates[s.option] ?? rates.paver
      const baseYards = cuYd(area, 5)
      return {
        quantities: [
          qty("Surface area", `${int(area)} sq ft`),
          qty("Base gravel", `${n1(baseYards)} cu yd`),
        ],
        materials: area * mat,
        labor: area * lab,
        equipment: area > 0 ? 180 : 0,
        delivery: bulkDelivery(baseYards),
        removal: 0,
        diyEquipment: area > 0 ? 260 : 0,
      }
    },
  },
  {
    id: "walkway",
    label: "Walkway",
    group: "hardscape",
    blurb: "Path from drive to door or through the yard.",
    fields: [
      { key: "length", label: "Length", unit: "ft", step: 1 },
      { key: "width", label: "Width", unit: "ft", step: 0.5, hint: "3–4 ft is typical." },
    ],
    options: {
      label: "Surface",
      choices: [
        { value: "concrete", label: "Poured concrete" },
        { value: "paver", label: "Pavers" },
        { value: "flagstone", label: "Natural flagstone" },
        { value: "gravel", label: "Gravel" },
      ],
    },
    defaults: { length: 40, width: 3.5, option: "paver" },
    diy: "partial",
    calc: (s) => {
      const area = Math.max(0, s.length) * Math.max(0, s.width)
      const rates: Record<string, [number, number]> = {
        concrete: [7.5, 7.5],
        paver: [12, 15],
        flagstone: [17, 18],
        gravel: [3, 4],
      }
      const [mat, lab] = rates[s.option] ?? rates.paver
      return {
        quantities: [
          qty("Path area", `${int(area)} sq ft`),
          qty("Linear feet", `${int(Math.max(0, s.length))} ft`),
        ],
        materials: area * mat,
        labor: area * lab,
        equipment: area > 0 ? 120 : 0,
        delivery: area > 0 ? 95 : 0,
        removal: 0,
      }
    },
  },
  {
    id: "pavers",
    label: "Extra paved area / driveway",
    group: "hardscape",
    blurb: "Additional paved surface such as a parking pad or driveway apron.",
    fields: [{ key: "area", label: "Area", unit: "sq ft", step: 10 }],
    defaults: { area: 400 },
    diy: "no",
    diyNote: "Driveway-grade base and edge restraint are contractor work.",
    calc: (s) => {
      const area = Math.max(0, s.area)
      const baseYards = cuYd(area, 8)
      return {
        quantities: [
          qty("Paved area", `${int(area)} sq ft`),
          qty("Base gravel", `${n1(baseYards)} cu yd`),
        ],
        materials: area * 11,
        labor: area * 14,
        equipment: area > 0 ? 320 : 0,
        delivery: bulkDelivery(baseYards),
        removal: 0,
      }
    },
  },
  {
    id: "wall",
    label: "Retaining wall",
    group: "hardscape",
    blurb: "Holds back a grade change. Priced by the square foot of wall face.",
    fields: [
      { key: "length", label: "Wall length", unit: "ft", step: 1 },
      { key: "height", label: "Wall height", unit: "ft", step: 0.5 },
    ],
    options: {
      label: "Material",
      choices: [
        { value: "block", label: "Segmental block" },
        { value: "stone", label: "Natural stone" },
        { value: "poured", label: "Poured concrete" },
        { value: "timber", label: "Timber" },
      ],
    },
    defaults: { length: 30, height: 3, option: "block" },
    diy: "no",
    diyNote: "Walls over 3–4 ft usually need engineering and a permit.",
    calc: (s) => {
      const face = Math.max(0, s.length) * Math.max(0, s.height)
      const rates: Record<string, [number, number]> = {
        block: [18, 26],
        stone: [30, 42],
        poured: [16, 30],
        timber: [11, 18],
      }
      const [mat, lab] = rates[s.option] ?? rates.block
      const drainYards = cuYd(Math.max(0, s.length) * 1.5, 12)
      const tall = Math.max(0, s.height) > 4
      return {
        quantities: [
          qty("Wall face area", `${int(face)} sq ft`),
          qty("Drainage stone", `${n1(drainYards)} cu yd`),
          ...(tall ? [qty("Engineering", "Likely required over 4 ft")] : []),
        ],
        materials: face * mat,
        labor: face * lab,
        equipment: face > 0 ? 420 : 0,
        delivery: bulkDelivery(drainYards) + (face > 0 ? 120 : 0),
        removal: 0,
      }
    },
  },
  {
    id: "fence",
    label: "Fence",
    group: "hardscape",
    blurb: "Perimeter or privacy fencing, priced per linear foot.",
    fields: [
      { key: "length", label: "Fence length", unit: "ft", step: 1 },
      { key: "height", label: "Height", unit: "ft", step: 0.5 },
    ],
    options: {
      label: "Material",
      choices: [
        { value: "chainlink", label: "Chain link" },
        { value: "wood", label: "Wood privacy" },
        { value: "vinyl", label: "Vinyl" },
        { value: "aluminum", label: "Aluminum / steel" },
        { value: "composite", label: "Composite" },
      ],
    },
    defaults: { length: 150, height: 6, option: "wood" },
    diy: "partial",
    calc: (s) => {
      const len = Math.max(0, s.length)
      const rates: Record<string, [number, number]> = {
        chainlink: [9, 9],
        wood: [16, 16],
        vinyl: [24, 18],
        aluminum: [28, 20],
        composite: [34, 22],
      }
      const [mat, lab] = rates[s.option] ?? rates.wood
      // Height scales material more than labor (posts/rails stay the same count).
      const hFactor = Math.max(0.6, Math.max(0, s.height) / 6)
      const posts = len > 0 ? Math.ceil(len / 8) + 1 : 0
      return {
        quantities: [
          qty("Fence length", `${int(len)} linear ft`),
          qty("Posts", `${posts} at 8 ft spacing`),
        ],
        materials: len * mat * hFactor,
        labor: len * lab * (0.8 + 0.2 * hFactor),
        equipment: len > 0 ? 140 : 0,
        delivery: len > 0 ? 165 : 0,
        removal: 0,
        diyEquipment: len > 0 ? 220 : 0,
      }
    },
  },
  {
    id: "irrigation",
    label: "Irrigation / sprinklers",
    group: "systems",
    blurb: "Zoned automatic watering with controller and backflow.",
    fields: [{ key: "area", label: "Area to irrigate", unit: "sq ft", step: 50 }],
    defaults: { area: 3000 },
    autofillShare: 0.6,
    diy: "no",
    diyNote: "Backflow prevention and water tie-in are usually permitted work.",
    calc: (s) => {
      const area = Math.max(0, s.area)
      const zones = area > 0 ? Math.max(1, Math.ceil(area / 2000)) : 0
      const heads = area > 0 ? Math.ceil(area / 200) : 0
      return {
        quantities: [
          qty("Zones", `${zones}`),
          qty("Heads (approx.)", `${heads}`),
          qty("Controller", zones > 0 ? "1 smart timer" : "—"),
        ],
        materials: area * 0.28 + (zones > 0 ? 320 : 0),
        labor: area * 0.52,
        equipment: area > 0 ? 240 : 0,
        delivery: 0,
        removal: 0,
      }
    },
  },
  {
    id: "drainage",
    label: "Drainage",
    group: "systems",
    blurb: "French drain, catch basins, or downspout runs to move water away.",
    fields: [{ key: "length", label: "Drain run length", unit: "ft", step: 5 }],
    defaults: { length: 60 },
    diy: "partial",
    diyNote: "Getting the fall right matters more than the digging.",
    calc: (s) => {
      const len = Math.max(0, s.length)
      const stoneYards = cuYd(len * 1.5, 12)
      return {
        quantities: [
          qty("Drain length", `${int(len)} linear ft`),
          qty("Drain stone", `${n1(stoneYards)} cu yd`),
          qty("Catch basins", `${len > 0 ? Math.max(1, Math.round(len / 40)) : 0}`),
        ],
        materials: len * 12,
        labor: len * 33,
        equipment: len > 0 ? 380 : 0,
        delivery: bulkDelivery(stoneYards),
        removal: len > 0 ? len * 2.5 : 0,
        diyEquipment: len > 0 ? 340 : 0,
      }
    },
  },
  {
    id: "lighting",
    label: "Landscape lighting",
    group: "systems",
    blurb: "Low-voltage path and accent lighting with transformer.",
    fields: [{ key: "count", label: "Fixtures", unit: "fixtures", step: 1 }],
    defaults: { count: 10 },
    diy: "partial",
    calc: (s) => {
      const count = Math.max(0, Math.round(s.count))
      return {
        quantities: [
          qty("Fixtures", `${count}`),
          qty("Transformer", count > 0 ? `1 (${count <= 8 ? "150" : "300"} W)` : "—"),
        ],
        materials: count * 95 + (count > 0 ? 260 : 0),
        labor: count * 105,
        equipment: 0,
        delivery: 0,
        removal: 0,
      }
    },
  },
  {
    id: "grading",
    label: "Grading & leveling",
    group: "site",
    blurb: "Reshaping the ground for drainage or a usable flat area.",
    fields: [{ key: "area", label: "Area to grade", unit: "sq ft", step: 100 }],
    defaults: { area: 2000 },
    diy: "no",
    diyNote: "Needs a skid steer and an eye for slope. Mistakes cause flooding.",
    calc: (s) => {
      const area = Math.max(0, s.area)
      const fillYards = cuYd(area, 2)
      return {
        quantities: [
          qty("Area graded", `${int(area)} sq ft`),
          qty("Fill / cut", `${n1(fillYards)} cu yd`),
        ],
        materials: area * 0.35,
        labor: area * 0.85,
        equipment: area * 0.45,
        delivery: bulkDelivery(fillYards),
        removal: 0,
        diyEquipment: area > 0 ? 750 : 0,
      }
    },
  },
  {
    id: "firepit",
    label: "Fire pit / outdoor living",
    group: "site",
    blurb: "Gathering feature, from a simple ring to a built kitchen.",
    fields: [],
    options: {
      label: "Feature",
      choices: [
        { value: "prefab", label: "Prefab fire pit" },
        { value: "stone", label: "Built stone fire pit" },
        { value: "gas", label: "Gas fire feature" },
        { value: "kitchen", label: "Outdoor kitchen" },
      ],
    },
    defaults: { option: "stone" },
    diy: "partial",
    calc: (s) => {
      const rates: Record<string, [number, number]> = {
        prefab: [650, 250],
        stone: [1900, 1400],
        gas: [2600, 1500],
        kitchen: [6500, 4200],
      }
      const [mat, lab] = rates[s.option] ?? rates.stone
      return {
        quantities: [qty("Feature", s.option === "kitchen" ? "Outdoor kitchen" : "1 fire feature")],
        materials: mat,
        labor: lab,
        equipment: s.option === "kitchen" ? 400 : 120,
        delivery: 150,
        removal: 0,
      }
    },
  },
  {
    id: "removal",
    label: "Removal & cleanup",
    group: "site",
    blurb: "Tearing out old lawn, shrubs, or hardscape and hauling debris.",
    fields: [{ key: "area", label: "Area to clear", unit: "sq ft", step: 50 }],
    defaults: { area: 1000 },
    diy: "partial",
    calc: (s) => {
      const area = Math.max(0, s.area)
      const dumpsters = area > 0 ? Math.max(1, Math.ceil(area / 1200)) : 0
      return {
        quantities: [
          qty("Area cleared", `${int(area)} sq ft`),
          qty("Dumpsters", `${dumpsters} (10 cu yd)`),
        ],
        materials: 0,
        labor: area * 1.35,
        equipment: area * 0.35,
        delivery: 0,
        removal: dumpsters * 520,
        diyEquipment: area > 0 ? 280 : 0,
      }
    },
  },
]

export const COMPONENT_BY_ID: Record<ComponentId, ComponentDef> = COMPONENTS.reduce(
  (acc, def) => {
    acc[def.id] = def
    return acc
  },
  {} as Record<ComponentId, ComponentDef>,
)

/** Build a fresh state map with every component off and sensible defaults. */
export function initialComponents(): Record<ComponentId, ComponentState> {
  const out = {} as Record<ComponentId, ComponentState>
  for (const def of COMPONENTS) {
    out[def.id] = {
      enabled: false,
      area: 0,
      length: 0,
      width: 0,
      height: 0,
      depth: 0,
      count: 0,
      option: def.options?.choices[0]?.value ?? "",
      ...def.defaults,
    }
  }
  return out
}

export const DEFAULT_CONTINGENCY = 10

// --- Estimation ------------------------------------------------------------

export function estimate(inputs: LandscapeInputs): LandscapeResult {
  const region = resolveRegion(inputs.zip)
  const qMat = QUALITY_MATERIAL[inputs.quality]
  const qLab = QUALITY_LABOR[inputs.quality]
  // Materials are commodities and travel; labor is local. Weight accordingly.
  const matIndex = 1 + (region.index - 1) * 0.35
  const labIndex = region.index
  const isDiy = inputs.mode === "diy"

  const lines: LineItem[] = []

  for (const def of COMPONENTS) {
    const state = inputs.components[def.id]
    if (!state?.enabled) continue
    const raw = def.calc(state)

    const materials = raw.materials * qMat * matIndex
    const labor = isDiy ? 0 : raw.labor * qLab * labIndex
    const equipment = isDiy
      ? (raw.diyEquipment ?? raw.equipment) * matIndex
      : raw.equipment * labIndex
    const delivery = raw.delivery * matIndex
    const removal = isDiy ? raw.removal * 0.75 * matIndex : raw.removal * labIndex

    const total = materials + labor + equipment + delivery + removal
    if (total <= 0) continue

    lines.push({
      id: def.id,
      label: def.label,
      quantities: raw.quantities,
      materials,
      labor,
      equipment,
      delivery,
      removal,
      total,
      diy: def.diy,
      diyNote: def.diyNote,
    })
  }

  const sum = (pick: (l: LineItem) => number) => lines.reduce((a, l) => a + pick(l), 0)

  const materials = sum((l) => l.materials)
  const labor = sum((l) => l.labor)
  const equipment = sum((l) => l.equipment)
  const delivery = sum((l) => l.delivery)
  const removal = sum((l) => l.removal)
  const subtotal = materials + labor + equipment + delivery + removal
  const contingency = subtotal * (Math.max(0, inputs.contingencyPercent) / 100)
  const total = subtotal + contingency

  const allBuckets: Bucket[] = [
    { key: "materials", label: "Materials", amount: materials },
    { key: "labor", label: "Labor", amount: labor },
    { key: "equipment", label: "Equipment", amount: equipment },
    { key: "delivery", label: "Delivery", amount: delivery },
    { key: "removal", label: "Removal & disposal", amount: removal },
    { key: "contingency", label: "Contingency", amount: contingency },
  ]
  const buckets = allBuckets.filter((b) => b.amount > 0.5)

  // Site-unknown work (what's under the ground) widens the upper bound.
  const hasSiteRisk = lines.some((l) => l.id === "grading" || l.id === "wall" || l.id === "drainage")
  const low = total * 0.85
  const high = total * (hasSiteRisk ? 1.3 : 1.18)

  const drivers: Driver[] = lines
    .slice()
    .sort((a, b) => b.total - a.total)
    .slice(0, 4)
    .map((l) => ({
      label: l.label,
      amount: l.total,
      share: total > 0 ? l.total / total : 0,
    }))

  return {
    region,
    lines,
    buckets,
    subtotal,
    contingency,
    total,
    low,
    high,
    perSqft: inputs.yardArea > 0 && total > 0 ? total / inputs.yardArea : null,
    drivers,
    savings: buildSavings(lines, inputs, total, labor),
    isEmpty: lines.length === 0,
  }
}

// --- "Ways to reduce cost" -------------------------------------------------
// Every suggestion is derived from what the homeowner actually selected, and
// quantifies the saving where the math supports it.

function buildSavings(
  lines: LineItem[],
  inputs: LandscapeInputs,
  total: number,
  labor: number,
): Saving[] {
  const out: Saving[] = []
  const byId = new Map(lines.map((l) => [l.id, l]))

  const sod = byId.get("sod")
  if (sod) {
    // Same area seeded instead of sodded, at installed rates.
    const area = inputs.components.sod.area
    const seedCost = area * (0.09 + (inputs.mode === "diy" ? 0 : 0.14))
    const saves = sod.total - seedCost
    if (saves > 100) {
      out.push({
        title: "Seed the lawn instead of laying sod",
        detail: `Seeding the same ${Math.round(area).toLocaleString("en-US")} sq ft of lawn costs far less, but takes a full season to fill in and needs steady watering.`,
        savesAbout: saves,
      })
    }
  }

  const patio = byId.get("patio")
  if (patio && inputs.components.patio.option !== "concrete") {
    const area = inputs.components.patio.area
    const concrete = area * (7 + (inputs.mode === "diy" ? 0 : 6.5))
    const saves = patio.total - concrete
    if (saves > 150) {
      out.push({
        title: "Use poured concrete for the patio",
        detail:
          "Concrete is the cheapest durable patio surface. You give up the look of pavers and the ability to lift and reset individual units.",
        savesAbout: saves,
      })
    }
  }

  if (inputs.quality === "premium") {
    out.push({
      title: "Drop from premium to mid-range finishes",
      detail:
        "Mid-range plants and pavers hold up nearly as well. Premium mostly buys larger plant stock and higher-end stone.",
      savesAbout: total * 0.22,
    })
  }

  if (inputs.mode === "pro" && labor > 0) {
    const diyable = lines.filter((l) => l.diy === "yes")
    const saving = diyable.reduce((a, l) => a + l.labor, 0)
    if (saving > 200) {
      out.push({
        title: `Do the ${diyable.length === 1 ? "simplest item" : `${diyable.length} simplest items`} yourself`,
        detail: `Mulch, seed, and planting are the most DIY-friendly work here (${diyable
          .map((l) => l.label.toLowerCase())
          .join(", ")}). Leave walls, grading, and irrigation to a contractor.`,
        savesAbout: saving,
      })
    }
  }

  const wall = byId.get("wall")
  if (wall && inputs.components.wall.height > 3) {
    out.push({
      title: "Terrace the slope with two short walls",
      detail:
        "Two 2-3 ft walls often cost less than one tall wall because they avoid engineering, permits, and heavy reinforcement.",
      savesAbout: wall.total * 0.25,
    })
  }

  if (byId.has("trees") && inputs.components.trees.option === "large") {
    out.push({
      title: "Buy smaller trees",
      detail:
        "Small nursery stock costs a fraction of mature trees, handles transplant better, and usually catches up within several seasons.",
      savesAbout: byId.get("trees")!.total * 0.55,
    })
  }

  if (lines.length > 3) {
    out.push({
      title: "Phase the project across two seasons",
      detail:
        "Do the structural work first (grading, drainage, hardscape), then plant next year. It spreads the cost without redoing anything.",
      savesAbout: null,
    })
  }

  out.push({
    title: "Get three itemized bids",
    detail:
      "Landscape bids for identical scope commonly vary 20-40%. Insist on line-item pricing so you can compare like for like.",
    savesAbout: total > 0 ? total * 0.15 : null,
  })

  return out.slice(0, 6)
}
