// Home Upgrade Advisor — prioritization engine.
//
// This module answers "what should I fix first?" rather than "what does X
// cost". Every component is scored on the seven axes the brief calls for
// (urgency, remaining life, risk of waiting, cost, energy savings, comfort,
// resale impact) and then sorted into an action plan.
//
// IMPORTANT: this is educational prioritization built from service-life
// averages and reported symptoms. It is explicitly NOT a professional
// inspection or engineering diagnosis, and the UI must say so wherever it
// presents results.

import { resolveRegion, type ResolvedRegion } from "@/lib/landscaping"

// --- Homeowner priorities ---------------------------------------------------

export type Priority =
  | "safety"
  | "repairs"
  | "energy"
  | "comfort"
  | "appearance"
  | "resale"
  | "balanced"

export const PRIORITY_LABELS: Record<Priority, string> = {
  safety: "Safety",
  repairs: "Avoid big repairs",
  energy: "Energy savings",
  comfort: "Comfort",
  appearance: "Appearance",
  resale: "Resale value",
  balanced: "A bit of everything",
}

export const PRIORITY_NOTES: Record<Priority, string> = {
  safety: "Pushes electrical, gas, structural and water-intrusion items to the top.",
  repairs: "Favors work that stops a small problem from becoming a big one.",
  energy: "Favors insulation, HVAC, windows and water heating by payback.",
  comfort: "Favors drafts, uneven temperatures, hot water and noise.",
  appearance: "Favors what you see every day, inside and out.",
  resale: "Favors what buyers and inspectors actually react to.",
  balanced: "No axis is weighted above the others.",
}

// --- Condition --------------------------------------------------------------

export type Condition = "unknown" | "good" | "fair" | "poor" | "failing"

export const CONDITION_LABELS: Record<Condition, string> = {
  unknown: "Not sure",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
  failing: "Failing",
}

/** Condition stretches or shortens the published service life. */
const CONDITION_LIFE_FACTOR: Record<Condition, number> = {
  unknown: 1,
  good: 1.15,
  fair: 0.9,
  poor: 0.6,
  failing: 0.25,
}

const CONDITION_URGENCY: Record<Condition, number> = {
  unknown: 6,
  good: 0,
  fair: 8,
  poor: 20,
  failing: 30,
}

// --- Components -------------------------------------------------------------

export type ComponentId =
  | "roof"
  | "hvac"
  | "waterHeater"
  | "plumbing"
  | "electrical"
  | "foundation"
  | "windows"
  | "doors"
  | "insulation"
  | "siding"
  | "gutters"
  | "drainage"
  | "appliances"
  | "flooring"
  | "kitchen"
  | "bathroom"
  | "basement"
  | "garage"
  | "exterior"
  | "landscaping"

export type ComponentGroup = "systems" | "envelope" | "site" | "interior"

export const GROUP_LABELS: Record<ComponentGroup, string> = {
  systems: "Systems & safety",
  envelope: "Structure & envelope",
  site: "Exterior & site",
  interior: "Interior & living space",
}

export const GROUP_ORDER: ComponentGroup[] = ["systems", "envelope", "site", "interior"]

export type Symptom = {
  id: string
  label: string
  /** 1 = cosmetic, 2 = real problem, 3 = active damage or hazard. */
  severity: 1 | 2 | 3
  /** Safety-relevant: gas, electrical, structural, sewage. */
  safety?: boolean
  /** Warrants a licensed professional looking at it. */
  inspect?: boolean
}

/** Geometry derived once from home size, used by the cost formulas. */
export type HomeGeometry = {
  finishedSqft: number
  footprintSqft: number
  roofSqft: number
  wallSqft: number
  perimeterFt: number
  windowCount: number
}

export type CostRange = { low: number; high: number }

export type ComponentDef = {
  id: ComponentId
  label: string
  group: ComponentGroup
  /** What the age question is actually asking about. */
  ageLabel: string
  /** Typical service life in years for the most common material/equipment. */
  typicalLife: number
  lifeNote: string
  /** National replacement/upgrade cost before the regional index. */
  cost: (g: HomeGeometry) => CostRange
  costNote: string
  /** Rough annual utility saving from upgrading, national midpoint. */
  annualEnergySavings: number
  /** 0-3, how much upgrading changes day-to-day comfort. */
  comfortGain: 0 | 1 | 2 | 3
  /** Share of spend typically recovered at resale. */
  resaleRecovery: number
  /** What waiting tends to turn into, and the rough cost of that damage. */
  cascade?: { label: string; addedCost: number }
  /** Gas, electrical, structural or water-intrusion relevance. */
  safetyCritical?: boolean
  /** Shown whenever this component lands in the plan at all. */
  inspectionNote?: string
  symptoms: Symptom[]
}

