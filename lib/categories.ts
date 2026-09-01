// Pure, dependency-free category constants and shared types.
// This file must NOT import the database layer, so it is safe to import
// from client components without pulling the pg driver into the browser bundle.

export const CATEGORIES = [
  "solar",
  "landscaping",
  "renovation",
  "agriculture",
] as const

export type Category = (typeof CATEGORIES)[number]

export const CATEGORY_LABELS: Record<Category, string> = {
  solar: "Solar",
  landscaping: "Landscaping",
  renovation: "Renovation",
  agriculture: "Agriculture",
}

export const CATEGORY_DESCRIPTIONS: Record<Category, string> = {
  solar: "Panels, storage, incentives, and getting the most from the sun.",
  landscaping: "Designing outdoor spaces that work with the land and the light.",
  renovation: "Practical upgrades that make homes more efficient and comfortable.",
  agriculture: "Solar-powered farming, irrigation, and sustainable land use.",
}

/**
 * Short, action-led teasers for the home page category cards. These are kept
 * separate from CATEGORY_DESCRIPTIONS because that map feeds the category
 * pages' SEO meta descriptions, where a two-word tool name would read poorly.
 */
export const CATEGORY_HOME_TEASERS: Record<Category, { question: string; tool: string }> = {
  solar: {
    question: "Should you go solar?",
    tool: "Calculate Solar Savings",
  },
  landscaping: {
    question: "What does a new yard cost?",
    tool: "Plan Landscape Materials",
  },
  renovation: {
    question: "Ready to upgrade your home?",
    tool: "Calculate Remodeling Costs",
  },
  agriculture: {
    question: "What crops should you grow?",
    tool: "Calculate Farm Profitability",
  },
}

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value)
}

/**
 * Secondary collection tags. Unlike CATEGORIES these are additive: a post keeps
 * its primary category and can carry tags on top of it.
 *
 * Deliberately NOT part of CATEGORIES. That array drives the site header, the
 * footer, the home page grid, and the /blog and /category routes, so adding
 * "jobs" there would surface a Jobs link across the whole site. The Jobs
 * collection is reachable only from the bottom of /jobs.
 */
export const POST_TAGS = ["jobs"] as const

export type PostTag = (typeof POST_TAGS)[number]

export const POST_TAG_LABELS: Record<PostTag, string> = {
  jobs: "Jobs",
}

export function isPostTag(value: string): value is PostTag {
  return (POST_TAGS as readonly string[]).includes(value)
}

export type Post = {
  id: string
  title: string
  slug: string
  category: Category
  tags: PostTag[]
  excerpt: string
  content: string
  author: string
  coverImage: string
  published: boolean
  createdAt: string
  updatedAt: string
}

export type PostInput = {
  title: string
  category: Category
  tags?: PostTag[]
  excerpt: string
  content: string
  author?: string
  coverImage?: string
  published: boolean
}
