// Derives a three-stage "skill tree" view from the existing 60-node career
// graph. Nothing here duplicates career data — it reshapes CAREERS so the UI
// can grow a tree upward from a seed instead of listing job titles.

import { CAREERS } from "./careers"
import { getSkill } from "./skills"
import { INDUSTRY_META } from "./industries"
import { CAREER_LEVEL_ORDER, type Career, type CareerLevel, type Industry } from "./types"

/** Bottom-to-top growth stages. Order matters: index 0 is the base of the tree. */
export const TREE_TIERS = ["entry", "apprentice", "master"] as const

export type TreeTier = (typeof TREE_TIERS)[number]

export type TreeTierMeta = {
  id: TreeTier
  label: string
  /** Rough timeframe, deliberately vague — these paths are not a schedule. */
  timeframe: string
  /** What you can actually do at this stage. */
  promise: string
  /**
   * Copy that takes the pressure off. The whole point of the tree is that a
   * 17-year-old can look at the top and not feel disqualified, so every stage
   * says out loud that it is optional and not expected yet.
   */
  reassurance: string
}

export const TREE_TIER_META: Record<TreeTier, TreeTierMeta> = {
  entry: {
    id: "entry",
    label: "Entry level",
    timeframe: "Day one to about a year",
    promise: "Jobs you can be hired into with no experience and no degree. You earn while you learn.",
    reassurance: "Everyone standing higher up this tree started on exactly these rungs.",
  },
  apprentice: {
    id: "apprentice",
    label: "Apprentice",
    timeframe: "Roughly one to three years in",
    promise: "You own real work now, with someone more experienced still nearby when you need them.",
    reassurance: "Most people reach this stage by showing up, asking questions, and staying curious.",
  },
  master: {
    id: "master",
    label: "Master",
    timeframe: "Three years and beyond, at your pace",
    promise: "Deep specialism, leading a crew, or running the business as your own.",
    reassurance: "Nobody expects this of you yet. It is drawn here so you can see the path exists.",
  },
}

/**
 * The career graph has six levels; the tree shows three stages. Collapsing
 * specialist/lead/management/owner into one "Master" canopy is intentional:
 * those four are parallel choices (go deeper, lead people, or own the company)
 * rather than a queue you must pass through in order.
 */
const LEVEL_TO_TIER: Record<CareerLevel, TreeTier> = {
  entry: "entry",
  skilled: "apprentice",
  specialist: "master",
  lead: "master",
  management: "master",
  owner: "master",
}

/**
 * Which stage a role actually belongs on.
 *
 * Level alone puts every "skilled" role on the Apprentice rung, which leaves
 * trees like Landscaping with a single entry role under fourteen higher ones —
 * an upside-down tree that tells a beginner there is almost no way in. But the
 * data already carries a better signal: `experienceYears`. A Painter or Solar
 * Sales Consultant is listed at 0 years, i.e. genuinely hireable off the
 * street, so those belong on the bottom rung next to the helper roles no
 * matter what their level says.
 *
 * Only entry/skilled are re-homed. Specialist and above stay in the canopy
 * regardless of years, because those are earned by depth, not just tenure.
 */
export function tierOf(level: CareerLevel, career?: Career): TreeTier {
  if (level === "entry") return "entry"
  // Strictly zero months: hireable with no prior experience at all. A 6-month
  // floor sounds close but pulled most of the trade roles down and left the
  // Apprentice rung nearly empty, which flattens the sense of progression.
  if (level === "skilled" && career && minMonthsToHire(career) === 0) return "entry"
  return LEVEL_TO_TIER[level]
}

/**
 * Lowest number of months of experience a role will actually hire at, read from
 * the human-readable `experienceRequired` band ("6 months to 2 years", "None",
 * "1-3 years"). `experienceYears` is the midpoint, which overstates the floor:
 * a role you can get at 6 months reads as 1 year and looks shut to a beginner.
 */
function minMonthsToHire(career: Career): number {
  const raw = career.experienceRequired?.toLowerCase().trim()
  if (!raw) return career.experienceYears * 12
  if (raw.startsWith("none") || raw.includes("no experience")) return 0
  const month = raw.match(/(\d+)\s*month/)
  const year = raw.match(/(\d+)\s*(?:\+|-|\s|to)*\s*year/)
  if (month && (!year || raw.indexOf(month[0]) < raw.indexOf(year[0]))) return Number(month[1])
  if (year) return Number(year[1]) * 12
  return career.experienceYears * 12
}

