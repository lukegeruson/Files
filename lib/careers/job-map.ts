// Builds the job map's geometry. SERVER ONLY.
//
// Everything expensive and dependency-heavy happens here: reading the US
// TopoJSON, projecting it with d3-geo, and projecting each job pin into the
// same coordinate space. The client component receives plain numbers and SVG
// path strings, so neither d3-geo, topojson-client, nor the 114KB atlas ends
// up in the browser bundle. Zooming is then just an SVG viewBox change.
//
// Client components must import from `job-map-shared.ts` instead — importing
// any value from this module would pull the atlas into the browser.
//
// Pins come from two sources and must never be conflated. `source: "sample"`
// pins are the seeded employer directory in `companies.ts` — illustrative
// employers that do not exist. `source: "live"` pins are real, first-party
// openings from the `job_postings` table that a person can actually apply to.
// Every surface that renders them distinguishes the two.

import { geoAlbersUsa, geoPath } from "d3-geo"
import { feature } from "topojson-client"
import type { FeatureCollection, Geometry } from "geojson"
import type { Topology } from "topojson-specification"

import atlas from "./data/us-states-10m.json"
import { COMPANIES, getEvergreen, type LocalCompany } from "./companies"
import { getCareer } from "./careers"
import { skillLabel, tierOf, TREE_TIER_META } from "./skill-tree"
import { CAREER_LEVEL_LABELS, type Career } from "./types"
import { employmentLabel, getLivePostings, payLabel } from "./postings"
import type { JobPostingRow } from "@/lib/db/schema"
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type Box,
  type JobPin,
  type PinCareer,
  type StatePath,
} from "./job-map-shared"

export { MAP_HEIGHT, MAP_WIDTH, stateNameForZip } from "./job-map-shared"
export type { Box, JobPin, StatePath } from "./job-map-shared"

// ---------------------------------------------------------------------------
// Company coordinates
// ---------------------------------------------------------------------------

/**
 * Real lat/lng for each seeded employer's hiring city.
 *
 * `companies.ts` only stores city/state/ZIP, and a ZIP cannot be turned into a
 * coordinate without a geocoding table. These are the actual coordinates of
 * each city so pins land in the right place on a real projection rather than
 * at invented positions.
 */
const COMPANY_COORDS: Record<string, [lng: number, lat: number]> = {
  "valley-solar-co": [-121.4944, 38.5816], // Sacramento, CA
  "capitol-grounds": [-121.362, 38.5504], // Sacramento (Rosemont), CA
  "delta-ag-partners": [-121.3716, 38.4088], // Elk Grove, CA
  "central-valley-builders": [-119.7871, 36.7378], // Fresno, CA
  "sunbelt-orchards": [-119.7029, 36.8252], // Clovis, CA
  "front-range-electric": [-105.0178, 39.7684], // Denver, CO
  "mile-high-landscape": [-105.0814, 39.7047], // Lakewood, CO
  "summit-mechanical": [-104.8319, 39.7294], // Aurora, CO
  "lone-star-solar": [-97.7669, 30.2467], // Austin, TX
  "hill-country-restoration": [-97.6789, 30.5083], // Round Rock, TX
  "greenbelt-tree": [-97.7935, 30.2072], // Austin (South), TX
  "triangle-renovations": [-78.6382, 35.7796], // Raleigh, NC
  "piedmont-greenhouse": [-78.8986, 35.994], // Durham, NC
  "keystone-roofing": [-76.3055, 40.0379], // Lancaster, PA
  "amish-country-ag": [-76.2803, 40.0362], // Lancaster (East), PA
  "evergreen-builders": [-121.8938, 37.3352], // San Jose, CA
}

// ---------------------------------------------------------------------------
// Projection + base map
// ---------------------------------------------------------------------------

const topology = atlas as unknown as Topology

const statesCollection = feature(
  topology,
  topology.objects.states,
) as FeatureCollection<Geometry, { name: string }>

const nationCollection = feature(
  topology,
  topology.objects.nation,
) as FeatureCollection<Geometry, Record<string, never>>

// Fit to the nation outline so the whole country fills the frame predictably.
const projection = geoAlbersUsa().fitExtent(
  [
    [0, 0],
    [MAP_WIDTH, MAP_HEIGHT],
  ],
  nationCollection,
)

const pathBuilder = geoPath(projection)

