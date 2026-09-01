// Remodeling Cost Calculator — pricing engine.
//
// Architecture note: every project type is just an entry in PROJECTS plus a set
// of ITEMS tagged with that project id. Adding "Basement Finishing" later means
// adding one project entry and its items — no changes to the math below.
//
// Pricing model, per line item:
//   material = matPerUnit * qty * finishFactor(finishSensitivity) * regionIndex
//   labor    = labPerUnit * qty * laborRate(mode, diy) * regionIndex
// Buckets (materials, labor, permits, demolition, overhead, contingency) stay
// separate all the way to the readout because the brief requires showing them
// independently.
//
// IMPORTANT: these are planning ranges built from national averages scaled by a
// regional index — explicitly not a contractor quote.

import { resolveRegion, type ResolvedRegion } from "@/lib/landscaping"

// --- Projects ---------------------------------------------------------------

export type ProjectId = "bathroom" | "kitchen" | "hottub"

export type ProjectDef = {
  id: ProjectId
  label: string
  /** Short label for the tab/selector. */
  short: string
  blurb: string
  /** What the "size" input means for this project. */
  sizeLabel: string
  sizeUnit: string
  sizePresets: Array<{ label: string; value: number; note: string }>
  /** Base permit fee before triggers. */
  permitBase: number
  scopes: ScopeDef[]
}

export type ScopeId = "refresh" | "standard" | "gut" | "layout"

export type ScopeDef = {
  id: ScopeId
  label: string
  blurb: string
  /** Multiplier on the demolition/disposal bucket. */
  demoFactor: number
  /** Items switched on when this scope is chosen. */
  items: ItemId[]
  /** Layout/structural work always means drawings and inspections. */
  permitHeavy?: boolean
}

