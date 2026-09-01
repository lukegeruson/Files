import type { Industry } from "./types"

/**
 * Local employer directory.
 *
 * SAMPLE DATA. These are illustrative employers, not live job postings — the
 * real version of this page will query external job boards. Every surface that
 * renders this list must say so, so nobody tries to apply to a company that
 * does not exist. `isEvergreen` marks the one real first-party entry.
 *
 * Kept as a typed seed module for the same reason as `careers.ts`: no database
 * import, so it is safe to pull into a client component.
 */
export type LocalCompany = {
  id: string
  name: string
  city: string
  state: string
  /** 5-digit ZIP of the company's hiring location. */
  zip: string
  industries: Industry[]
  /** Rough headcount, shown as-is. */
  size: string
  blurb: string
  /** Career ids from `careers.ts` this employer hires for. */
  hiringFor: string[]
  /** True only for Evergreen Builders itself. */
  isEvergreen?: boolean
}

export const COMPANIES: LocalCompany[] = [
  // --- Sacramento, CA (958xx) ---------------------------------------------
  {
    id: "valley-solar-co",
    name: "Valley Solar Co.",
    city: "Sacramento",
    state: "CA",
    zip: "95814",
    industries: ["solar"],
    size: "40-60 people",
    blurb:
      "Residential rooftop installer running four crews across the Sacramento valley. Hires helpers every spring and trains them up.",
    hiringFor: ["solar-helper", "solar-installer", "solar-service-tech"],
  },
  {
    id: "capitol-grounds",
    name: "Capitol Grounds Management",
    city: "Sacramento",
    state: "CA",
    zip: "95826",
    industries: ["landscaping"],
    size: "80-120 people",
    blurb:
      "Commercial grounds contracts for office parks and school districts. Steady year-round route work.",
    hiringFor: ["landscape-laborer", "lawn-care-tech", "groundskeeper", "irrigation-tech"],
  },
  {
    id: "delta-ag-partners",
    name: "Delta Ag Partners",
    city: "Elk Grove",
    state: "CA",
    zip: "95757",
    industries: ["agriculture"],
    size: "200+ people",
    blurb:
      "Row-crop operation moving toward sensor-driven irrigation. Looks for equipment operators and precision-ag techs.",
    hiringFor: ["farm-hand", "farm-equipment-operator", "precision-ag-tech", "ag-mechanic"],
  },

  // --- Fresno, CA (937xx) -------------------------------------------------
  {
    id: "central-valley-builders",
    name: "Central Valley Builders",
    city: "Fresno",
    state: "CA",
    zip: "93721",
    industries: ["renovation"],
    size: "25-40 people",
    blurb:
      "Kitchen and bath remodels plus light commercial tenant work. Runs a paid carpentry apprenticeship.",
    hiringFor: ["construction-laborer", "carpenter-apprentice", "carpenter", "drywall-finisher"],
  },
  {
    id: "sunbelt-orchards",
    name: "Sunbelt Orchards",
    city: "Clovis",
    state: "CA",
    zip: "93611",
    industries: ["agriculture"],
    size: "150+ seasonal",
    blurb:
      "Tree-nut grower with a large seasonal crew and a small permanent mechanic and irrigation team.",
    hiringFor: ["farm-hand", "irrigation-tech", "ag-mechanic", "field-supervisor"],
  },

  // --- Denver, CO (802xx) -------------------------------------------------
  {
    id: "front-range-electric",
    name: "Front Range Electric",
    city: "Denver",
    state: "CO",
    zip: "80211",
    industries: ["renovation", "solar"],
    size: "60-90 people",
    blurb:
      "Licensed electrical contractor splitting work between remodels and solar interconnects. Registered apprenticeship program.",
    hiringFor: ["electrician-apprentice", "electrician", "solar-installer", "battery-storage-tech"],
  },
  {
    id: "mile-high-landscape",
    name: "Mile High Landscape Design",
    city: "Lakewood",
    state: "CO",
    zip: "80226",
    industries: ["landscaping"],
    size: "20-35 people",
    blurb:
      "Design-build residential firm doing xeriscape and hardscape. Small crews, lots of variety.",
    hiringFor: ["landscape-laborer", "hardscape-installer", "irrigation-tech", "landscape-designer"],
  },
  {
    id: "summit-mechanical",
    name: "Summit Mechanical Services",
    city: "Aurora",
    state: "CO",
    zip: "80012",
    industries: ["renovation"],
    size: "45-70 people",
    blurb:
      "HVAC and plumbing service company covering the metro area. Hires helpers with no experience and pays for schooling.",
    hiringFor: ["hvac-tech", "plumber-apprentice", "plumber", "weatherization-tech"],
  },

  // --- Austin, TX (787xx) -------------------------------------------------
  {
    id: "lone-star-solar",
    name: "Lone Star Solar Group",
    city: "Austin",
    state: "TX",
    zip: "78704",
    industries: ["solar"],
    size: "100+ people",
    blurb:
      "Fast-growing installer covering central Texas. Clear ladder from helper to lead installer to crew supervisor.",
    hiringFor: [
      "solar-helper",
      "solar-installer",
      "solar-lead-installer",
      "solar-sales-consultant",
    ],
  },
  {
    id: "hill-country-restoration",
    name: "Hill Country Restoration",
    city: "Round Rock",
    state: "TX",
    zip: "78664",
    industries: ["renovation"],
    size: "30-50 people",
    blurb:
      "Storm and water damage restoration. On-call work with strong overtime and fast advancement.",
    hiringFor: ["restoration-tech", "construction-laborer", "carpenter", "painter"],
  },
  {
    id: "greenbelt-tree",
    name: "Greenbelt Tree Care",
    city: "Austin",
    state: "TX",
    zip: "78745",
    industries: ["landscaping"],
    size: "15-25 people",
    blurb:
      "Certified arborist shop doing removals, pruning, and consulting. Trains climbers from the ground up.",
    hiringFor: ["landscape-laborer", "tree-climber", "arborist"],
  },

  // --- Raleigh, NC (276xx) ------------------------------------------------
  {
    id: "triangle-renovations",
    name: "Triangle Renovations",
    city: "Raleigh",
    state: "NC",
    zip: "27601",
    industries: ["renovation"],
    size: "35-55 people",
    blurb:
      "Whole-home remodeler working across the Triangle. Hires laborers and moves them into finish trades.",
    hiringFor: [
      "construction-laborer",
      "carpenter-apprentice",
      "finish-carpenter",
      "construction-foreman",
    ],
  },
  {
    id: "piedmont-greenhouse",
    name: "Piedmont Greenhouse Growers",
    city: "Durham",
    state: "NC",
    zip: "27703",
    industries: ["agriculture"],
    size: "60-80 people",
    blurb:
      "Controlled-environment nursery supplying regional garden centers. Year-round indoor growing work.",
    hiringFor: ["greenhouse-tech", "greenhouse-manager", "horticulturist", "farm-hand"],
  },

  // --- Lancaster, PA (176xx) ----------------------------------------------
  {
    id: "keystone-roofing",
    name: "Keystone Roofing & Exteriors",
    city: "Lancaster",
    state: "PA",
    zip: "17603",
    industries: ["renovation"],
    size: "40-60 people",
    blurb:
      "Roofing and siding contractor with a solar-ready division. Pays for fall-protection certification.",
    hiringFor: ["roofer", "construction-laborer", "solar-installer", "weatherization-tech"],
  },
  {
    id: "amish-country-ag",
    name: "Conestoga Farm Services",
    city: "Lancaster",
    state: "PA",
    zip: "17602",
    industries: ["agriculture"],
    size: "50-75 people",
    blurb:
      "Dairy and field services co-op. Livestock handling, equipment repair, and agronomy support.",
    hiringFor: ["farm-hand", "livestock-handler", "herd-manager", "ag-mechanic"],
  },

  // --- Evergreen itself ---------------------------------------------------
  {
    id: "evergreen-builders",
    name: "Evergreen Builders",
    city: "San Jose",
    state: "CA",
    zip: "95113",
    industries: ["solar", "landscaping", "renovation", "agriculture"],
    size: "Multiple crews",
    blurb:
      "Our own crews work across all four trades. Entry roles open seasonally and we train from zero experience.",
    hiringFor: [
      "solar-helper",
      "landscape-laborer",
      "construction-laborer",
      "farm-hand",
      "irrigation-tech",
    ],
    isEvergreen: true,
  },
]

