// Pure, dependency-free model powering the Interactive Home Upgrade Explorer.
//
// It answers "what should I upgrade first?" by scoring each upgrade on a fixed
// priority scale and letting the user assemble a plan. The clay cutaway house
// and the plan panel both read from this one module, so the picture, the
// priority order and the running totals can never disagree.
//
// This is an EDUCATIONAL visualization built from national-average cost ranges
// and service-life priorities. It is explicitly NOT a professional inspection
// or a firm quote — the UI says so wherever it shows numbers.

// ---------------------------------------------------------------------------
// Groups (the three families of upgrades the brief calls for)
// ---------------------------------------------------------------------------

export type UpgradeGroup = "exterior" | "mechanical" | "interior"

export const GROUP_LABELS: Record<UpgradeGroup, string> = {
  exterior: "Exterior & envelope",
  mechanical: "Mechanical & systems",
  interior: "Interior & living",
}

export const GROUP_ORDER: UpgradeGroup[] = ["exterior", "mechanical", "interior"]

// ---------------------------------------------------------------------------
// Priority tiers — these drive both the pin colour and the "what first" order.
// ---------------------------------------------------------------------------

export type PriorityTier = "safety" | "high" | "medium" | "low"

export const TIER_LABELS: Record<PriorityTier, string> = {
  safety: "Safety first",
  high: "High priority",
  medium: "Worth planning",
  low: "Nice to have",
}

/** Muted clay colours for each tier. Kept here so pins and legend agree. */
export const TIER_COLORS: Record<PriorityTier, string> = {
  safety: "#c0563c", // terracotta red
  high: "#d79049", // warm amber
  medium: "#8a9a6f", // soft sage
  low: "#7f9bb3", // desaturated blue
}

// ---------------------------------------------------------------------------
// Upgrades
// ---------------------------------------------------------------------------

export type UpgradeId =
  | "roof"
  | "windows"
  | "siding"
  | "doors"
  | "insulation"
  | "hvac"
  | "waterHeater"
  | "electrical"
  | "plumbing"
  | "kitchen"
  | "bathroom"
  | "flooring"
  | "lighting"

export type Upgrade = {
  id: UpgradeId
  label: string
  group: UpgradeGroup
  tier: PriorityTier
  /** 0–100, higher runs sooner in the recommended sequence. */
  priorityScore: number
  /** National-average install range, before any regional adjustment. */
  cost: { low: number; high: number }
  /** Rough annual utility saving from the upgrade ($/yr), national midpoint. */
  annualEnergySavings: number
  /** 0–3, how much day-to-day comfort improves. */
  comfortGain: 0 | 1 | 2 | 3
  /** Share of spend typically recovered at resale. */
  resaleRecovery: number
  /** One-line "why it matters". */
  blurb: string
  /** Position of the hotspot pin on the stage, in % (0–100). */
  x: number
  y: number
}

