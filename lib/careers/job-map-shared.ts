// Job-map types and constants that are safe to import from client components.
//
// Kept apart from `job-map.ts` on purpose. That module imports d3-geo and the
// 114KB state atlas to project the geometry, so importing any *value* from it
// in a client component would drag both into the browser bundle. Everything
// here is pure — no dependencies, no data files.

import type { Industry } from "./types"
import type { TreeTier } from "./skill-tree"

/**
 * Fixed projection viewBox. 975x610 is the conventional frame for the
 * Albers-USA atlas, so the aspect ratio matches the source data exactly.
 */
export const MAP_WIDTH = 975
export const MAP_HEIGHT = 610

export type StatePath = {
  /** FIPS id, unique and stable. */
  id: string
  name: string
  /** SVG path data in the fixed projection space. */
  d: string
}

/** Bounding box of a state in projection space, used to zoom to it. */
export type Box = { x: number; y: number; width: number; height: number }

/**
 * Career-taxonomy detail for a pin.
 *
 * Only present when the opening maps onto a career in `careers.ts`. That
 * mapping is what supplies a tier, a skill list and a training estimate — none
 * of which can be inferred from a job title alone, so an unmapped opening
 * carries `career: null` and makes no claim about any of them rather than being
 * forced into the nearest wrong career.
 */
export type PinCareer = {
  tier: TreeTier
  tierLabel: string
  levelLabel: string
  /** Plain-language skill names, already resolved. */
  skills: string[]
  trainingTime: string
  experienceRequired: string
  physicalIntensity: string
}

/** Application detail, present only on real openings. */
export type PinPosting = {
  employmentLabel: string
  /** Null when pay was not disclosed — which is not the same as zero. */
  payLabel: string | null
  applyUrl: string | null
  applyEmail: string | null
  postedLabel: string
  closesLabel: string | null
}

export type JobPin = {
  /** Unique per pin: company+role for samples, row id for real openings. */
  id: string
  /**
   * Where the pin came from.
   *
   * `live` is a real, first-party opening from the `job_postings` table that a
   * person can apply to. `sample` is an illustrative role at a seeded employer
   * that does not exist. The map must keep these visibly distinct — someone
   * could otherwise spend real effort applying to a fictional company.
   */
  source: "live" | "sample"
  /** Null when the opening has no clean match in the career library. */
  careerId: string | null
  title: string
  industry: Industry
  description: string
  career: PinCareer | null
  posting: PinPosting | null
  companyName: string
  companyCity: string
  companyState: string
  /** Employer headcount band. Only the seeded directory records this. */
  companySize: string | null
  /** True for the one first-party employer. */
  isEvergreen: boolean
  /** Projected position in the fixed 975x610 space. */
  x: number
  y: number
}

// ---------------------------------------------------------------------------
// ZIP -> state
// ---------------------------------------------------------------------------

/**
 * ZIP prefix ranges to USPS state codes.
 *
 * ZIP codes are allocated in geographically contiguous blocks by their first
 * three digits, so a range table resolves a ZIP to its state without needing a
 * per-ZIP database. Ranges are inclusive.
 */
const ZIP_RANGES: [start: number, end: number, state: string][] = [
  [5, 5, "NY"], [6, 9, "PR"], [10, 27, "MA"], [28, 29, "RI"], [30, 38, "NH"],
  [39, 49, "ME"], [50, 59, "VT"], [60, 69, "CT"], [70, 89, "NJ"], [100, 149, "NY"],
  [150, 196, "PA"], [197, 199, "DE"], [200, 205, "DC"], [206, 219, "MD"],
  [220, 246, "VA"], [247, 268, "WV"], [270, 289, "NC"], [290, 299, "SC"],
  [300, 319, "GA"], [320, 349, "FL"], [350, 369, "AL"], [370, 385, "TN"],
  [386, 397, "MS"], [398, 399, "GA"], [400, 427, "KY"], [430, 459, "OH"],
  [460, 479, "IN"], [480, 499, "MI"], [500, 528, "IA"], [530, 549, "WI"],
  [550, 567, "MN"], [570, 577, "SD"], [580, 588, "ND"], [590, 599, "MT"],
  [600, 629, "IL"], [630, 658, "MO"], [660, 679, "KS"], [680, 693, "NE"],
  [700, 714, "LA"], [716, 729, "AR"], [730, 749, "OK"], [750, 799, "TX"],
  [800, 816, "CO"], [820, 831, "WY"], [832, 838, "ID"], [840, 847, "UT"],
  [850, 865, "AZ"], [870, 884, "NM"], [885, 885, "TX"], [889, 898, "NV"],
  [900, 961, "CA"], [967, 968, "HI"], [970, 979, "OR"], [980, 994, "WA"],
  [995, 999, "AK"],
]

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan",
  MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee",
  TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
}

/**
 * Full state name for a ZIP, or null when it falls outside the table.
 *
 * Returns the name rather than the code because it is matched against the
 * atlas's `properties.name`.
 */
export function stateNameForZip(zip: string): string | null {
  if (!/^\d{5}$/.test(zip.trim())) return null
  const prefix = Number(zip.trim().slice(0, 3))
  const hit = ZIP_RANGES.find(([start, end]) => prefix >= start && prefix <= end)
  if (!hit) return null
  return STATE_NAMES[hit[2]] ?? null
}

/**
 * Two-letter state code for a ZIP, or null when it falls outside the table.
 *
 * Companies store the code (`state: "CA"`), so this is what you compare against
 * to decide whether an employer is in the searcher's state. That is a real
 * comparison, unlike inferring it from the first ZIP digit — digit 8 spans both
 * Colorado and part of Texas.
 */
export function stateCodeForZip(zip: string): string | null {
  if (!/^\d{5}$/.test(zip.trim())) return null
  const prefix = Number(zip.trim().slice(0, 3))
  const hit = ZIP_RANGES.find(([start, end]) => prefix >= start && prefix <= end)
  return hit ? hit[2] : null
}