// Cost figures are national midpoints for a like-for-like replacement, and are
// multiplied by the regional index before display.
export const COMPONENTS: ComponentDef[] = [
  {
    id: "roof",
    label: "Roof",
    group: "envelope",
    ageLabel: "Age of the current roof",
    typicalLife: 22,
    lifeNote: "Asphalt shingles typically last 20–25 years; metal and tile last far longer.",
    cost: (g) => ({ low: g.roofSqft * 5.5, high: g.roofSqft * 9.5 }),
    costNote: "Tear-off and replace, asphalt shingles, based on roof area including pitch.",
    annualEnergySavings: 60,
    comfortGain: 1,
    resaleRecovery: 0.65,
    cascade: { label: "sheathing rot, insulation damage and interior ceiling repair", addedCost: 6000 },
    safetyCritical: true,
    inspectionNote:
      "Roof condition is hard to judge from the ground. A roofer or home inspector can tell you whether you have years left or months.",
    symptoms: [
      { id: "leak", label: "Active leak or water stain on a ceiling", severity: 3, safety: true, inspect: true },
      { id: "missing", label: "Missing, curling or cracked shingles", severity: 2 },
      { id: "granules", label: "Granules collecting in the gutters", severity: 2 },
      { id: "sag", label: "Visible sagging or a soft spot in the deck", severity: 3, safety: true, inspect: true },
      { id: "flashing", label: "Rusted or lifting flashing around vents and chimneys", severity: 2 },
      { id: "moss", label: "Moss or algae growth", severity: 1 },
    ],
  },
  {
    id: "hvac",
    label: "Heating & cooling (HVAC)",
    group: "systems",
    ageLabel: "Age of the furnace or air handler",
    typicalLife: 18,
    lifeNote: "Furnaces run 15–20 years; air conditioners and heat pumps 12–17.",
    cost: (g) => {
      const tons = Math.max(1.5, g.finishedSqft / 600)
      return { low: 4200 + tons * 900, high: 8200 + tons * 2100 }
    },
    costNote: "Replacement system sized at roughly one ton per 600 sq ft of conditioned space.",
    annualEnergySavings: 340,
    comfortGain: 3,
    resaleRecovery: 0.5,
    cascade: { label: "an emergency replacement at peak-season pricing", addedCost: 2200 },
    safetyCritical: true,
    inspectionNote:
      "Any suspicion of a cracked heat exchanger or a carbon monoxide symptom is an immediate call to an HVAC technician, not a planning item.",
    symptoms: [
      { id: "noheat", label: "Struggles to keep up in extreme weather", severity: 2 },
      { id: "uneven", label: "Some rooms much hotter or colder than others", severity: 2 },
      { id: "shortcycle", label: "Turns on and off constantly", severity: 2, inspect: true },
      { id: "noise", label: "Loud banging, grinding or squealing", severity: 2, inspect: true },
      { id: "smell", label: "Burning or gas smell when running", severity: 3, safety: true, inspect: true },
      { id: "repairs", label: "Needed repairs more than once in the last two years", severity: 2 },
      { id: "r22", label: "Uses R-22 refrigerant (pre-2010 system)", severity: 2 },
    ],
  },
  {
    id: "waterHeater",
    label: "Water heater",
    group: "systems",
    ageLabel: "Age of the water heater",
    typicalLife: 11,
    lifeNote: "Tank water heaters typically last 8–12 years; tankless units 18–20.",
    cost: () => ({ low: 1400, high: 3400 }),
    costNote: "Like-for-like tank replacement including permit and haul-away.",
    annualEnergySavings: 110,
    comfortGain: 2,
    resaleRecovery: 0.45,
    cascade: { label: "a tank failure that floods the surrounding floor", addedCost: 4500 },
    safetyCritical: true,
    symptoms: [
      { id: "rusty", label: "Rusty or discolored hot water", severity: 3, inspect: true },
      { id: "runsout", label: "Runs out of hot water quickly", severity: 2 },
      { id: "leaking", label: "Moisture or rust at the base of the tank", severity: 3, safety: true, inspect: true },
      { id: "popping", label: "Popping or rumbling noises", severity: 2 },
      { id: "pilot", label: "Pilot light or burner problems", severity: 2, safety: true, inspect: true },
    ],
  },
  {
    id: "plumbing",
    label: "Plumbing & supply lines",
    group: "systems",
    ageLabel: "Age of the supply plumbing",
    typicalLife: 55,
    lifeNote:
      "Copper and PEX last 50+ years. Galvanized steel and polybutylene are known failure risks regardless of how they look.",
    cost: (g) => ({ low: 3500 + g.finishedSqft * 1.6, high: 8000 + g.finishedSqft * 4.5 }),
    costNote: "Partial to whole-home repipe, including drywall patching.",
    annualEnergySavings: 0,
    comfortGain: 2,
    resaleRecovery: 0.5,
    cascade: { label: "a burst line and the water damage that follows", addedCost: 9000 },
    safetyCritical: true,
    inspectionNote:
      "If you do not know what material your supply lines are, a plumber can identify them in a single visit — it changes the answer completely.",
    symptoms: [
      { id: "pressure", label: "Low or falling water pressure", severity: 2 },
      { id: "discolored", label: "Brown or metallic-tasting water", severity: 3, inspect: true },
      { id: "leaks", label: "Recurring leaks or past pipe repairs", severity: 3, inspect: true },
      { id: "galvanized", label: "Galvanized steel or polybutylene pipe", severity: 3, safety: true, inspect: true },
      { id: "sewer", label: "Slow drains throughout the house or sewer smell", severity: 3, safety: true, inspect: true },
    ],
  },
  {
    id: "electrical",
    label: "Electrical system",
    group: "systems",
    ageLabel: "Age of the panel and wiring",
    typicalLife: 40,
    lifeNote:
      "Panels last 25–40 years. Certain vintages (Federal Pacific, Zinsco) and knob-and-tube wiring are hazards at any age.",
    cost: (g) => ({ low: 2000, high: 4500 + g.finishedSqft * 2.4 }),
    costNote: "Panel replacement, with the upper end covering partial rewiring and added circuits.",
    annualEnergySavings: 0,
    comfortGain: 1,
    resaleRecovery: 0.5,
    cascade: { label: "fire risk and failed insurance or resale inspections", addedCost: 0 },
    safetyCritical: true,
    inspectionNote:
      "Electrical hazards are not a monitor-and-see item. A licensed electrician should evaluate anything you flag here.",
    symptoms: [
      { id: "breakers", label: "Breakers trip regularly", severity: 3, safety: true, inspect: true },
      { id: "flicker", label: "Lights flicker or dim when appliances start", severity: 2, inspect: true },
      { id: "warm", label: "Warm outlets, scorch marks or burning smell", severity: 3, safety: true, inspect: true },
      { id: "twoprong", label: "Two-prong outlets or no GFCI in wet areas", severity: 2, safety: true },
      { id: "fusebox", label: "Fuse box rather than breakers", severity: 3, safety: true, inspect: true },
      { id: "knobtube", label: "Knob-and-tube or aluminum branch wiring", severity: 3, safety: true, inspect: true },
      { id: "capacity", label: "100-amp service or less, with modern loads", severity: 2 },
    ],
  },
  {
    id: "foundation",
    label: "Foundation & structure",
    group: "envelope",
    ageLabel: "Age of the home's structure",
    typicalLife: 100,
    lifeNote: "Foundations are not on a replacement clock — they are judged entirely on movement and water.",
    cost: () => ({ low: 2500, high: 14000 }),
    costNote: "Crack repair through pier or underpinning work; severe movement runs well beyond this.",
    annualEnergySavings: 0,
    comfortGain: 1,
    resaleRecovery: 0.55,
    cascade: { label: "progressive movement affecting framing, drywall and windows", addedCost: 12000 },
    safetyCritical: true,
    inspectionNote:
      "Foundation questions need a structural engineer, not a contractor bidding a repair. This tool cannot assess structural movement.",
    symptoms: [
      { id: "cracks", label: "Cracks wider than a quarter inch", severity: 3, safety: true, inspect: true },
      { id: "stairstep", label: "Stair-step cracks in brick or block", severity: 3, safety: true, inspect: true },
      { id: "sticking", label: "Doors and windows sticking or out of square", severity: 2, inspect: true },
      { id: "sloping", label: "Sloping or bouncy floors", severity: 3, safety: true, inspect: true },
      { id: "damp", label: "Water seeping through foundation walls", severity: 3, inspect: true },
    ],
  },
  {
    id: "windows",
    label: "Windows",
    group: "envelope",
    ageLabel: "Age of most of the windows",
    typicalLife: 25,
    lifeNote: "Vinyl and clad windows last 20–30 years; the seals usually fail before the frames.",
    cost: (g) => ({ low: g.windowCount * 450, high: g.windowCount * 1250 }),
    costNote: "Full-frame replacement priced per opening, estimated from home size.",
    annualEnergySavings: 240,
    comfortGain: 3,
    resaleRecovery: 0.65,
    symptoms: [
      { id: "drafty", label: "Noticeably drafty in winter", severity: 2 },
      { id: "fog", label: "Fogging or moisture between the panes", severity: 2 },
      { id: "single", label: "Single-pane glass", severity: 2 },
      { id: "stuck", label: "Painted shut, stuck or will not stay open", severity: 2 },
      { id: "rot", label: "Rotting or soft frames and sills", severity: 3, inspect: true },
      { id: "condensation", label: "Condensation pooling on the inside", severity: 2 },
    ],
  },
  {
    id: "doors",
    label: "Exterior doors",
    group: "envelope",
    ageLabel: "Age of the exterior doors",
    typicalLife: 28,
    lifeNote: "Steel and fiberglass doors last 25–30 years; weatherstripping fails much sooner.",
    cost: () => ({ low: 1200, high: 4200 }),
    costNote: "Two to three exterior doors, installed, including trim and hardware.",
    annualEnergySavings: 70,
    comfortGain: 2,
    resaleRecovery: 0.7,
    symptoms: [
      { id: "draft", label: "Daylight or draft around the closed door", severity: 2 },
      { id: "sticking", label: "Sticks, drags or will not latch cleanly", severity: 2 },
      { id: "rot", label: "Rot at the bottom of the door or frame", severity: 3 },
      { id: "security", label: "Weak lock or hollow slab on an exterior opening", severity: 2, safety: true },
    ],
  },
  {
    id: "insulation",
    label: "Insulation & air sealing",
    group: "envelope",
    ageLabel: "Age of the insulation",
    typicalLife: 45,
    lifeNote:
      "Insulation does not wear out, but pre-1990 homes are usually well below current recommended attic levels.",
    cost: (g) => ({ low: g.footprintSqft * 1.4, high: g.footprintSqft * 3.4 }),
    costNote: "Attic air sealing plus topping up to modern R-values, priced on attic floor area.",
    annualEnergySavings: 320,
    comfortGain: 3,
    resaleRecovery: 0.35,
    symptoms: [
      { id: "cold", label: "Rooms hard to keep warm or cool", severity: 2 },
      { id: "icedam", label: "Ice dams on the roof edge in winter", severity: 3 },
      { id: "thin", label: "Attic insulation visibly thin or patchy", severity: 2 },
      { id: "bills", label: "Utility bills high for the size of the home", severity: 2 },
      { id: "draftyfloor", label: "Cold floors over a crawlspace or garage", severity: 2 },
    ],
  },
  {
    id: "siding",
    label: "Siding & exterior cladding",
    group: "envelope",
    ageLabel: "Age of the siding",
    typicalLife: 30,
    lifeNote: "Vinyl lasts 25–40 years, fiber cement 30–50, wood needs repainting every 5–8.",
    cost: (g) => ({ low: g.wallSqft * 5.5, high: g.wallSqft * 13 }),
    costNote: "Replacement cladding with house wrap, priced on estimated wall area.",
    annualEnergySavings: 120,
    comfortGain: 1,
    resaleRecovery: 0.7,
    cascade: { label: "water getting behind the cladding and rotting sheathing", addedCost: 7000 },
    symptoms: [
      { id: "rot", label: "Soft, rotting or crumbling sections", severity: 3, inspect: true },
      { id: "gaps", label: "Gaps, buckling or loose panels", severity: 2 },
      { id: "paint", label: "Peeling paint or exposed bare wood", severity: 2 },
      { id: "pests", label: "Evidence of insects or woodpecker damage", severity: 2, inspect: true },
      { id: "faded", label: "Faded or dated but sound", severity: 1 },
    ],
  },
  {
    id: "gutters",
    label: "Gutters & downspouts",
    group: "site",
    ageLabel: "Age of the gutters",
    typicalLife: 22,
    lifeNote: "Aluminum gutters last about 20 years; the hangers and seams usually fail first.",
    cost: (g) => ({ low: g.perimeterFt * 8, high: g.perimeterFt * 20 }),
    costNote: "Replacement seamless gutters and downspouts, priced per linear foot of roof edge.",
    annualEnergySavings: 0,
    comfortGain: 0,
    resaleRecovery: 0.6,
    cascade: { label: "water dumping at the foundation, which is how basement and settling problems start", addedCost: 8000 },
    symptoms: [
      { id: "overflow", label: "Overflow or waterfalls during rain", severity: 2 },
      { id: "sag", label: "Sagging or pulling away from the fascia", severity: 2 },
      { id: "leakseam", label: "Leaking seams or joints", severity: 2 },
      { id: "nodownspout", label: "Downspouts discharge right next to the foundation", severity: 3 },
      { id: "none", label: "Missing gutters on part of the house", severity: 2 },
    ],
  },
  {
    id: "drainage",
    label: "Grading & drainage",
    group: "site",
    ageLabel: "Years since drainage work",
    typicalLife: 40,
    lifeNote: "Grading is judged by where water goes, not by age.",
    cost: () => ({ low: 2200, high: 11000 }),
    costNote: "Regrading, French drain or dry well work; interior systems cost more.",
    annualEnergySavings: 0,
    comfortGain: 1,
    resaleRecovery: 0.55,
    cascade: { label: "chronic water in the basement or crawlspace and eventual foundation work", addedCost: 12000 },
    safetyCritical: true,
    symptoms: [
      { id: "pooling", label: "Water pools near the foundation after rain", severity: 3 },
      { id: "wetbasement", label: "Damp or wet basement or crawlspace", severity: 3, inspect: true },
      { id: "slope", label: "Ground slopes toward the house", severity: 2 },
      { id: "erosion", label: "Visible erosion or washed-out mulch", severity: 2 },
      { id: "sump", label: "Sump pump runs constantly", severity: 2, inspect: true },
    ],
  },
  {
    id: "appliances",
    label: "Major appliances",
    group: "interior",
    ageLabel: "Age of most appliances",
    typicalLife: 13,
    lifeNote: "Most large appliances last 10–15 years; refrigerators and ranges a little longer.",
    cost: () => ({ low: 2600, high: 8500 }),
    costNote: "Replacing the main set — refrigerator, range, dishwasher, laundry — not all at once.",
    annualEnergySavings: 130,
    comfortGain: 1,
    resaleRecovery: 0.4,
    symptoms: [
      { id: "failing", label: "Something has already stopped working", severity: 2 },
      { id: "repairs", label: "Repaired more than once recently", severity: 2 },
      { id: "loud", label: "Getting noticeably louder or less effective", severity: 1 },
      { id: "old", label: "Pre-2005 units still in service", severity: 1 },
    ],
  },
  {
    id: "flooring",
    label: "Flooring",
    group: "interior",
    ageLabel: "Age of the main flooring",
    typicalLife: 22,
    lifeNote: "Carpet lasts 8–12 years, laminate 15–25, hardwood indefinitely with refinishing.",
    cost: (g) => ({ low: g.finishedSqft * 0.6 * 4, high: g.finishedSqft * 0.6 * 13 }),
    costNote: "Replacing roughly 60% of the finished floor area, materials and installation.",
    annualEnergySavings: 0,
    comfortGain: 2,
    resaleRecovery: 0.7,
    symptoms: [
      { id: "worn", label: "Worn through, stained or dated", severity: 1 },
      { id: "soft", label: "Soft spots or movement underfoot", severity: 3, inspect: true },
      { id: "water", label: "Water damage, buckling or cupping", severity: 3, inspect: true },
      { id: "trip", label: "Lifting edges or transitions that catch a foot", severity: 2, safety: true },
      { id: "smell", label: "Persistent pet or musty odor in the carpet", severity: 2 },
    ],
  },
  {
    id: "kitchen",
    label: "Kitchen",
    group: "interior",
    ageLabel: "Years since the kitchen was updated",
    typicalLife: 25,
    lifeNote: "Kitchens are replaced on taste and function, not failure — most get reworked every 20–30 years.",
    cost: () => ({ low: 16000, high: 45000 }),
    costNote: "Midrange remodel keeping the existing layout; moving plumbing raises this sharply.",
    annualEnergySavings: 0,
    comfortGain: 2,
    resaleRecovery: 0.6,
    symptoms: [
      { id: "layout", label: "Layout does not work for how you cook", severity: 1 },
      { id: "cabinets", label: "Cabinets damaged, sagging or delaminating", severity: 2 },
      { id: "counter", label: "Counters worn, burned or cracked", severity: 1 },
      { id: "waterdamage", label: "Water damage under the sink", severity: 3, inspect: true },
      { id: "dated", label: "Cosmetically dated but fully functional", severity: 1 },
    ],
  },
  {
    id: "bathroom",
    label: "Bathrooms",
    group: "interior",
    ageLabel: "Years since a bathroom was updated",
    typicalLife: 25,
    lifeNote: "Bathroom finishes last 20–30 years; the waterproofing behind them is what actually matters.",
    cost: () => ({ low: 9000, high: 28000 }),
    costNote: "One full bathroom remodel in the same footprint.",
    annualEnergySavings: 40,
    comfortGain: 2,
    resaleRecovery: 0.6,
    cascade: { label: "a hidden leak rotting the subfloor and framing", addedCost: 6000 },
    symptoms: [
      { id: "grout", label: "Failing grout, loose tile or soft floor near the tub", severity: 3, inspect: true },
      { id: "mold", label: "Recurring mold or mildew", severity: 2 },
      { id: "fan", label: "No working exhaust fan", severity: 2 },
      { id: "fixtures", label: "Fixtures leaking or badly worn", severity: 2 },
      { id: "dated", label: "Dated but working", severity: 1 },
    ],
  },
  {
    id: "basement",
    label: "Basement or crawlspace",
    group: "interior",
    ageLabel: "Years since basement work",
    typicalLife: 40,
    lifeNote: "Judged on moisture and air quality rather than age.",
    cost: () => ({ low: 4000, high: 22000 }),
    costNote: "Waterproofing and encapsulation at the low end, full finishing at the high end.",
    annualEnergySavings: 90,
    comfortGain: 2,
    resaleRecovery: 0.6,
    cascade: { label: "mold remediation and damage to anything stored down there", addedCost: 5000 },
    symptoms: [
      { id: "water", label: "Water intrusion or past flooding", severity: 3, inspect: true },
      { id: "musty", label: "Musty smell or visible mold", severity: 3, inspect: true },
      { id: "humid", label: "Persistently humid or condensation on surfaces", severity: 2 },
      { id: "pests", label: "Evidence of pests or rodents", severity: 2 },
      { id: "unfinished", label: "Unfinished but dry and sound", severity: 1 },
    ],
  },
  {
    id: "garage",
    label: "Garage & garage door",
    group: "site",
    ageLabel: "Age of the garage door and opener",
    typicalLife: 22,
    lifeNote: "Garage doors last about 20–25 years; openers and springs fail sooner.",
    cost: () => ({ low: 1300, high: 4800 }),
    costNote: "New insulated door and opener, installed.",
    annualEnergySavings: 40,
    comfortGain: 1,
    resaleRecovery: 0.9,
    symptoms: [
      { id: "noreverse", label: "Auto-reverse safety feature does not work", severity: 3, safety: true, inspect: true },
      { id: "loud", label: "Very loud, jerky or slow operation", severity: 2 },
      { id: "dents", label: "Dented, rotting or sagging panels", severity: 2 },
      { id: "uninsulated", label: "Uninsulated door on an attached garage", severity: 1 },
    ],
  },
  {
    id: "exterior",
    label: "Exterior paint & trim",
    group: "site",
    ageLabel: "Years since the exterior was painted",
    typicalLife: 8,
    lifeNote: "Exterior paint lasts 5–10 years depending on exposure and prep.",
    cost: (g) => ({ low: g.wallSqft * 1.6, high: g.wallSqft * 4.2 }),
    costNote: "Prep, prime and two coats on the estimated wall area, including trim.",
    annualEnergySavings: 0,
    comfortGain: 0,
    resaleRecovery: 0.8,
    cascade: { label: "bare wood absorbing water and rotting trim", addedCost: 3500 },
    symptoms: [
      { id: "peeling", label: "Peeling, blistering or chalking paint", severity: 2 },
      { id: "bare", label: "Bare wood showing", severity: 3 },
      { id: "caulk", label: "Failed caulk around trim and penetrations", severity: 2 },
      { id: "faded", label: "Faded or dated color", severity: 1 },
    ],
  },
  {
    id: "landscaping",
    label: "Landscaping & curb appeal",
    group: "site",
    ageLabel: "Years since landscaping work",
    typicalLife: 15,
    lifeNote: "Plantings mature and decline over 10–20 years; hardscape lasts much longer.",
    cost: () => ({ low: 3500, high: 18000 }),
    costNote: "Lawn, beds, plantings and light hardscape refresh.",
    annualEnergySavings: 0,
    comfortGain: 1,
    resaleRecovery: 0.9,
    symptoms: [
      { id: "overgrown", label: "Overgrown or dead plantings", severity: 1 },
      { id: "treehouse", label: "Tree limbs overhanging the roof", severity: 3, inspect: true },
      { id: "roots", label: "Roots near the foundation, walk or sewer line", severity: 2, inspect: true },
      { id: "bare", label: "Bare or patchy lawn", severity: 1 },
      { id: "hardscape", label: "Cracked or uneven walkways and steps", severity: 2, safety: true },
    ],
  },
]

