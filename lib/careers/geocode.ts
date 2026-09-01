// ZIP code -> coordinate lookup. SERVER ONLY.
//
// Turning a posting's ZIP into a map position needs a real coordinate, and
// `job-map-shared.ts` only resolves a ZIP as far as its state. This fills that
// gap with an offline table so a pin lands on the right city rather than the
// middle of the state.
//
// Why a bundled table instead of a geocoding API:
//   - The Census geocoder's `onelineaddress` endpoint only matches a full
//     street address. City+state alone and ZIP alone both return zero matches,
//     and a job posting rarely carries a street address.
//   - No API key, no rate limit, no network call on the write path, and the
//     same ZIP always resolves to the same point.
//
// The data is the Census Bureau's published internal point (INTPTLAT/INTPTLONG)
// for each ZIP Code Tabulation Area, not an invented centroid. A ZCTA is the
// Census approximation of a USPS ZIP, so this is accurate to the ZIP area —
// good to a mile or two, which is what the map needs. It is NOT a street
// address, and nothing here should be presented as one.
//
// Regenerating (2024 vintage is current; bump the year when a new one lands):
//   curl -O https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_zcta_national.zip
//   unzip -o 2024_Gaz_zcta_national.zip
//   then pack GEOID + INTPTLAT + INTPTLONG into data/zcta-centroids.json,
//   scaling the coordinates by 10000 and rounding to integers.

import table from "./data/zcta-centroids.json"

/** Longitude first, matching the [x, y] order d3-geo projections expect. */
export type LngLat = [lng: number, lat: number]

/**
 * Parsed lazily and cached, so the 700KB table costs nothing until something
 * actually geocodes. Building the Map eagerly at import time would run in
 * every server process that touches this module's siblings.
 */
let index: Map<string, LngLat> | null = null

function getIndex(): Map<string, LngLat> {
  if (index) return index

  const scale = table.scale
  const map = new Map<string, LngLat>()

  for (const record of table.packed.split(";")) {
    const comma1 = record.indexOf(",")
    const comma2 = record.indexOf(",", comma1 + 1)
    if (comma1 === -1 || comma2 === -1) continue

    const zip = record.slice(0, comma1)
    const lat = Number(record.slice(comma1 + 1, comma2)) / scale
    const lng = Number(record.slice(comma2 + 1)) / scale
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue

    map.set(zip, [lng, lat])
  }

  index = map
  return map
}

/** Normalise user input to a bare 5-digit ZIP, or null if it isn't one. */
export function normalizeZip(input: string): string | null {
  const digits = (input || "").replace(/\D/g, "")
  // ZIP+4 is accepted and truncated; the extra four digits describe a delivery
  // route within the ZIP, which is finer than this table resolves anyway.
  if (digits.length !== 5 && digits.length !== 9) return null
  return digits.slice(0, 5)
}

/**
 * Coordinate for a ZIP, or null when it isn't in the table.
 *
 * A miss is a genuine "not a deliverable US ZIP" in nearly every case — the
 * table covers all 33,791 ZCTAs — so callers should surface it rather than
 * falling back to an approximate position.
 */
export function coordsForZip(zip: string): LngLat | null {
  const normalized = normalizeZip(zip)
  if (!normalized) return null
  return getIndex().get(normalized) ?? null
}

/** Total ZIPs available, for diagnostics and admin copy. */
export function zipTableSize(): number {
  return getIndex().size
}

/** Provenance, so any surface quoting these positions can cite the source. */
export const ZIP_SOURCE = {
  name: "U.S. Census Bureau Gazetteer, ZIP Code Tabulation Areas",
  vintage: table.vintage,
  url: table.sourceUrl,
} as const