export const PROJECTS: ProjectDef[] = [
  {
    id: "bathroom",
    label: "Bathroom Remodel",
    short: "Bathroom",
    blurb:
      "Costs scale with how much plumbing moves. Keeping fixtures where they are is the single biggest lever on a bathroom budget.",
    sizeLabel: "Bathroom size",
    sizeUnit: "sq ft",
    sizePresets: [
      { label: "Powder room", value: 20, note: "Toilet and sink only" },
      { label: "Full hall bath", value: 40, note: "Most common size" },
      { label: "Large primary", value: 90, note: "Double vanity, separate shower" },
      { label: "Spa primary", value: 140, note: "Freestanding tub and wet room" },
    ],
    permitBase: 350,
    scopes: [
      {
        id: "refresh",
        label: "Surface refresh",
        blurb: "Paint, floor, vanity, toilet and fixtures. Nothing moves.",
        demoFactor: 0.5,
        items: ["bath-floor", "bath-vanity", "bath-toilet", "bath-fixtures", "bath-paint"],
      },
      {
        id: "standard",
        label: "Standard remodel",
        blurb: "New shower or tub, tile, vanity, floor and lighting in the existing layout.",
        demoFactor: 1,
        items: [
          "bath-shower",
          "bath-tile",
          "bath-floor",
          "bath-vanity",
          "bath-toilet",
          "bath-counter",
          "bath-fixtures",
          "bath-light",
          "bath-vent",
          "bath-paint",
        ],
      },
      {
        id: "gut",
        label: "Full gut",
        blurb: "Down to the studs, same footprint. New everything, including wiring and venting.",
        demoFactor: 1.5,
        items: [
          "bath-shower",
          "bath-tub",
          "bath-tile",
          "bath-floor",
          "bath-vanity",
          "bath-toilet",
          "bath-counter",
          "bath-fixtures",
          "bath-light",
          "bath-vent",
          "bath-elec",
          "bath-paint",
        ],
      },
      {
        id: "layout",
        label: "Layout change",
        blurb: "Moving the toilet, shower or walls. Adds drawings, permits and inspections.",
        demoFactor: 1.8,
        permitHeavy: true,
        items: [
          "bath-shower",
          "bath-tub",
          "bath-tile",
          "bath-floor",
          "bath-vanity",
          "bath-toilet",
          "bath-counter",
          "bath-fixtures",
          "bath-light",
          "bath-vent",
          "bath-elec",
          "bath-move",
          "bath-paint",
        ],
      },
    ],
  },
  {
    id: "kitchen",
    label: "Kitchen Remodel",
    short: "Kitchen",
    blurb:
      "Cabinets and countertops usually account for over half the budget. Appliance tier is the next biggest swing.",
    sizeLabel: "Kitchen size",
    sizeUnit: "sq ft",
    sizePresets: [
      { label: "Small / galley", value: 100, note: "Apartment or galley run" },
      { label: "Average", value: 180, note: "Typical suburban kitchen" },
      { label: "Large", value: 280, note: "Eat-in with island" },
      { label: "Open concept", value: 400, note: "Great-room kitchen" },
    ],
    permitBase: 450,
    scopes: [
      {
        id: "refresh",
        label: "Surface refresh",
        blurb: "Counters, backsplash, paint, lighting and hardware. Cabinet boxes stay.",
        demoFactor: 0.5,
        items: ["kit-counter", "kit-backsplash", "kit-light", "kit-paint"],
      },
      {
        id: "standard",
        label: "Standard remodel",
        blurb: "New cabinets, counters, appliances and floor in the existing layout.",
        demoFactor: 1,
        items: [
          "kit-cabinets",
          "kit-counter",
          "kit-backsplash",
          "kit-appliances",
          "kit-floor",
          "kit-sink",
          "kit-light",
          "kit-paint",
        ],
      },
      {
        id: "gut",
        label: "Full gut",
        blurb: "Everything out, same footprint. New wiring, plumbing and venting.",
        demoFactor: 1.5,
        items: [
          "kit-cabinets",
          "kit-counter",
          "kit-island",
          "kit-backsplash",
          "kit-appliances",
          "kit-floor",
          "kit-sink",
          "kit-elec",
          "kit-hood",
          "kit-light",
          "kit-paint",
        ],
      },
      {
        id: "layout",
        label: "Layout change",
        blurb: "Removing a wall or relocating sink, range or fridge. Permits and inspections apply.",
        demoFactor: 1.9,
        permitHeavy: true,
        items: [
          "kit-cabinets",
          "kit-counter",
          "kit-island",
          "kit-backsplash",
          "kit-appliances",
          "kit-floor",
          "kit-sink",
          "kit-elec",
          "kit-hood",
          "kit-light",
          "kit-move",
          "kit-paint",
        ],
      },
    ],
  },
  {
    id: "hottub",
    label: "Jacuzzi / Hot Tub",
    short: "Hot tub",
    blurb:
      "The spa itself is often less than half the project. Electrical, the base it sits on and any deck work carry the rest.",
    sizeLabel: "Deck or pad area",
    sizeUnit: "sq ft",
    sizePresets: [
      { label: "Pad only", value: 64, note: "8x8 concrete pad" },
      { label: "Small deck", value: 120, note: "Pad plus surround" },
      { label: "Deck integrated", value: 240, note: "Tub set into a deck" },
      { label: "Full patio", value: 400, note: "Spa as part of a larger patio" },
    ],
    permitBase: 300,
    scopes: [
      {
        id: "refresh",
        label: "Replace existing spa",
        blurb: "Swapping a tub where the pad and 240V circuit already exist.",
        demoFactor: 0.6,
        items: ["tub-unit", "tub-delivery", "tub-cover"],
      },
      {
        id: "standard",
        label: "New install on a pad",
        blurb: "New spa, new concrete pad and a new 240V circuit.",
        demoFactor: 1,
        items: ["tub-unit", "tub-delivery", "tub-pad", "tub-elec", "tub-cover", "tub-site"],
      },
      {
        id: "gut",
        label: "Deck integrated",
        blurb: "Tub set into a new or rebuilt deck with a privacy surround.",
        demoFactor: 1.4,
        items: [
          "tub-unit",
          "tub-delivery",
          "tub-pad",
          "tub-elec",
          "tub-deck",
          "tub-screen",
          "tub-cover",
          "tub-site",
        ],
        permitHeavy: true,
      },
      {
        id: "layout",
        label: "In-ground spa",
        blurb: "Excavated, plumbed and finished like a small pool. Structural and permit heavy.",
        demoFactor: 2.2,
        permitHeavy: true,
        items: [
          "tub-unit",
          "tub-delivery",
          "tub-pad",
          "tub-elec",
          "tub-plumb",
          "tub-deck",
          "tub-screen",
          "tub-cover",
          "tub-site",
        ],
      },
    ],
  },
]

export const PROJECT_BY_ID: Record<ProjectId, ProjectDef> = PROJECTS.reduce(
  (acc, p) => {
    acc[p.id] = p
    return acc
  },
  {} as Record<ProjectId, ProjectDef>,
)

// --- Finish level, labor mode, condition ------------------------------------

export type Finish = "basic" | "mid" | "premium"

export const FINISH_LABELS: Record<Finish, string> = {
  basic: "Basic",
  mid: "Mid-range",
  premium: "Premium",
}

export const FINISH_NOTES: Record<Finish, string> = {
  basic: "Stock sizes, big-box fixtures, laminate or porcelain. Sound but plain.",
  mid: "Semi-custom cabinets, quartz, name-brand fixtures. The most common choice.",
  premium: "Custom millwork, stone slabs, designer fixtures and tile.",
}

/** Applied to material cost, weighted by each item's finishSensitivity. */
const FINISH_FACTOR: Record<Finish, number> = { basic: 0.62, mid: 1, premium: 1.9 }

export type LaborMode = "diy" | "trades" | "gc"