export const COMPONENT_BY_ID: Record<ComponentId, ComponentDef> = COMPONENTS.reduce(
  (acc, c) => {
    acc[c.id] = c
    return acc
  },
  {} as Record<ComponentId, ComponentDef>,
)

// --- Inputs -----------------------------------------------------------------

export type ComponentState = {
  assessed: boolean
  /** Blank means "use the home's age", which we flag as an assumption. */
  age: string
  condition: Condition
  symptoms: string[]
  recentRepair: boolean
}

export function initialComponentState(): Record<ComponentId, ComponentState> {
  return COMPONENTS.reduce(
    (acc, c) => {
      acc[c.id] = { assessed: false, age: "", condition: "unknown", symptoms: [], recentRepair: false }
      return acc
    },
    {} as Record<ComponentId, ComponentState>,
  )
}

export type AdvisorInputs = {
  zip: string
  yearBuilt: number
  homeSize: number
  stories: number
  yearsStaying: number
  budget: number
  priority: Priority
  components: Record<ComponentId, ComponentState>
}

// --- Verdicts ---------------------------------------------------------------

export type Verdict = "repair-now" | "replace-soon" | "monitor" | "upgrade" | "none"

export const VERDICT_META: Record<
  Verdict,
  { label: string; blurb: string; tone: "critical" | "warn" | "watch" | "opportunity" | "calm" }