// Ordered richest-context first; priorityScore (not array order) drives ranking.
export const UPGRADES: Upgrade[] = [
  // --- Exterior & envelope --------------------------------------------------
  {
    id: "roof",
    label: "Roof",
    group: "exterior",
    tier: "high",
    priorityScore: 90,
    cost: { low: 9000, high: 16000 },
    annualEnergySavings: 60,
    comfortGain: 1,
    resaleRecovery: 0.65,
    blurb:
      "The roof protects everything below it. Replacing it before it fails avoids sheathing rot and interior water damage.",
    x: 50,
    y: 18.5,
  },
  {
    id: "insulation",
    label: "Insulation & air sealing",
    group: "exterior",
    tier: "high",
    priorityScore: 78,
    cost: { low: 2500, high: 6500 },
    annualEnergySavings: 320,
    comfortGain: 3,
    resaleRecovery: 0.35,
    blurb:
      "The cheapest comfort upgrade in most homes — sealing and topping up attic insulation pays back fast and steadies every room.",
    x: 31,
    y: 18.5,
  },
  {
    id: "windows",
    label: "Windows",
    group: "exterior",
    tier: "medium",
    priorityScore: 58,
    cost: { low: 8000, high: 20000 },
    annualEnergySavings: 240,
    comfortGain: 3,
    resaleRecovery: 0.65,
    blurb:
      "New double-pane windows kill drafts and cut heating and cooling loss, but they are rarely the most urgent dollar.",
    x: 9.5,
    y: 49,
  },
  {
    id: "siding",
    label: "Siding & cladding",
    group: "exterior",
    tier: "medium",
    priorityScore: 46,
    cost: { low: 12000, high: 28000 },
    annualEnergySavings: 120,
    comfortGain: 1,
    resaleRecovery: 0.7,
    blurb:
      "Sound cladding keeps water out of the walls. Replace it when it is failing, not just dated — otherwise it can wait.",
    x: 90.5,
    y: 54,
  },
  {
    id: "doors",
    label: "Exterior doors",
    group: "exterior",
    tier: "low",
    priorityScore: 34,
    cost: { low: 1200, high: 4200 },
    annualEnergySavings: 70,
    comfortGain: 2,
    resaleRecovery: 0.7,
    blurb:
      "A tight, well-built entry door improves security, curb appeal and drafts for relatively little money.",
    x: 50,
    y: 90.5,
  },
  // --- Mechanical & systems -------------------------------------------------
  {
    id: "electrical",
    label: "Electrical panel",
    group: "mechanical",
    tier: "safety",
    priorityScore: 98,
    cost: { low: 2000, high: 6500 },
    annualEnergySavings: 0,
    comfortGain: 1,
    resaleRecovery: 0.5,
    blurb:
      "An outdated or hazardous panel is a fire and insurance risk. Safety items like this come before anything cosmetic.",
    x: 17.5,
    y: 82,
  },
  {
    id: "hvac",
    label: "Heating & cooling",
    group: "mechanical",
    tier: "high",
    priorityScore: 84,
    cost: { low: 6000, high: 14000 },
    annualEnergySavings: 340,
    comfortGain: 3,
    resaleRecovery: 0.5,
    blurb:
      "A right-sized, efficient system is the biggest single lever on both comfort and energy bills — plan it before it dies mid-summer.",
    x: 20,
    y: 68,
  },
  {
    id: "plumbing",
    label: "Plumbing & supply",
    group: "mechanical",
    tier: "high",
    priorityScore: 72,
    cost: { low: 3500, high: 12000 },
    annualEnergySavings: 0,
    comfortGain: 2,
    resaleRecovery: 0.5,
    blurb:
      "Old galvanized or polybutylene supply lines are a burst-and-flood risk. Repiping is disruptive, so pair it with other work.",
    x: 33,
    y: 72,
  },
  {
    id: "waterHeater",
    label: "Water heater",
    group: "mechanical",
    tier: "medium",
    priorityScore: 62,
    cost: { low: 1400, high: 3400 },
    annualEnergySavings: 110,
    comfortGain: 2,
    resaleRecovery: 0.45,
    blurb:
      "Tanks last 8–12 years and fail wet. Replacing a tired one on your schedule beats an emergency call and a flooded floor.",
    x: 30,
    y: 80,
  },
  // --- Interior & living ----------------------------------------------------
  {
    id: "flooring",
    label: "Flooring",
    group: "interior",
    tier: "low",
    priorityScore: 40,
    cost: { low: 3000, high: 12000 },
    annualEnergySavings: 0,
    comfortGain: 1,
    resaleRecovery: 0.5,
    blurb:
      "Fresh floors transform how a home feels and shows. Cosmetic, so it slots in after the systems are sound.",
    x: 50,
    y: 74,
  },
  {
    id: "lighting",
    label: "Lighting",
    group: "interior",
    tier: "low",
    priorityScore: 30,
    cost: { low: 1200, high: 4500 },
    annualEnergySavings: 40,
    comfortGain: 2,
    resaleRecovery: 0.4,
    blurb:
      "Layered LED lighting is a low-cost, high-impact upgrade for both mood and energy use in every room.",
    x: 50,
    y: 56,
  },
  {
    id: "bathroom",
    label: "Bathroom",
    group: "interior",
    tier: "medium",
    priorityScore: 52,
    cost: { low: 8000, high: 25000 },
    annualEnergySavings: 0,
    comfortGain: 2,
    resaleRecovery: 0.6,
    blurb:
      "A dated or leaking bathroom is worth fixing for both daily use and resale — check for hidden water damage first.",
    x: 75.5,
    y: 40,
  },
  {
    id: "kitchen",
    label: "Kitchen",
    group: "interior",
    tier: "medium",
    priorityScore: 48,
    cost: { low: 15000, high: 45000 },
    annualEnergySavings: 0,
    comfortGain: 2,
    resaleRecovery: 0.55,
    blurb:
      "The kitchen drives how a home lives and sells, but it is the priciest room — do it once the bones are in good shape.",
    x: 50,
    y: 40,
  },
]