export const LABOR_LABELS: Record<LaborMode, string> = {
  diy: "Doing it myself",
  trades: "Hiring trades directly",
  gc: "General contractor",
}

export const LABOR_NOTES: Record<LaborMode, string> = {
  diy: "You supply the work. Licensed electrical and plumbing are still priced in — those need permits and inspections.",
  trades: "You hire and schedule each trade yourself. Cheaper than a GC, but you own the coordination and the mistakes.",
  gc: "One contract, one schedule. Overhead and profit are shown as their own line.",
}

/** GC overhead and profit, applied to materials + labor. */
const GC_OVERHEAD = 0.19
/** Hiring trades directly still carries a small premium over raw crew cost. */
const TRADES_RATE = 1.05
/** What a DIYer still pays a pro for, by diy-ability. */
const DIY_RATE: Record<DiyFit, number> = { yes: 0, partial: 0.45, no: 1 }

export type Condition = "good" | "dated" | "worn" | "damaged"

export const CONDITION_LABELS: Record<Condition, string> = {
  good: "Solid, just dated looking",
  dated: "Dated and showing wear",
  worn: "Worn out, some soft spots",
  damaged: "Known water damage or rot",
}

const CONDITION_DEMO: Record<Condition, number> = {
  good: 0.8,
  dated: 1,
  worn: 1.25,
  damaged: 1.6,
}

/** Baseline contingency percent by condition — unknowns behind the walls. */
const CONDITION_CONTINGENCY: Record<Condition, number> = {
  good: 8,
  dated: 10,
  worn: 14,
  damaged: 20,
}

// --- Items ------------------------------------------------------------------

export type DiyFit = "yes" | "partial" | "no"

export type ItemGroup =
  | "fixtures"
  | "surfaces"
  | "cabinetry"
  | "appliances"
  | "systems"
  | "site"

export const GROUP_LABELS: Record<ItemGroup, string> = {
  fixtures: "Fixtures",
  surfaces: "Surfaces",
  cabinetry: "Cabinetry & counters",
  appliances: "Appliances",
  systems: "Plumbing, electrical & venting",
  site: "Site & structure",
}

export const GROUP_ORDER: ItemGroup[] = [
  "fixtures",
  "cabinetry",
  "surfaces",
  "appliances",
  "systems",
  "site",
]

export type ItemId =
  // bathroom
  | "bath-shower"
  | "bath-tub"
  | "bath-tile"
  | "bath-floor"
  | "bath-vanity"
  | "bath-toilet"
  | "bath-counter"
  | "bath-fixtures"
  | "bath-light"
  | "bath-vent"
  | "bath-elec"
  | "bath-move"
  | "bath-paint"
  // kitchen
  | "kit-cabinets"
  | "kit-counter"
  | "kit-island"
  | "kit-backsplash"
  | "kit-appliances"
  | "kit-floor"
  | "kit-sink"
  | "kit-elec"
  | "kit-hood"
  | "kit-light"
  | "kit-move"
  | "kit-paint"
  // hot tub
  | "tub-unit"
  | "tub-delivery"
  | "tub-pad"
  | "tub-elec"
  | "tub-plumb"
  | "tub-deck"
  | "tub-screen"
  | "tub-cover"
  | "tub-site"

export type ItemOption = { value: string; label: string; multiplier: number }

export type ItemDef = {
  id: ItemId
  project: ProjectId
  label: string
  group: ItemGroup
  /** Material dollars per quantity unit at mid finish, national average. */
  material: number
  /** Installed labor dollars per quantity unit at crew cost. */
  labor: number
  /** 0 = finish level does not move this, 1 = moves fully. */
  finishSensitivity: number
  diy: DiyFit
  /** How quantity is derived from project size. Returns units. */
  qty: (size: number) => number
  /** Unit noun for the readout ("sq ft", "each", "linear ft"). */
  unit: string
  /** Triggers a trade permit when enabled. */
  permit?: boolean
  options?: ItemOption[]
  /** Which option is selected before the homeowner touches anything. */
  defaultOption?: string
  note: string
}

const one = () => 1