> = {
  "repair-now": {
    label: "Repair now",
    blurb: "Active damage or a safety issue. Every month of waiting makes this more expensive.",
    tone: "critical",
  },
  "replace-soon": {
    label: "Replace soon",
    blurb: "At or near the end of its service life. Plan and budget it rather than waiting for failure.",
    tone: "warn",
  },
  monitor: {
    label: "Monitor",
    blurb: "Aging or showing early signs. Check it seasonally and be ready in a few years.",
    tone: "watch",
  },
  upgrade: {
    label: "Upgrade when convenient",
    blurb: "Nothing is wrong. This is a comfort, efficiency or value improvement on your timeline.",
    tone: "opportunity",
  },
  none: {
    label: "No action needed",
    blurb: "Sound and well within its expected life.",
    tone: "calm",
  },
}

export const VERDICT_ORDER: Verdict[] = ["repair-now", "replace-soon", "monitor", "upgrade", "none"]

export type RiskLevel = "high" | "moderate" | "low" | "none"

export type Assessment = {
  id: ComponentId
  label: string
  group: ComponentGroup
  verdict: Verdict
  urgency: number
  /** Years of expected life left; null when age is unknown. */
  remainingLife: number | null
  ageUsed: number
  ageInferred: boolean
  risk: { level: RiskLevel; text: string }
  cost: CostRange
  annualSavings: number
  paybackYears: number | null
  comfortGain: number
  resaleValueAdd: number
  resaleRecovery: number
  /** Plain-language reasons, generated from the actual inputs. */
  why: string[]
  inspection: string | null
  costNote: string
}