/** How close a company's ZIP is to the searched one. */
export type Proximity = "exact" | "near" | "region" | "far"

export const PROXIMITY_LABELS: Record<Proximity, string> = {
  exact: "In your ZIP code",
  near: "Nearby",
  region: "Same region",
  far: "Farther away",
}

const PROXIMITY_ORDER: Record<Proximity, number> = { exact: 0, near: 1, region: 2, far: 3 }

/** Five digits, nothing else. */
export function isValidZip(zip: string): boolean {
  return /^\d{5}$/.test(zip.trim())
}

/**
 * Rough closeness from ZIP structure alone.
 *
 * ZIP prefixes are geographically nested (first digit = national area, first
 * three = sectional center), so shared prefixes are a fair proxy for "near".
 * Deliberately returns buckets rather than a mileage number: without a
 * geocoding lookup any distance in miles would be invented.
 */
export function zipProximity(searched: string, companyZip: string): Proximity {
  if (searched === companyZip) return "exact"
  if (searched.slice(0, 3) === companyZip.slice(0, 3)) return "near"
  if (searched.slice(0, 1) === companyZip.slice(0, 1)) return "region"
  return "far"
}

export type CompanyResult = {
  company: LocalCompany
  proximity: Proximity
  /** Career ids this employer hires for that are also in the user's matches. */
  matchingRoles: string[]
}

/**
 * Companies near a ZIP, closest first.
 *
 * `matchedCareerIds` comes from the user's Skill Tree / quiz results. It only
 * annotates and re-ranks results — it never removes an employer, so a search
 * always shows what is actually in the area. Filtering to matches only is a
 * separate, explicit choice in the UI.
 */
export function searchCompanies(
  zip: string,
  matchedCareerIds: string[] = [],
): CompanyResult[] {
  const matched = new Set(matchedCareerIds)

  return COMPANIES.filter((c) => !c.isEvergreen)
    .map((company) => ({
      company,
      proximity: zipProximity(zip, company.zip),
      matchingRoles: company.hiringFor.filter((id) => matched.has(id)),
    }))
    .sort((a, b) => {
      const byDistance = PROXIMITY_ORDER[a.proximity] - PROXIMITY_ORDER[b.proximity]
      if (byDistance !== 0) return byDistance
      // Within the same distance band, lead with employers hiring for roles the
      // user is actually aiming at.
      if (b.matchingRoles.length !== a.matchingRoles.length)
        return b.matchingRoles.length - a.matchingRoles.length
      return a.company.name.localeCompare(b.company.name)
    })
}

export function getEvergreen(): LocalCompany | undefined {
  return COMPANIES.find((c) => c.isEvergreen)
}
