// Pure, dependency-free constants for the lead and partnership flows.
//
// Like lib/categories.ts, this file must NOT import the database layer so it
// stays safe to import from client components (the multi-step forms) without
// pulling the pg driver into the browser bundle.

import type { Category } from "@/lib/categories"

/**
 * Consumer-facing services shown in step 2 of Find a Professional, scoped to
 * the category chosen in step 1.
 *
 * These are deliberately homeowner/buyer wording ("Kitchen remodel"), not the
 * worker-oriented job families in lib/careers/industries.ts — the audience here
 * is someone hiring for a project, not looking for a trade.
 */
export const SERVICES_BY_CATEGORY: Record<Category, string[]> = {
  solar: [
    "Solar panel installation",
    "Battery & energy storage",
    "System design & consultation",
    "Maintenance & repair",
    "Energy audit",
    "Inspection & permitting",
  ],
  landscaping: [
    "Lawn care & maintenance",
    "Landscape design",
    "Hardscaping & patios",
    "Irrigation & sprinklers",
    "Tree & plant care",
    "Drainage & retaining walls",
  ],
  renovation: [
    "Kitchen remodel",
    "Bathroom remodel",
    "Whole-home renovation",
    "Additions & extensions",
    "Electrical, plumbing & HVAC",
    "Roofing & exterior",
  ],
  agriculture: [
    "Land preparation & clearing",
    "Irrigation systems",
    "Crop planning & agronomy",
    "Equipment & mechanics",
    "Livestock & fencing",
    "Farm technology",
  ],
}

/** Optional budget bands. The lead can also skip this. */
export const BUDGET_OPTIONS = [
  "Under $5,000",
  "$5,000 – $15,000",
  "$15,000 – $50,000",
  "$50,000 – $100,000",
  "Over $100,000",
  "Not sure yet",
] as const

export const TIMEFRAME_OPTIONS = [
  "As soon as possible",
  "Within 1 month",
  "1 – 3 months",
  "3 – 6 months",
  "Just researching",
] as const

/**
 * Ways a business can work with Evergreen, shown on /partners.
 *
 * `id` is what gets stored on partner_applications.interest, so these values
 * are stable identifiers — the label can be reworded without a migration.
 * `fields` flags which interest-specific form section to reveal.
 */
export const PARTNERSHIP_OPTIONS = [
  {
    id: "leads",
    label: "Receive customer leads",
    description: "Get matched with homeowners and buyers looking for your services.",
    fields: "leadPartner",
  },
  {
    id: "listing",
    label: "List my company",
    description: "Add a company profile to the Evergreen directory.",
    fields: "none",
  },
  {
    id: "hiring",
    label: "Hire workers / post jobs",
    description: "Reach skilled trade workers across all four industries.",
    fields: "employer",
  },
  {
    id: "expert",
    label: "Become an expert contributor",
    description: "Share your expertise in Evergreen guides and calculators.",
    fields: "expert",
  },
  {
    id: "referral",
    label: "Referral partnership",
    description: "Refer customers to and from Evergreen.",
    fields: "none",
  },
  {
    id: "content",
    label: "Content or research collaboration",
    description: "Partner on data, studies, or educational content.",
    fields: "none",
  },
  {
    id: "sponsorship",
    label: "Sponsorship",
    description: "Sponsor tools, guides, or industry sections.",
    fields: "none",
  },
  {
    id: "other",
    label: "Other partnership",
    description: "Something else — tell us what you have in mind.",
    fields: "none",
  },
] as const

export type PartnershipId = (typeof PARTNERSHIP_OPTIONS)[number]["id"]

export function isPartnershipId(value: string): value is PartnershipId {
  return PARTNERSHIP_OPTIONS.some((option) => option.id === value)
}

export function partnershipLabel(id: string): string {
  return PARTNERSHIP_OPTIONS.find((option) => option.id === id)?.label ?? id
}