export const ITEMS: ItemDef[] = [
  // ----------------------------- Bathroom -----------------------------------
  {
    id: "bath-shower",
    project: "bathroom",
    label: "Shower or shower/tub",
    group: "fixtures",
    material: 1500,
    labor: 2100,
    finishSensitivity: 0.9,
    diy: "partial",
    qty: one,
    unit: "each",
    options: [
      { value: "insert", label: "Acrylic insert", multiplier: 0.55 },
      { value: "combo", label: "Tub/shower combo", multiplier: 0.8 },
      { value: "tiled", label: "Tiled walk-in", multiplier: 1 },
      { value: "wetroom", label: "Curbless wet room", multiplier: 1.7 },
    ],
    defaultOption: "tiled",
    note: "A tiled walk-in costs roughly twice an acrylic insert once waterproofing and labor are counted.",
  },
  {
    id: "bath-tub",
    project: "bathroom",
    label: "Jacuzzi or soaking tub",
    group: "fixtures",
    material: 2600,
    labor: 1700,
    finishSensitivity: 1,
    diy: "no",
    qty: one,
    unit: "each",
    options: [
      { value: "alcove", label: "Standard alcove tub", multiplier: 0.35 },
      { value: "soaker", label: "Freestanding soaker", multiplier: 0.85 },
      { value: "jetted", label: "Jetted whirlpool", multiplier: 1 },
      { value: "air", label: "Air-jet / heated", multiplier: 1.45 },
    ],
    defaultOption: "soaker",
    note: "Jetted tubs need a dedicated circuit and an access panel, which is why labor runs high.",
  },
  {
    id: "bath-tile",
    project: "bathroom",
    label: "Wall tile & waterproofing",
    group: "surfaces",
    material: 11,
    labor: 16,
    finishSensitivity: 1,
    diy: "partial",
    // Wet-wall tile scales with room size but is not the full floor area.
    qty: (size) => Math.max(35, Math.round(size * 1.6)),
    unit: "sq ft",
    note: "Labor per square foot rises sharply with small-format, mosaic or herringbone patterns.",
  },
  {
    id: "bath-floor",
    project: "bathroom",
    label: "Flooring",
    group: "surfaces",
    material: 8,
    labor: 11,
    finishSensitivity: 1,
    diy: "partial",
    qty: (size) => Math.max(20, Math.round(size)),
    unit: "sq ft",
    note: "Heated floor mats add roughly $12–18 per square foot installed.",
  },
  {
    id: "bath-vanity",
    project: "bathroom",
    label: "Vanity & sink",
    group: "cabinetry",
    material: 1250,
    labor: 650,
    finishSensitivity: 1,
    diy: "partial",
    qty: (size) => (size >= 80 ? 2 : 1),
    unit: "each",
    note: "Double vanities are priced automatically for primary baths over 80 sq ft.",
  },
  {
    id: "bath-toilet",
    project: "bathroom",
    label: "Toilet",
    group: "fixtures",
    material: 450,
    labor: 340,
    finishSensitivity: 0.8,
    diy: "partial",
    qty: one,
    unit: "each",
    note: "Wall-hung and bidet-seat models carry both a fixture and a rough-in premium.",
  },
  {
    id: "bath-counter",
    project: "bathroom",
    label: "Countertop",
    group: "cabinetry",
    material: 620,
    labor: 280,
    finishSensitivity: 1,
    diy: "no",
    qty: (size) => (size >= 80 ? 2 : 1),
    unit: "top",
    note: "Stone tops are templated and fabricated off-site, so they are rarely a DIY item.",
  },
  {
    id: "bath-fixtures",
    project: "bathroom",
    label: "Faucets, valves & trim",
    group: "fixtures",
    material: 760,
    labor: 520,
    finishSensitivity: 1,
    diy: "partial",
    qty: one,
    unit: "set",
    note: "Thermostatic and multi-head valves are a large hidden jump over a single-handle mixer.",
  },
  {
    id: "bath-light",
    project: "bathroom",
    label: "Lighting",
    group: "systems",
    material: 480,
    labor: 560,
    finishSensitivity: 1,
    diy: "no",
    qty: one,
    unit: "set",
    note: "Vanity, ceiling and shower-rated cans, plus switching.",
  },
  {
    id: "bath-vent",
    project: "bathroom",
    label: "Ventilation fan",
    group: "systems",
    material: 240,
    labor: 470,
    finishSensitivity: 0.5,
    diy: "no",
    qty: one,
    unit: "each",
    permit: true,
    note: "Venting to the outside is code. Dumping into an attic is the most common failed inspection.",
  },
  {
    id: "bath-elec",
    project: "bathroom",
    label: "Electrical (circuits & GFCI)",
    group: "systems",
    material: 380,
    labor: 1150,
    finishSensitivity: 0.2,
    diy: "no",
    qty: one,
    unit: "job",
    permit: true,
    note: "Older baths usually need a dedicated GFCI circuit brought in from the panel.",
  },
  {
    id: "bath-move",
    project: "bathroom",
    label: "Plumbing relocation",
    group: "site",
    material: 900,
    labor: 2800,
    finishSensitivity: 0.1,
    diy: "no",
    qty: one,
    unit: "job",
    permit: true,
    note: "Moving a toilet drain means opening the floor and re-sloping waste lines. Single biggest avoidable cost.",
  },
  {
    id: "bath-paint",
    project: "bathroom",
    label: "Drywall & paint",
    group: "surfaces",
    material: 2.6,
    labor: 5,
    finishSensitivity: 0.6,
    diy: "yes",
    qty: (size) => Math.max(120, Math.round(size * 3.2)),
    unit: "sq ft",
    note: "Wall and ceiling area, not floor area. Moisture-resistant board in wet zones.",
  },

  // ----------------------------- Kitchen ------------------------------------
  {
    id: "kit-cabinets",
    project: "kitchen",
    label: "Cabinets",
    group: "cabinetry",
    material: 330,
    labor: 135,
    finishSensitivity: 1,
    diy: "partial",
    // Roughly one linear foot of run per 8 sq ft of kitchen.
    qty: (size) => Math.max(10, Math.round(size / 8)),
    unit: "linear ft",
    options: [
      { value: "reface", label: "Reface existing", multiplier: 0.4 },
      { value: "stock", label: "Stock", multiplier: 0.7 },
      { value: "semi", label: "Semi-custom", multiplier: 1 },
      { value: "custom", label: "Full custom", multiplier: 1.9 },
    ],
    defaultOption: "semi",
    note: "Usually the largest single line in a kitchen. Refacing keeps boxes and cuts this by more than half.",
  },
  {
    id: "kit-counter",
    project: "kitchen",
    label: "Countertops",
    group: "cabinetry",
    material: 68,
    labor: 30,
    finishSensitivity: 1,
    diy: "no",
    // Counter area tracks cabinet run at about 2.6 sq ft per linear foot.
    qty: (size) => Math.max(25, Math.round((size / 8) * 2.6)),
    unit: "sq ft",
    options: [
      { value: "laminate", label: "Laminate", multiplier: 0.3 },
      { value: "butcher", label: "Butcher block", multiplier: 0.6 },
      { value: "quartz", label: "Quartz", multiplier: 1 },
      { value: "stone", label: "Natural stone slab", multiplier: 1.5 },
    ],
    defaultOption: "quartz",
    note: "Waterfall edges and full-height slab backsplashes add material fast.",
  },
  {
    id: "kit-island",
    project: "kitchen",
    label: "Island",
    group: "cabinetry",
    material: 2400,
    labor: 1500,
    finishSensitivity: 1,
    diy: "no",
    qty: one,
    unit: "each",
    note: "An island with a sink or cooktop needs plumbing or gas run through the floor.",
  },
  {
    id: "kit-backsplash",
    project: "kitchen",
    label: "Backsplash",
    group: "surfaces",
    material: 16,
    labor: 23,
    finishSensitivity: 1,
    diy: "partial",
    qty: (size) => Math.max(25, Math.round((size / 8) * 2.2)),
    unit: "sq ft",
    note: "Small tile and glass mosaics can double labor versus a large-format subway tile.",
  },
  {
    id: "kit-appliances",
    project: "kitchen",
    label: "Appliance package",
    group: "appliances",
    material: 5200,
    labor: 620,
    finishSensitivity: 1,
    diy: "partial",
    qty: one,
    unit: "package",
    options: [
      { value: "budget", label: "Budget suite", multiplier: 0.45 },
      { value: "standard", label: "Mainstream brands", multiplier: 1 },
      { value: "pro", label: "Pro-style", multiplier: 2.4 },
      { value: "luxury", label: "Luxury / built-in", multiplier: 4 },
    ],
    defaultOption: "standard",
    note: "Pro-style ranges often require a larger gas line and more make-up air.",
  },
  {
    id: "kit-floor",
    project: "kitchen",
    label: "Flooring",
    group: "surfaces",
    material: 8,
    labor: 11,
    finishSensitivity: 1,
    diy: "partial",
    qty: (size) => Math.max(60, Math.round(size)),
    unit: "sq ft",
    note: "Tile needs a flatter subfloor than vinyl plank, which shows up as prep labor.",
  },
  {
    id: "kit-sink",
    project: "kitchen",
    label: "Sink, faucet & plumbing",
    group: "systems",
    material: 900,
    labor: 1300,
    finishSensitivity: 1,
    diy: "partial",
    qty: one,
    unit: "set",
    note: "Includes disposal, supply and drain work at the existing location.",
  },
  {
    id: "kit-elec",
    project: "kitchen",
    label: "Electrical (circuits & outlets)",
    group: "systems",
    material: 700,
    labor: 1900,
    finishSensitivity: 0.2,
    diy: "no",
    qty: one,
    unit: "job",
    permit: true,
    note: "Modern kitchens need multiple 20A counter circuits plus dedicated appliance runs.",
  },
  {
    id: "kit-hood",
    project: "kitchen",
    label: "Range hood & venting",
    group: "systems",
    material: 780,
    labor: 720,
    finishSensitivity: 1,
    diy: "no",
    qty: one,
    unit: "each",
    note: "Running new duct to an exterior wall or roof is most of this cost.",
  },
  {
    id: "kit-light",
    project: "kitchen",
    label: "Lighting",
    group: "systems",
    material: 950,
    labor: 1100,
    finishSensitivity: 1,
    diy: "no",
    qty: one,
    unit: "set",
    note: "Cans, under-cabinet strips and pendants, plus dimmers and switching.",
  },
  {
    id: "kit-move",
    project: "kitchen",
    label: "Wall removal / layout change",
    group: "site",
    material: 1100,
    labor: 5400,
    finishSensitivity: 0.1,
    diy: "no",
    qty: one,
    unit: "job",
    permit: true,
    note: "If the wall is load-bearing you are paying for a beam, posts and an engineer's letter.",
  },
  {
    id: "kit-paint",
    project: "kitchen",
    label: "Drywall & paint",
    group: "surfaces",
    material: 2.6,
    labor: 5,
    finishSensitivity: 0.6,
    diy: "yes",
    // Cabinets and backsplash cover much of a kitchen's wall area, so the
    // paintable surface is well under the full wall-and-ceiling figure.
    qty: (size) => Math.max(150, Math.round(size * 1.5)),
    unit: "sq ft",
    note: "Wall and ceiling area. Patching after cabinet removal is usually more than expected.",
  },

  // ----------------------------- Hot tub ------------------------------------
  {
    id: "tub-unit",
    project: "hottub",
    label: "Spa / hot tub unit",
    group: "fixtures",
    material: 9000,
    labor: 0,
    finishSensitivity: 0.35,
    diy: "yes",
    qty: one,
    unit: "each",
    options: [
      { value: "plug", label: "Plug-and-play (110V)", multiplier: 0.45 },
      { value: "standard", label: "Standard 240V", multiplier: 1 },
      { value: "premium", label: "Premium / saltwater", multiplier: 1.6 },
      { value: "swim", label: "Swim spa", multiplier: 3.1 },
    ],
    defaultOption: "standard",
    note: "Plug-and-play models avoid a 240V circuit entirely, which removes the electrician from the job.",
  },
  {
    id: "tub-delivery",
    project: "hottub",
    label: "Delivery & placement",
    group: "site",
    material: 300,
    labor: 550,
    finishSensitivity: 0.2,
    diy: "no",
    qty: one,
    unit: "job",
    note: "Crane or tight-access placement can add well over a thousand on its own.",
  },
  {
    id: "tub-pad",
    project: "hottub",
    label: "Concrete pad or base",
    group: "site",
    material: 9,
    labor: 14,
    finishSensitivity: 0.4,
    diy: "partial",
    qty: (size) => Math.max(64, Math.round(size * 0.55)),
    unit: "sq ft",
    note: "A filled spa is extremely heavy. A proper reinforced pad is not optional.",
  },
  {
    id: "tub-elec",
    project: "hottub",
    label: "240V circuit & disconnect",
    group: "systems",
    material: 650,
    labor: 1550,
    finishSensitivity: 0.15,
    diy: "no",
    qty: one,
    unit: "job",
    permit: true,
    note: "Requires a GFCI disconnect within sight of the spa. Always permitted and inspected.",
  },
  {
    id: "tub-plumb",
    project: "hottub",
    label: "Plumbing & equipment pad",
    group: "systems",
    material: 700,
    labor: 1800,
    finishSensitivity: 0.3,
    diy: "no",
    qty: one,
    unit: "job",
    permit: true,
    note: "In-ground spas need buried lines, a pump vault and freeze protection.",
  },
  {
    id: "tub-deck",
    project: "hottub",
    label: "Deck or surround",
    group: "site",
    material: 30,
    labor: 36,
    finishSensitivity: 1,
    diy: "partial",
    qty: (size) => Math.max(40, Math.round(size * 0.75)),
    unit: "sq ft",
    note: "A deck holding a spa needs heavier framing and footings than a normal deck.",
  },
  {
    id: "tub-screen",
    project: "hottub",
    label: "Privacy screen or pergola",
    group: "site",
    material: 1900,
    labor: 1400,
    finishSensitivity: 1,
    diy: "partial",
    qty: one,
    unit: "each",
    note: "Often the difference between a spa you use and one you do not.",
  },
  {
    id: "tub-cover",
    project: "hottub",
    label: "Cover, steps & startup",
    group: "fixtures",
    material: 780,
    labor: 180,
    finishSensitivity: 0.7,
    diy: "yes",
    qty: one,
    unit: "set",
    note: "A well-fitted cover is the single biggest factor in running cost.",
  },
  {
    id: "tub-site",
    project: "hottub",
    label: "Site prep & access",
    group: "site",
    material: 320,
    labor: 780,
    finishSensitivity: 0.2,
    diy: "partial",
    qty: one,
    unit: "job",
    note: "Clearing, grading, gate removal and restoring the lawn afterward.",
  },
]