// --- Scenarios --------------------------------------------------------------

export type ScenarioId = "lowest" | "protect" | "energy" | "resale" | "fiveYear"

export type ScenarioPhase = { label: string; ids: ComponentId[]; cost: CostRange }

export type Scenario = {
  id: ScenarioId
  label: string
  question: string
  blurb: string
  ids: ComponentId[]
  cost: CostRange
  annualSavings: number
  valueAdd: number
  phases?: ScenarioPhase[]
  /** null when no budget was entered. */
  fitsBudget: boolean | null
}

export type AdvisorResult = {
  region: ResolvedRegion
  geometry: HomeGeometry
  homeAge: number
  assessments: Assessment[]
  byVerdict: Record<Verdict, Assessment[]>
  scenarios: Scenario[]
  inspectionCount: number
  totals: { immediate: CostRange; all: CostRange; annualSavings: number; valueAdd: number }
  assessedCount: number
  isEmpty: boolean
}

// --- Helpers ----------------------------------------------------------------

const CURRENT_YEAR = new Date().getFullYear()

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

export function deriveGeometry(homeSize: number, stories: number): HomeGeometry {
  const finished = Math.max(300, homeSize || 1800)
  const levels = Math.max(1, stories || 1)
  const footprint = finished / levels
  // A square-ish footprint is a reasonable proxy for perimeter.
  const side = Math.sqrt(footprint)
  const perimeter = side * 4
  return {
    finishedSqft: Math.round(finished),
    footprintSqft: Math.round(footprint),
    // 1.3 accounts for a typical roof pitch plus overhang.
    roofSqft: Math.round(footprint * 1.3),
    wallSqft: Math.round(perimeter * 9 * levels),
    perimeterFt: Math.round(perimeter),
    // Roughly one window per 120 sq ft of finished space.
    windowCount: Math.max(4, Math.round(finished / 120)),
  }
}

