// Pure, dependency-free search helpers for the article index.
//
// Posts have no `tags` column, so tags are DERIVED on the server from each
// article's title + excerpt + category using the vocabulary below.
//
// Why not the full body? Measured on this catalog (125 posts): scanning bodies
// cost ~48ms of server render time and required pulling ~830 KB of `content`
// out of Postgres on every homepage request. Title + excerpt is ~14 KB, runs in
// well under a millisecond, and lets the page use a projection that omits
// `content` entirely — a faster TTFB, which is what feeds LCP and the Core Web
// Vitals that actually affect ranking. The client payload is identical either
// way, since bodies were never sent to the browser.

import { CATEGORY_LABELS, type Category } from "@/lib/categories"
import type { PostSummary } from "@/lib/posts"

export type { PostSummary }

export type SearchDoc = {
  post: PostSummary
  /** Tags detected in this article, e.g. ["solar", "roofing"]. */
  tags: string[]
  /** Lowercased text the free-text query is matched against. */
  haystack: string
}

export type TagFacet = {
  /** Canonical tag id, also what the user sees. */
  id: string
  label: string
  /** How many articles carry this tag. */
  count: number
}

/**
 * Candidate tags and the terms that imply them. Terms are matched on word
 * boundaries so "AC" does not match "back" and "sod" does not match "sodium".
 * A tag only ever appears in the UI if real articles match it.
 */
const TAG_VOCABULARY: Array<{ id: string; terms: string[] }> = [
  { id: "solar", terms: ["solar", "photovoltaic", "pv panel"] },
  { id: "solar panels", terms: ["solar panel", "solar panels", "solar roof", "solar array"] },
  { id: "batteries", terms: ["battery", "batteries", "energy storage", "powerwall"] },
  { id: "roofing", terms: ["roof", "roofing", "shingle", "shingles", "gutter", "gutters"] },
  { id: "siding", terms: ["siding", "stucco", "shake siding"] },
  { id: "windows", terms: ["window", "windows", "casement", "transom", "skylight"] },
  { id: "doors", terms: ["door", "doors", "prehung", "french door"] },
  { id: "hvac", terms: ["hvac", "furnace", "air conditioner", "air conditioning", "mini split", "heat pump", "thermostat", "air duct"] },
  { id: "insulation", terms: ["insulation", "insulate", "weatherization", "foam board"] },
  { id: "flooring", terms: ["flooring", "vinyl plank", "hardwood", "laminate", "tile floor"] },
  { id: "painting", terms: ["paint", "painting", "primer", "repaint"] },
  { id: "kitchen", terms: ["kitchen", "cabinet", "cabinets", "countertop", "backsplash"] },
  { id: "bathroom", terms: ["bathroom", "shower", "vanity", "bathtub"] },
  { id: "pools & spas", terms: ["pool", "pools", "spa", "hot tub", "jacuzzi"] },
  { id: "garage", terms: ["garage", "garage door"] },
  { id: "plumbing", terms: ["plumbing", "plumber", "water heater", "pipe", "pipes"] },
  { id: "electrical", terms: ["electrical", "electrician", "wiring", "breaker", "outlet"] },
  { id: "water damage", terms: ["water damage", "restoration", "mold", "flooding", "leak"] },
  { id: "landscaping", terms: ["landscaping", "landscape", "yard", "curb appeal", "hardscape"] },
  { id: "lawn & sod", terms: ["lawn", "sod", "turf", "grass seed", "seeding"] },
  { id: "mulch & soil", terms: ["mulch", "topsoil", "top soil", "compost", "soil"] },
  { id: "patios & decks", terms: ["patio", "deck", "paver", "pavers", "walkway", "pergola"] },
  { id: "fencing", terms: ["fence", "fencing", "retaining wall"] },
  { id: "irrigation", terms: ["irrigation", "sprinkler", "sprinklers", "drip line", "watering"] },
  { id: "trees & plants", terms: ["tree", "trees", "shrub", "shrubs", "planting", "perennial"] },
  { id: "farming", terms: ["farm", "farming", "farmer", "ranch", "crop", "crops", "harvest"] },
  { id: "hydroponics", terms: ["hydroponic", "hydroponics", "vertical farming", "indoor farming"] },
  { id: "fertilizer", terms: ["fertilizer", "fertiliser", "nutrient", "manure"] },
  { id: "agtech", terms: ["agtech", "precision agriculture", "drone", "uav", "robotics", "digital farming", "smart farming"] },
  { id: "livestock", terms: ["livestock", "cattle", "beef", "chicken", "chickens", "pigs", "poultry"] },
  { id: "costs & pricing", terms: ["cost", "costs", "price", "pricing", "budget", "how much does"] },
  { id: "diy", terms: ["diy", "do it yourself", "step by step"] },
  { id: "incentives", terms: ["tax credit", "incentive", "incentives", "rebate", "rebates"] },
  { id: "efficiency", terms: ["energy efficient", "energy efficiency", "utility bill", "save energy"] },
  { id: "careers", terms: ["career", "careers", "salary", "job", "jobs", "hiring"] },
  { id: "contractors", terms: ["contractor", "contractors", "installer", "quote", "estimate"] },
]

/** Escape a term for safe use inside a RegExp. */
function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Word-boundary matchers, built once per module load rather than per post so
 * indexing 100+ articles stays cheap.
 */
const TAG_MATCHERS = TAG_VOCABULARY.map((tag) => ({
  id: tag.id,
  pattern: new RegExp(`\\b(?:${tag.terms.map(escapeRegex).join("|")})\\b`, "i"),
}))

/**
 * Build the client-side search index. Tags are detected from the title,
 * excerpt and category label — the fields that carry the article's actual
 * subject, and the same text search matches against.
 */
export function buildSearchDocs(posts: PostSummary[]): SearchDoc[] {
  return posts.map((post) => {
    const categoryLabel = CATEGORY_LABELS[post.category as Category] ?? post.category
    const indexed = `${post.title} ${post.excerpt} ${categoryLabel}`
    const tags = TAG_MATCHERS.filter((t) => t.pattern.test(indexed)).map((t) => t.id)

    return {
      post,
      tags,
      // Tags join the haystack so a tag term still matches even when the word
      // itself is only implied by the category (e.g. "pv panel" -> solar).
      haystack: `${indexed} ${post.category} ${tags.join(" ")}`.toLowerCase(),
    }
  })
}

/**
 * Tag chips to offer, ordered by how many articles use them. Tags with only a
 * couple of articles are dropped so the row stays useful instead of noisy.
 */
export function buildTagFacets(docs: SearchDoc[], minCount = 3, limit = 16): TagFacet[] {
  const counts = new Map<string, number>()
  for (const doc of docs) {
    for (const tag of doc.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= minCount)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([id, count]) => ({ id, label: id, count }))
}

/**
 * Filter the index. Selected tags are OR'd together (any match), and every
 * whitespace-separated query term must also match somewhere (AND).
 */
export function filterDocs(
  docs: SearchDoc[],
  query: string,
  activeTags: string[],
): SearchDoc[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0 && activeTags.length === 0) return docs

  return docs.filter((doc) => {
    if (activeTags.length > 0 && !activeTags.some((tag) => doc.tags.includes(tag))) {
      return false
    }
    return terms.every((term) => doc.haystack.includes(term))
  })
}