export const ITEM_BY_ID: Record<ItemId, ItemDef> = ITEMS.reduce(
  (acc, i) => {
    acc[i.id] = i
    return acc
  },
  {} as Record<ItemId, ItemDef>,
)

export function itemsForProject(project: ProjectId): ItemDef[] {
  return ITEMS.filter((i) => i.project === project)
}

// --- State ------------------------------------------------------------------

export type ItemState = {
  enabled: boolean
  /** null means "use the size-derived quantity". */
  qty: number | null
  option: string | null
}

export function initialItemState(project: ProjectId, scope: ScopeId): Record<string, ItemState> {
  const def = PROJECT_BY_ID[project]
  const scopeDef = def.scopes.find((s) => s.id === scope) ?? def.scopes[0]
  const on = new Set<string>(scopeDef.items)
  return itemsForProject(project).reduce(
    (acc, item) => {
      acc[item.id] = {
        enabled: on.has(item.id),
        qty: null,
        option: item.options
          ? (item.defaultOption ?? item.options[item.options.length - 1].value)
          : null,
      }
      return acc
    },
    {} as Record<string, ItemState>,
  )
}

export type RemodelInputs = {
  project: ProjectId
  zip: string
  size: number
  scope: ScopeId
  condition: Condition
  finish: Finish
  labor: LaborMode
  items: Record<string, ItemState>
  /** Overrides the condition-derived default when set. */
  contingencyPercent: number | null
}