export const UPGRADE_BY_ID: Record<UpgradeId, Upgrade> = UPGRADES.reduce(
  (acc, u) => {
    acc[u.id] = u
    return acc
  },
  {} as Record<UpgradeId, Upgrade>,
)

/** Upgrades ranked by the recommended "what first" order (highest first). */
export const RECOMMENDED_ORDER: Upgrade[] = [...UPGRADES].sort(
  (a, b) => b.priorityScore - a.priorityScore,
)

// ---------------------------------------------------------------------------
// Rooms — labelled clay floor tiles that give the cutaway its context.
// ---------------------------------------------------------------------------

export type Room = {
  id: string
  label: string
  /** Rect in % of the floor-plan container. */
  x: number
  y: number
  w: number
  h: number
  color: string
}

export const ROOMS: Room[] = [
  { id: "garage", label: "Garage", x: 0, y: 0, w: 33, h: 40, color: "#d8cdb8" },
  { id: "kitchen", label: "Kitchen", x: 33, y: 0, w: 34, h: 40, color: "#e6d7b9" },
  { id: "bath", label: "Bath", x: 67, y: 0, w: 33, h: 40, color: "#ccd7d2" },
  { id: "hall", label: "Hall", x: 0, y: 40, w: 100, h: 15, color: "#eaddc6" },
  { id: "utility", label: "Utility", x: 0, y: 55, w: 33, h: 45, color: "#d3cabd" },
  { id: "living", label: "Living room", x: 33, y: 55, w: 34, h: 45, color: "#e8dabd" },
  { id: "bedroom", label: "Primary bedroom", x: 67, y: 55, w: 33, h: 45, color: "#dedcc4" },
]

// ---------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------

export type RenovationPlan = {
  ids: UpgradeId[]
  count: number
  totalLow: number
  totalHigh: number
  annualEnergySavings: number
  resaleAdded: number
  /** The highest-priority upgrade not yet in the plan, or null when full. */
  recommendedNext: Upgrade | null
}

export function computePlan(selected: UpgradeId[]): RenovationPlan {
  const set = new Set(selected)
  let totalLow = 0
  let totalHigh = 0
  let annualEnergySavings = 0
  let resaleAdded = 0

  for (const id of selected) {
    const u = UPGRADE_BY_ID[id]
    if (!u) continue
    totalLow += u.cost.low
    totalHigh += u.cost.high
    annualEnergySavings += u.annualEnergySavings
    resaleAdded += ((u.cost.low + u.cost.high) / 2) * u.resaleRecovery
  }

  const recommendedNext =
    RECOMMENDED_ORDER.find((u) => !set.has(u.id)) ?? null

  return {
    ids: selected,
    count: selected.length,
    totalLow,
    totalHigh,
    annualEnergySavings,
    resaleAdded: Math.round(resaleAdded),
    recommendedNext,
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

/** Compact range like "$9,000–$16,000". */
export function moneyRange(low: number, high: number): string {
  return `${money(low)}–${money(high)}`
}