/** Priority nudges — small, so they reorder ties without inventing urgency. */
function priorityBoost(def: ComponentDef, priority: Priority, maxSeverity: number): number {
  switch (priority) {
    case "safety":
      return def.safetyCritical ? 7 : 0
    case "repairs":
      return def.cascade ? 6 : 0
    case "energy":
      return def.annualEnergySavings >= 150 ? 6 : def.annualEnergySavings > 0 ? 3 : 0
    case "comfort":
      return def.comfortGain >= 2 ? 5 : 0
    case "appearance":
      return def.resaleRecovery >= 0.7 && maxSeverity <= 2 ? 5 : 0
    case "resale":
      return def.resaleRecovery >= 0.6 ? 5 : 0
    default:
      return 0
  }
}

function lifeUrgency(remaining: number | null): number {
  if (remaining === null) return 24
  if (remaining <= 0) return 60
  if (remaining <= 2) return 48
  if (remaining <= 5) return 33
  if (remaining <= 10) return 19
  return 7
}

function riskFor(def: ComponentDef, maxSeverity: number, remaining: number | null): Assessment["risk"] {
  if (!def.cascade) {
    if (maxSeverity >= 3) {
      return { level: "moderate", text: "Left alone, the problem you described will keep getting worse." }
    }
    return { level: "low", text: "Waiting mainly costs you comfort or appearance, not money." }
  }
  const soon = remaining !== null && remaining <= 2
  if (maxSeverity >= 3) {
    return {
      level: "high",
      text: `Damage is already happening. Waiting risks ${def.cascade.label}, which typically adds ${formatMoney(def.cascade.addedCost)} to the job.`,
    }
  }
  if (maxSeverity === 2 || soon) {
    return {
      level: "moderate",
      text: `If this fails before you replace it, expect ${def.cascade.label} on top of the base cost.`,
    }
  }
  return {
    level: "low",
    text: `Low for now, but this is the kind of component where failure causes ${def.cascade.label}.`,
  }
}

export function formatMoney(n: number): string {
  if (!Number.isFinite(n)) return "$0"
  if (n >= 1000) return `$${Math.round(n / 100) / 10}k`.replace(".0k", "k")
  return `$${Math.round(n)}`
}

// --- The engine -------------------------------------------------------------