// --- Output -----------------------------------------------------------------

export type LineItem = {
  id: ItemId
  label: string
  group: ItemGroup
  qty: number
  unit: string
  optionLabel: string | null
  materials: number
  labor: number
  total: number
  diy: DiyFit
  note: string
}

export type Bucket = {
  id: "materials" | "labor" | "permits" | "demolition" | "overhead" | "contingency"
  label: string
  amount: number
  note: string
}

export type Driver = { label: string; amount: number; share: number; note: string }

export type CostRange = { low: number; high: number }

export type RemodelResult = {
  region: ResolvedRegion
  lines: LineItem[]
  buckets: Bucket[]
  subtotal: number
  total: number
  range: CostRange
  perSqFt: CostRange | null
  drivers: Driver[]
  spreadPercent: number
  permitCount: number
  contingencyPercent: number
  /** Basic / Mid / Premium totals for the same selections. */
  scenarios: Array<{ finish: Finish; label: string; range: CostRange }>
  isEmpty: boolean
}

export function formatMoney(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
}

/** Rounds to a readable step so we never imply dollar precision. */
function roundish(n: number): number {
  if (n <= 0) return 0
  const step = n >= 50000 ? 1000 : n >= 10000 ? 500 : n >= 2000 ? 100 : 50
  return Math.round(n / step) * step
}