/**
 * State outlines as SVG path strings.
 *
 * Territories that Albers-USA does not place (Puerto Rico, Guam, and the
 * Virgin Islands) project to nothing, so they are dropped rather than rendered
 * as empty paths.
 */
export function getStatePaths(): StatePath[] {
  return statesCollection.features
    .map((f) => ({
      id: String(f.id),
      name: f.properties.name,
      d: pathBuilder(f) ?? "",
    }))
    .filter((s) => s.d.length > 0)
}

/** Per-state bounding boxes in projection space, keyed by state name. */
export function getStateBoxes(): Record<string, Box> {
  const out: Record<string, Box> = {}
  for (const f of statesCollection.features) {
    if (!pathBuilder(f)) continue
    const [[x0, y0], [x1, y1]] = pathBuilder.bounds(f)
    if (!Number.isFinite(x0) || !Number.isFinite(x1)) continue
    out[f.properties.name] = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
  }
  return out
}

// ---------------------------------------------------------------------------
// Job pins
// ---------------------------------------------------------------------------

/**
 * Spread co-located roles into a small ring around their employer.
 *
 * Every role at one company shares a single coordinate, so without this they
 * stack into one unclickable dot. The ring is deterministic (angle derived
 * from the index) and sized in projection units — a few pixels at national
 * zoom — so pins stay visually attached to their city while each one becomes
 * individually clickable as you zoom in.
 */
function ringOffset(index: number, total: number): [number, number] {
  if (total <= 1) return [0, 0]
  const radius = 3.2 + total * 0.55
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2
  return [Math.cos(angle) * radius, Math.sin(angle) * radius]
}

const INTENSITY_LABELS: Record<string, string> = {
  low: "Light physical work",
  moderate: "Moderately physical",
  high: "Physically demanding",
}

/**
 * Resolve a career into the detail a pin shows.
 *
 * Shared by both pin sources so a real opening mapped to `electrician` presents
 * exactly the same tier, skills and training time as the sample pin for it —
 * the taxonomy is the single origin of those claims.
 */
function careerDetail(career: Career): PinCareer {
  const tier = tierOf(career.level, career)
  return {
    tier,
    tierLabel: TREE_TIER_META[tier].label,
    levelLabel: CAREER_LEVEL_LABELS[career.level],
    skills: career.skills.slice(0, 5).map(skillLabel),
    trainingTime: career.trainingTime,
    experienceRequired: career.experienceRequired,
    physicalIntensity:
      INTENSITY_LABELS[career.physicalIntensity] ?? career.physicalIntensity,
  }
}

function pinsForCompany(company: LocalCompany): JobPin[] {
  const coord = COMPANY_COORDS[company.id]
  if (!coord) return []
  const origin = projection(coord)
  if (!origin) return []

  const roles = company.hiringFor
    .map((id) => getCareer(id))
    .filter((c): c is NonNullable<ReturnType<typeof getCareer>> => Boolean(c))

  return roles.map((career, i) => {
    const [dx, dy] = ringOffset(i, roles.length)
    return {
      id: `${company.id}--${career.id}`,
      source: "sample" as const,
      careerId: career.id,
      title: career.name,
      industry: career.industry,
      description: career.description,
      career: careerDetail(career),
      posting: null,
      companyName: company.name,
      companyCity: company.city,
      companyState: company.state,
      companySize: company.size,
      isEvergreen: Boolean(company.isEvergreen),
      x: origin[0] + dx,
      y: origin[1] + dy,
    }
  })
}

/** Every seeded opening, as projected pins. */
export function getJobPins(): JobPin[] {
  return COMPANIES.flatMap(pinsForCompany)
}

// ---------------------------------------------------------------------------
// Real openings
// ---------------------------------------------------------------------------

const dateLabel = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
})

/** Lowercased once, so the per-row comparison below is a plain equality check. */
const EVERGREEN_NAME = (getEvergreen()?.name ?? "Evergreen Builders")
  .trim()
  .toLowerCase()

/**
 * Whether a coordinate has a position on this projection at all.
 *
 * Exposed so the admin list can label a posting "list only" instead of leaving
 * someone hunting the map for a pin that was never drawn.
 */
export function isMappable(lng: number, lat: number): boolean {
  return projection([lng, lat]) !== null
}

/**
 * Project a stored posting into a pin.
 *
 * Returns null when the coordinate falls outside what Albers-USA can place —
 * Puerto Rico, Guam and the Virgin Islands have real ZIPs and real jobs, but no
 * position on this projection, so the pin is dropped rather than drawn at a
 * nonsense point. `/jobs/openings` still lists them below the map.
 */