export function computeAdvice(inputs: AdvisorInputs): AdvisorResult {
  const region = resolveRegion(inputs.zip)
  const geometry = deriveGeometry(inputs.homeSize, inputs.stories)
  const homeAge = clamp(CURRENT_YEAR - (inputs.yearBuilt || CURRENT_YEAR - 30), 0, 200)
  const staying = clamp(inputs.yearsStaying || 7, 0, 40)

  const assessments: Assessment[] = []

  for (const def of COMPONENTS) {
    const state = inputs.components[def.id]
    if (!state?.assessed) continue

    // --- age and remaining life
    const parsedAge = Number.parseFloat(state.age)
    const ageInferred = !(Number.isFinite(parsedAge) && parsedAge >= 0)
    const ageUsed = ageInferred ? homeAge : clamp(parsedAge, 0, 200)

    const symptoms = def.symptoms.filter((s) => state.symptoms.includes(s.id))
    const maxSeverity = symptoms.reduce((m, s) => Math.max(m, s.severity), 0)
    const hasSafety = symptoms.some((s) => s.safety)
    const needsInspection = symptoms.some((s) => s.inspect) || state.condition === "failing"

    const effectiveLife = def.typicalLife * CONDITION_LIFE_FACTOR[state.condition]
    const remainingRaw = effectiveLife - ageUsed
    // Age is only meaningful for components on a real service clock.
    const remainingLife =
      state.condition === "unknown" && ageInferred ? null : Math.round(clamp(remainingRaw, 0, 60))

    // --- urgency
    let urgency = lifeUrgency(remainingLife)
    urgency += CONDITION_URGENCY[state.condition]
    if (maxSeverity > 0) urgency += maxSeverity * 11 + Math.min(2, symptoms.length - 1) * 4
    if (hasSafety) urgency += 13
    if (def.cascade && (maxSeverity >= 2 || (remainingLife !== null && remainingLife <= 2))) urgency += 7
    urgency += priorityBoost(def, inputs.priority, maxSeverity)
    // A recent repair buys time on anything not actively failing.
    if (state.recentRepair && state.condition !== "failing" && maxSeverity < 3) urgency -= 8
    urgency = Math.round(clamp(urgency, 0, 100))

    // --- money
    const base = def.cost(geometry)
    const cost = {
      low: Math.round((base.low * region.index) / 50) * 50,
      high: Math.round((base.high * region.index) / 50) * 50,
    }
    const mid = (cost.low + cost.high) / 2
    const annualSavings = Math.round(def.annualEnergySavings * region.index)
    const paybackYears = annualSavings > 0 ? Math.round((mid / annualSavings) * 10) / 10 : null
    const resaleValueAdd = Math.round((mid * def.resaleRecovery) / 100) * 100

    // --- verdict
    const activeDamage = maxSeverity >= 3 || hasSafety || state.condition === "failing"
    const hasUpside = annualSavings > 0 || def.comfortGain >= 2 || def.resaleRecovery >= 0.6
    let verdict: Verdict
    if (urgency >= 70) verdict = activeDamage ? "repair-now" : "replace-soon"
    else if (urgency >= 52) verdict = activeDamage ? "repair-now" : "replace-soon"
    else if (urgency >= 33) verdict = "monitor"
    else if (hasUpside && urgency >= 16) verdict = "upgrade"
    else verdict = "none"

    // --- explanation, built from the inputs that actually moved the needle
    const why: string[] = []
    if (symptoms.length > 0) {
      const names = symptoms.map((s) => s.label.toLowerCase())
      why.push(
        `You reported ${names.slice(0, 2).join(" and ")}${names.length > 2 ? ` (plus ${names.length - 2} more)` : ""}. ${
          maxSeverity >= 3
            ? "That is active damage, not wear, which is why this sits at the top."
            : "Those are early warning signs rather than failure."
        }`,
      )
    }
    if (remainingLife === null) {
      why.push(
        `Age and condition are unknown, so this is ranked on typical behavior only. ${def.lifeNote} Filling in the age will sharpen this considerably.`,
      )
    } else if (remainingLife <= 0) {
      why.push(
        `At ${Math.round(ageUsed)} years${ageInferred ? " (assumed original to the house)" : ""}, it is past the ${def.typicalLife}-year service life typical for this component. ${def.lifeNote}`,
      )
    } else {
      why.push(
        `At ${Math.round(ageUsed)} years${ageInferred ? " (assumed original to the house)" : ""}, roughly ${remainingLife} year${remainingLife === 1 ? "" : "s"} of expected life remain. ${def.lifeNote}`,
      )
    }
    if (state.recentRepair && state.condition !== "failing" && maxSeverity < 3) {
      why.push("You noted a recent repair, which lowers the urgency here relative to its age alone.")
    }
    if (annualSavings > 0 && paybackYears !== null) {
      why.push(
        paybackYears <= staying
          ? `Around ${formatMoney(annualSavings)} a year in energy savings pays this back in about ${paybackYears} years — inside the ${staying} years you expect to stay.`
          : `Energy savings of about ${formatMoney(annualSavings)} a year take roughly ${paybackYears} years to pay back, longer than the ${staying} years you plan to stay, so treat the savings as a bonus rather than the reason.`,
      )
    }
    if (def.resaleRecovery >= 0.6 && staying <= 3) {
      why.push(
        `Since you are moving within ${staying} year${staying === 1 ? "" : "s"}, this matters: it typically returns about ${Math.round(def.resaleRecovery * 100)}% of its cost at resale, and it is the kind of thing buyers notice.`,
      )
    }

    assessments.push({
      id: def.id,
      label: def.label,
      group: def.group,
      verdict,
      urgency,
      remainingLife,
      ageUsed: Math.round(ageUsed),
      ageInferred,
      risk: riskFor(def, maxSeverity, remainingLife),
      cost,
      annualSavings,
      paybackYears,
      comfortGain: def.comfortGain,
      resaleValueAdd,
      resaleRecovery: def.resaleRecovery,
      why,
      inspection: needsInspection ? (def.inspectionNote ?? "What you described is worth having a licensed pro look at before you commit to a scope of work.") : null,
      costNote: def.costNote,
    })
  }

  assessments.sort((a, b) => b.urgency - a.urgency || b.resaleValueAdd - a.resaleValueAdd)

  const byVerdict = VERDICT_ORDER.reduce(
    (acc, v) => {
      acc[v] = assessments.filter((a) => a.verdict === v)
      return acc
    },
    {} as Record<Verdict, Assessment[]>,
  )

  const sum = (items: Assessment[]): CostRange => ({
    low: items.reduce((n, a) => n + a.cost.low, 0),
    high: items.reduce((n, a) => n + a.cost.high, 0),
  })

  const immediate = [...byVerdict["repair-now"], ...byVerdict["replace-soon"]]
  const scenarios = buildScenarios(assessments, byVerdict, inputs.budget, staying)

  return {
    region,
    geometry,
    homeAge,
    assessments,
    byVerdict,
    scenarios,
    inspectionCount: assessments.filter((a) => a.inspection).length,
    totals: {
      immediate: sum(immediate),
      all: sum(assessments),
      annualSavings: assessments.reduce((n, a) => n + a.annualSavings, 0),
      valueAdd: assessments.reduce((n, a) => n + a.resaleValueAdd, 0),
    },
    assessedCount: assessments.length,
    isEmpty: assessments.length === 0,
  }
}