function finishFactor(finish: Finish, sensitivity: number): number {
  // sensitivity 0 -> always 1.0; sensitivity 1 -> full finish factor
  return 1 + (FINISH_FACTOR[finish] - 1) * sensitivity
}

function laborRate(mode: LaborMode, diy: DiyFit): number {
  if (mode === "diy") return DIY_RATE[diy]
  if (mode === "trades") return TRADES_RATE
  return 1
}

/** Core pricing pass. Exported shape is stable so scenarios can reuse it. */
function priceLines(inputs: RemodelInputs, region: ResolvedRegion, finish: Finish): LineItem[] {
  const { size, items, labor: mode } = inputs
  return itemsForProject(inputs.project)
    .filter((def) => items[def.id]?.enabled)
    .map((def) => {
      const state = items[def.id]
      const qty = state.qty ?? def.qty(size)
      const option = def.options?.find((o) => o.value === state.option) ?? null
      const optionMult = option?.multiplier ?? 1

      const materials =
        def.material * qty * finishFactor(finish, def.finishSensitivity) * optionMult * region.index
      // Labor tracks the option too (a tiled shower is more work than an insert)
      // but is not moved by finish level on its own.
      const laborCost =
        def.labor * qty * optionMult * laborRate(mode, def.diy) * region.index

      return {
        id: def.id,
        label: def.label,
        group: def.group,
        qty,
        unit: def.unit,
        optionLabel: option?.label ?? null,
        materials,
        labor: laborCost,
        total: materials + laborCost,
        diy: def.diy,
        note: def.note,
      }
    })
}