/** Which of the four Master shapes a role is, so the canopy reads as choices. */
export type MasterTrack = "deepen" | "lead" | "own"

export const MASTER_TRACK_LABELS: Record<MasterTrack, string> = {
  deepen: "Go deeper",
  lead: "Lead people",
  own: "Run it yourself",
}

export function masterTrackOf(level: CareerLevel): MasterTrack | null {
  if (level === "specialist") return "deepen"
  if (level === "lead" || level === "management") return "lead"
  if (level === "owner") return "own"
  return null
}

export type TreeNode = {
  career: Career
  tier: TreeTier
  masterTrack: MasterTrack | null
  /** Skill ids this role introduces that no lower stage in this tree teaches. */
  newSkills: string[]
  /** Skill ids you already picked up further down the tree. */
  carriedSkills: string[]
  /** Roles in this same tree that this one leads to. */
  unlocks: { id: string; name: string }[]
}

export type TreeStage = {
  meta: TreeTierMeta
  nodes: TreeNode[]
}

export type SkillTree = {
  industry: Industry
  label: string
  blurb: string
  /** The foundations every entry role here is built on — the seed. */
  rootSkills: string[]
  /** Ordered bottom (entry) to top (master). */
  stages: TreeStage[]
  totalRoles: number
}

function inIndustry(career: Career, industry: Industry): boolean {
  return career.industry === industry || (career.alsoInIndustries ?? []).includes(industry)
}

/**
 * Foundation skills for the seed: the skills shared most widely across the
 * tree's entry roles. Frequency-ranked rather than a strict intersection,
 * because some industries have a single entry role and an intersection of one
 * set would just be that role's full skill list.
 */
function computeRootSkills(entryNodes: Career[]): string[] {
  if (entryNodes.length === 0) return []
  const counts = new Map<string, number>()
  for (const career of entryNodes) {
    for (const id of career.skills) {
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([id]) => id)
}

export function buildSkillTree(industry: Industry): SkillTree {
  const meta = INDUSTRY_META[industry]
  const careers = CAREERS.filter((c) => inIndustry(c, industry))
  const idsInTree = new Set(careers.map((c) => c.id))

  const byTier = new Map<TreeTier, Career[]>()
  for (const career of careers) {
    const tier = tierOf(career.level, career)
    const list = byTier.get(tier) ?? []
    list.push(career)
    byTier.set(tier, list)
  }

  // Skills taught at or below each stage, so a node can report only what it
  // genuinely adds. Built as we climb, hence the running set.
  const seenBelow = new Set<string>()
  const stages: TreeStage[] = []

  for (const tier of TREE_TIERS) {
    const raw = byTier.get(tier) ?? []
    const sorted = [...raw].sort(
      (a, b) =>
        CAREER_LEVEL_ORDER[a.level] - CAREER_LEVEL_ORDER[b.level] ||
        a.experienceYears - b.experienceYears ||
        a.name.localeCompare(b.name),
    )

    const nodes: TreeNode[] = sorted.map((career) => {
      const newSkills = career.skills.filter((id) => !seenBelow.has(id))
      const carriedSkills = career.skills.filter((id) => seenBelow.has(id))
      return {
        career,
        tier,
        // Track headings only mean anything in the canopy.
        masterTrack: tier === "master" ? masterTrackOf(career.level) : null,
        newSkills,
        carriedSkills,
        unlocks: career.nextCareers
          .filter((id) => idsInTree.has(id))
          .map((id) => {
            const next = CAREERS.find((c) => c.id === id)
            return { id, name: next?.name ?? id }
          }),
      }
    })

    // Only widen the "already seen" set after the whole stage is mapped, so
    // two roles on the same rung both get credit for a skill they share.
    for (const node of nodes) {
      for (const id of node.career.skills) seenBelow.add(id)
    }

    stages.push({ meta: TREE_TIER_META[tier], nodes })
  }

  return {
    industry,
    label: meta.label,
    blurb: meta.blurb,
    rootSkills: computeRootSkills(byTier.get("entry") ?? []),
    stages,
    totalRoles: careers.length,
  }
}

/** Short, plain-language name for a skill chip. Falls back to the raw id. */
export function skillLabel(id: string): string {
  return getSkill(id)?.name ?? id
}

export function skillHint(id: string): string | undefined {
  return getSkill(id)?.description
}