function buildScenarios(
  all: Assessment[],
  byVerdict: Record<Verdict, Assessment[]>,
  budget: number,
  staying: number,
): Scenario[] {
  const pick = (items: Assessment[]) => items.map((a) => a.id)
  const cost = (items: Assessment[]): CostRange => ({
    low: items.reduce((n, a) => n + a.cost.low, 0),
    high: items.reduce((n, a) => n + a.cost.high, 0),
  })
  const savings = (items: Assessment[]) => items.reduce((n, a) => n + a.annualSavings, 0)
  const value = (items: Assessment[]) => items.reduce((n, a) => n + a.resaleValueAdd, 0)
  const fits = (c: CostRange) => (budget > 0 ? budget >= c.low : null)

  // 1. Lowest cost: only what is actively causing damage or a hazard.
  const lowest = byVerdict["repair-now"]

  // 2. Protect the home: everything urgent plus anything whose failure cascades.
  const protectSet = new Set<ComponentId>([
    ...pick(byVerdict["repair-now"]),
    ...pick(byVerdict["replace-soon"]),
    ...pick(byVerdict.monitor.filter((a) => a.risk.level === "high" || a.risk.level === "moderate")),
  ])
  const protect = all.filter((a) => protectSet.has(a.id))

  // 3. Energy: anything with real savings, best payback first.
  const energy = all
    .filter((a) => a.annualSavings > 0)
    .slice()
    .sort((x, y) => (x.paybackYears ?? 99) - (y.paybackYears ?? 99))

  // 4. Resale: what buyers and inspectors react to.
  const resaleSet = new Set<ComponentId>([
    ...pick(byVerdict["repair-now"]),
    ...pick(all.filter((a) => a.resaleRecovery >= 0.6 && a.verdict !== "none")),
  ])
  const resale = all
    .filter((a) => resaleSet.has(a.id))
    .slice()
    .sort((x, y) => y.resaleValueAdd - x.resaleValueAdd)

  // 5. Five-year plan: phase by urgency.
  const y1 = byVerdict["repair-now"]
  const y2 = byVerdict["replace-soon"]
  const y35 = [...byVerdict.monitor, ...byVerdict.upgrade]
  const phases: ScenarioPhase[] = [
    { label: "This year", ids: pick(y1), cost: cost(y1) },
    { label: "Next 1–2 years", ids: pick(y2), cost: cost(y2) },
    { label: "Years 3–5", ids: pick(y35), cost: cost(y35) },
  ].filter((p) => p.ids.length > 0)
  const fiveYear = [...y1, ...y2, ...y35]

  const defs: Array<Omit<Scenario, "cost" | "annualSavings" | "valueAdd" | "fitsBudget" | "ids"> & {
    items: Assessment[]
    phases?: ScenarioPhase[]
  }> = [
    {
      id: "lowest",
      label: "Lowest cost",
      question: "What is the least I can responsibly spend?",
      blurb:
        lowest.length > 0
          ? "Only the items where damage is already happening. This is the floor, not a maintenance plan."
          : "Nothing you flagged is causing active damage, so the responsible minimum right now is zero.",
      items: lowest,
    },
    {
      id: "protect",
      label: "Protect the home",
      question: "What stops small problems becoming big ones?",
      blurb:
        "Urgent work plus the components where failure damages something else. This is the plan that minimizes total spend over time.",
      items: protect,
    },
    {
      id: "energy",
      label: "Energy efficiency",
      question: "What lowers my bills fastest?",
      blurb:
        energy.length > 0
          ? `Ordered by payback period. ${energy.filter((a) => (a.paybackYears ?? 99) <= staying).length} of ${energy.length} pay for themselves within the ${staying} years you plan to stay.`
          : "None of the components you assessed have a meaningful energy upside.",
      items: energy,
    },
    {
      id: "resale",
      label: "Selling soon",
      question: "What should I fix before I list?",
      blurb:
        "Anything an inspector will flag, plus the work that returns the most at closing. Cosmetic-only items are deliberately left out.",
      items: resale,
    },
    {
      id: "fiveYear",
      label: "Five-year plan",
      question: "How do I spread this out?",
      blurb: "Everything you assessed, phased so the urgent work happens first and the rest is budgeted.",
      items: fiveYear,
      phases,
    },
  ]

  return defs.map((d) => ({
    id: d.id,
    label: d.label,
    question: d.question,
    blurb: d.blurb,
    ids: d.items.map((a) => a.id),
    cost: cost(d.items),
    annualSavings: savings(d.items),
    valueAdd: value(d.items),
    phases: d.phases,
    fitsBudget: d.items.length > 0 ? fits(cost(d.items)) : null,
  }))
}