export function estimate(inputs: RemodelInputs): RemodelResult {
  const region = resolveRegion(inputs.zip)
  const project = PROJECT_BY_ID[inputs.project]
  const scopeDef = project.scopes.find((s) => s.id === inputs.scope) ?? project.scopes[0]

  const lines = priceLines(inputs, region, inputs.finish)

  const materials = lines.reduce((n, l) => n + l.materials, 0)
  const laborTotal = lines.reduce((n, l) => n + l.labor, 0)

  // Demolition and disposal: driven by scope and how bad things are, scaled by
  // the size of the project rather than a flat fee.
  const demoBase = project.id === "hottub" ? 6 : 11
  const demolition =
    inputs.size > 0
      ? demoBase * inputs.size * scopeDef.demoFactor * CONDITION_DEMO[inputs.condition] * region.index
      : 0

  // Permits: base fee plus each permitted trade actually enabled.
  const permitLines = lines.filter((l) => ITEM_BY_ID[l.id].permit)
  const permits =
    lines.length === 0
      ? 0
      : (project.permitBase * (scopeDef.permitHeavy ? 2.2 : 1) + permitLines.length * 145) *
        region.index

  // GC overhead and profit on the work, shown separately per the brief.
  const overhead =
    inputs.labor === "gc" ? (materials + laborTotal + demolition) * GC_OVERHEAD : 0

  const contingencyPercent = inputs.contingencyPercent ?? CONDITION_CONTINGENCY[inputs.condition]
  const preContingency = materials + laborTotal + demolition + permits + overhead
  const contingency = preContingency * (contingencyPercent / 100)

  const total = preContingency + contingency

  const allBuckets: Bucket[] = [
    {
      id: "materials",
      label: "Materials & fixtures",
      amount: materials,
      note: `${FINISH_LABELS[inputs.finish]} finishes`,
    },
    {
      id: "labor",
      label: "Labor",
      amount: laborTotal,
      note:
        inputs.labor === "diy"
          ? "Licensed trades only — your own time is not priced"
          : LABOR_LABELS[inputs.labor],
    },
    {
      id: "demolition",
      label: "Demolition & disposal",
      amount: demolition,
      note: `${scopeDef.label}, ${CONDITION_LABELS[inputs.condition].toLowerCase()}`,
    },
    {
      id: "permits",
      label: "Permits & inspections",
      amount: permits,
      note:
        permitLines.length > 0
          ? `${permitLines.length} permitted trade(s)`
          : "Base permit only",
    },
    {
      id: "overhead",
      label: "Contractor overhead & profit",
      amount: overhead,
      note: inputs.labor === "gc" ? `${Math.round(GC_OVERHEAD * 100)}% of the work` : "Not applicable",
    },
    {
      id: "contingency",
      label: "Contingency",
      amount: contingency,
      note: `${contingencyPercent}% for what is behind the walls`,
    },
  ]
  const buckets = allBuckets.filter((b) => b.amount > 0 || b.id === "contingency")

  // Uncertainty spread: wider when we know less or the scope is riskier.
  let spread = 0.13
  if (region.isFallback) spread += 0.04
  if (scopeDef.permitHeavy) spread += 0.04
  if (inputs.condition === "damaged") spread += 0.06
  else if (inputs.condition === "worn") spread += 0.03
  if (inputs.labor === "diy") spread += 0.03
  spread = Math.min(0.3, spread)

  const range: CostRange = {
    low: roundish(total * (1 - spread)),
    high: roundish(total * (1 + spread)),
  }

  // Largest cost drivers, including the buckets that are not line items.
  const driverPool: Driver[] = [
    ...lines.map((l) => ({
      label: l.label,
      amount: l.total,
      share: 0,
      note: l.note,
    })),
    ...(demolition > 0
      ? [
          {
            label: "Demolition & disposal",
            amount: demolition,
            share: 0,
            note: "Driven by scope and condition. A gut costs three times a surface refresh here.",
          },
        ]
      : []),
    ...(overhead > 0
      ? [
          {
            label: "Contractor overhead & profit",
            amount: overhead,
            share: 0,
            note: "Hiring trades directly removes this, but you take on scheduling and liability.",
          },
        ]
      : []),
  ]
  const drivers = driverPool
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 4)
    .map((d) => ({ ...d, share: total > 0 ? d.amount / total : 0 }))

  // Basic / Mid / Premium comparison on the same selections.
  const scenarios = (["basic", "mid", "premium"] as Finish[]).map((f) => {
    const altLines = priceLines(inputs, region, f)
    const altMat = altLines.reduce((n, l) => n + l.materials, 0)
    const altLab = altLines.reduce((n, l) => n + l.labor, 0)
    const altOverhead = inputs.labor === "gc" ? (altMat + altLab + demolition) * GC_OVERHEAD : 0
    const altPre = altMat + altLab + demolition + permits + altOverhead
    const altTotal = altPre * (1 + contingencyPercent / 100)
    return {
      finish: f,
      label: FINISH_LABELS[f],
      range: {
        low: roundish(altTotal * (1 - spread)),
        high: roundish(altTotal * (1 + spread)),
      },
    }
  })

  const perSqFt =
    inputs.size > 0 && project.id !== "hottub" && total > 0
      ? { low: Math.round(range.low / inputs.size), high: Math.round(range.high / inputs.size) }
      : null

  return {
    region,
    lines,
    buckets,
    subtotal: materials + laborTotal,
    total,
    range,
    perSqFt,
    drivers,
    spreadPercent: Math.round(spread * 100),
    permitCount: permitLines.length,
    contingencyPercent,
    scenarios,
    isEmpty: lines.length === 0,
  }
}