function pinForPosting(row: JobPostingRow): JobPin | null {
  const origin = projection([row.lng, row.lat])
  if (!origin) return null

  const career = row.careerId ? getCareer(row.careerId) : undefined

  return {
    id: `live--${row.id}`,
    source: "live",
    // Falls back to null when a stored id no longer resolves, e.g. after the
    // taxonomy is edited. Better an unclassified pin than a dead link.
    careerId: career ? career.id : null,
    title: row.title,
    industry: row.industry as JobPin["industry"],
    description: row.description,
    career: career ? careerDetail(career) : null,
    posting: {
      employmentLabel: employmentLabel(row.employmentType),
      payLabel: payLabel(row),
      applyUrl: row.applyUrl,
      applyEmail: row.applyEmail,
      postedLabel: dateLabel.format(row.postedAt),
      closesLabel: row.expiresAt ? dateLabel.format(row.expiresAt) : null,
    },
    companyName: row.employer,
    companyCity: row.city,
    companyState: row.state,
    companySize: null,
    // Real openings are not automatically ours — the board is meant to carry
    // other employers too, so this is a name match rather than a blanket true.
    isEvergreen: row.employer.trim().toLowerCase() === EVERGREEN_NAME,
    x: origin[0],
    y: origin[1],
  }
}

/**
 * Spread real openings that share a coordinate.
 *
 * Two roles posted against the same ZIP project to the identical point, so
 * without this they stack into one unclickable dot — the same problem
 * `ringOffset` solves for co-located sample roles.
 */
function spreadColocated(pins: JobPin[]): JobPin[] {
  const groups = new Map<string, JobPin[]>()
  for (const pin of pins) {
    // Rounded so near-identical projections group together rather than
    // overlapping by a fraction of a pixel.
    const key = `${pin.x.toFixed(1)},${pin.y.toFixed(1)}`
    const bucket = groups.get(key)
    if (bucket) bucket.push(pin)
    else groups.set(key, [pin])
  }

  const out: JobPin[] = []
  for (const bucket of groups.values()) {
    bucket.forEach((pin, i) => {
      const [dx, dy] = ringOffset(i, bucket.length)
      out.push({ ...pin, x: pin.x + dx, y: pin.y + dy })
    })
  }
  return out
}

/** Real, live openings as projected pins. */
export async function getLivePins(): Promise<JobPin[]> {
  const rows = await getLivePostings()
  const pins = rows
    .map(pinForPosting)
    .filter((pin): pin is JobPin => pin !== null)
  return spreadColocated(pins)
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export type JobMapData = {
  statePaths: StatePath[]
  stateBoxes: Record<string, Box>
  pins: JobPin[]
  /** How many pins are real openings, for honest captions and counts. */
  liveCount: number
}

/**
 * Base geometry, cached because it is genuinely static.
 *
 * Only the outlines and bounding boxes are memoised. Pins are not: real
 * openings change whenever an admin posts one or an old one closes, and a cache
 * here would keep showing an expired job for the life of the server process.
 */
type MapGeometry = Pick<JobMapData, "statePaths" | "stateBoxes">
let cachedGeometry: MapGeometry | null = null

function getGeometry(): MapGeometry {
  if (!cachedGeometry) {
    cachedGeometry = { statePaths: getStatePaths(), stateBoxes: getStateBoxes() }
  }
  return cachedGeometry
}

/**
 * Everything the client map needs, as plain serialisable data.
 *
 * Call this from a server component and pass the result down as props. Async
 * because real openings come from the database; the sample directory alone was
 * synchronous.
 */
export async function buildJobMap(): Promise<JobMapData> {
  const geometry = getGeometry()

  // A database hiccup must not take the whole page down. The sample map is
  // still useful on its own, so failing soft to it beats a 500 — but it is
  // logged, because silently showing zero real openings is a bug worth seeing.
  let livePins: JobPin[] = []
  try {
    livePins = await getLivePins()
  } catch (error) {
    console.error("[v0] failed to load live job postings for the map:", error)
  }

  return {
    ...geometry,
    // Real openings last so they paint on top of the sample pins where the two
    // overlap; SVG has no z-index, so document order is the only lever.
    pins: [...getJobPins(), ...livePins],
    liveCount: livePins.length,
  }
}
