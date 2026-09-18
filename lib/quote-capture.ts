/**
 * Configuration and data model for the reusable "Get a Professional Quote"
 * lead-capture system used on every category page.
 *
 * Everything category-specific lives in QUOTE_CATEGORIES so new categories can
 * be added without touching the QuoteCapture component. The lead shape
 * (QuoteLead) is intentionally plain and serializable so it can be posted to a
 * CRM, database, email service, or API later without reshaping.
 */

export type QuoteCategory = "solar" | "landscaping" | "home-improvement" | "agriculture"

export type QuoteProjectType = {
  id: string
  label: string
}

export type QuoteSizeQuestion = {
  /** Field label, e.g. "Estimated system size". */
  label: string
  placeholder: string
}

export type CategoryConfig = {
  key: QuoteCategory
  /** Leading emoji used in the dynamic headline. */
  emoji: string
  /** Human label, e.g. "Solar" or "Home Improvement". */
  label: string
  /** Heading for the known-info summary, e.g. "Your Solar Project". */
  projectTitle: string
  /** Category-specific project types shown as clickable options in step 1. */
  projectTypes: QuoteProjectType[]
  /** Optional size/budget question offered in step 2. */
  sizeQuestion?: QuoteSizeQuestion
}

export const QUOTE_TIMELINES: Array<{ id: string; label: string }> = [
  { id: "asap", label: "ASAP" },
  { id: "1-3-months", label: "1–3 months" },
  { id: "3-6-months", label: "3–6 months" },
  { id: "6-12-months", label: "6–12 months" },
  { id: "researching", label: "Just researching" },
]

export const QUOTE_CATEGORIES: Record<QuoteCategory, CategoryConfig> = {
  solar: {
    key: "solar",
    emoji: "☀️",
    label: "Solar",
    projectTitle: "Your Solar Project",
    projectTypes: [
      { id: "solar-installation", label: "Solar installation" },
      { id: "solar-battery", label: "Solar + battery" },
      { id: "battery-storage", label: "Battery storage" },
      { id: "panel-replacement", label: "Panel replacement" },
      { id: "other", label: "Other" },
    ],
    sizeQuestion: {
      label: "Estimated system size",
      placeholder: "e.g. 8 kW",
    },
  },
  landscaping: {
    key: "landscaping",
    emoji: "🌳",
    label: "Landscaping",
    projectTitle: "Your Landscaping Project",
    projectTypes: [
      { id: "landscape-design", label: "Landscape design" },
      { id: "new-landscaping", label: "New landscaping" },
      { id: "lawn-yard", label: "Lawn/yard" },
      { id: "irrigation", label: "Irrigation" },
      { id: "hardscape", label: "Hardscape" },
      { id: "maintenance", label: "Maintenance" },
      { id: "other", label: "Other" },
    ],
    sizeQuestion: {
      label: "Project size or budget",
      placeholder: "e.g. 1,500 sq ft or $10k",
    },
  },
  "home-improvement": {
    key: "home-improvement",
    emoji: "🏠",
    label: "Home Improvement",
    projectTitle: "Your Home Improvement Project",
    projectTypes: [
      { id: "kitchen", label: "Kitchen" },
      { id: "bathroom", label: "Bathroom" },
      { id: "roofing", label: "Roofing" },
      { id: "hvac", label: "HVAC" },
      { id: "flooring", label: "Flooring" },
      { id: "exterior", label: "Exterior" },
      { id: "other", label: "Other" },
    ],
    sizeQuestion: {
      label: "Budget range",
      placeholder: "e.g. $25,000",
    },
  },
  agriculture: {
    key: "agriculture",
    emoji: "🌾",
    label: "Agriculture",
    projectTitle: "Your Agriculture Project",
    projectTypes: [
      { id: "irrigation", label: "Irrigation" },
      { id: "equipment", label: "Equipment" },
      { id: "structures", label: "Structures" },
      { id: "land-improvement", label: "Land improvement" },
      { id: "agricultural-project", label: "Agricultural project" },
      { id: "other", label: "Other" },
    ],
    sizeQuestion: {
      label: "Project size or budget",
      placeholder: "e.g. 40 acres",
    },
  },
}

export const QUOTE_CATEGORY_ORDER: QuoteCategory[] = [
  "solar",
  "landscaping",
  "home-improvement",
  "agriculture",
]

/**
 * Context the surrounding page already knows about the visitor's project —
 * typically produced by the Visual Explorer or a calculator. Any field provided
 * here is used directly and its question is skipped in the form.
 */
export type QuoteContext = {
  zipCode?: string
  /** A project-type id from the category's config, e.g. "solar-installation". */
  projectType?: string
  /** A timeline id from QUOTE_TIMELINES. */
  timeline?: string
  /** Category-specific size or budget figure, e.g. "8 kW estimated system". */
  projectSize?: string
}

/** A single project within a lead (the primary one, or an added extra). */
export type QuoteProject = {
  category: QuoteCategory
  projectType?: string
  projectTypeLabel?: string
  zipCode?: string
  timeline?: string
  timelineLabel?: string
  projectSize?: string
}

/** The structured lead handed off on submission. */
export type QuoteLead = {
  primary: QuoteProject
  additionalProjects: QuoteProject[]
  contact: {
    name: string
    email: string
    phone?: string
  }
  /** Raw context passed in from the Visual Explorer / calculators. */
  explorerContext: QuoteContext
  sourceCategory: QuoteCategory
  sourcePage: string
  submittedAt: string
}

export function projectTypeLabel(category: QuoteCategory, id?: string): string | undefined {
  if (!id) return undefined
  return QUOTE_CATEGORIES[category].projectTypes.find((t) => t.id === id)?.label
}

export function timelineLabel(id?: string): string | undefined {
  if (!id) return undefined
  return QUOTE_TIMELINES.find((t) => t.id === id)?.label
}
