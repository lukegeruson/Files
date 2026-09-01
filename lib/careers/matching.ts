import { CAREERS, getCareer } from "./careers"
import { getSkill } from "./skills"
import { INDUSTRY_OPTION_IDS } from "./quiz"
import type {
  Career,
  CareerMatch,
  Industry,
  PathStep,
  QuizAnswers,
  Readiness,
  ScoreBreakdown,
  SkillGap,
} from "./types"
import { CAREER_LEVEL_ORDER } from "./types"

/**
 * Matching engine (spec section 12).
 *
 * Deliberately a transparent weighted score rather than an opaque model: every
 * number can be explained to a user in a sentence, which matters when the
 * output is career advice. `explainMatch` produces those sentences.
 */

const WEIGHTS = {
  requiredSkills: 0.4,
  interests: 0.2,
  preferredSkills: 0.15,
  education: 0.1,
  experience: 0.075,
  priorities: 0.075,
} as const

const TRAINING_RANK = { weeks: 0, months: 1, "year-plus": 2, any: 3 } as const
const INTENSITY_RANK = { low: 0, moderate: 1, high: 2 } as const

/**
 * Training-length bucket, parsed from the `trainingTime` copy the UI actually
 * shows. Deriving it from `experienceYears` instead would bucket a "4-5 year
 * apprenticeship" as "weeks" (an apprentice starts at 0 years of experience)
 * and then tell someone with a few months to spare that it fits their timeline.
 *
 * Uses the far end of each range: claiming a timeline fits should be
 * conservative, since the cost of being wrong lands on the reader.
 */
function trainingBucket(career: Career): keyof typeof TRAINING_RANK {
  const t = career.trainingTime.toLowerCase()

  if (/\byears?\b/.test(t)) return "year-plus"

  const months = /(\d+)\s*(?:-|to|\+)?\s*(\d+)?\s*months?/.exec(t)
  if (months) return Number(months[2] ?? months[1]) > 12 ? "year-plus" : "months"
  if (/months?/.test(t)) return "months"
  if (/weeks?|days?/.test(t)) return "weeks"

  return "year-plus"
}

/** Earn-while-you-learn roles: hired on day one, qualified years later. */
function isApprenticeship(career: Career): boolean {
  return /apprentice/i.test(career.trainingTime) || /apprentice/i.test(career.name)
}

/** "4-5 year apprenticeship" -> "4-5 years", for use mid-sentence. */
function durationPhrase(trainingTime: string): string {
  return trainingTime
    .toLowerCase()
    .replace(/\s*apprenticeship\s*$/, "")
    .replace(/(\d)\s+year$/, "$1 years")
}

function ratio(matched: number, total: number): number {
  return total === 0 ? 0 : matched / total
}

/** Industries the user expressed interest in, from the enjoyment question. */
function interestedIndustries(answers: QuizAnswers): Industry[] {
  return answers.enjoyment.filter((id): id is Industry =>
    (INDUSTRY_OPTION_IDS as readonly string[]).includes(id),
  )
}

/** Every industry a career belongs to (shared nodes have more than one). */
function careerIndustries(career: Career): Industry[] {
  return [career.industry, ...(career.alsoInIndustries ?? [])]
}

function scoreBreakdown(career: Career, answers: QuizAnswers): ScoreBreakdown {
  const have = new Set(answers.skills)

  // --- Required skills ----------------------------------------------------
  const requiredMatched = career.skills.filter((s) => have.has(s)).length
  const requiredSkills = ratio(requiredMatched, career.skills.length)

  // --- Interests: industry overlap, plus non-industry enjoyment options
  //     whose implied skills this career actually uses. -------------------
  const industries = careerIndustries(career)
  const wanted = interestedIndustries(answers)
  let interests = wanted.length === 0 ? 0 : industries.some((i) => wanted.includes(i)) ? 1 : 0

  if (interests === 0 && answers.enjoyment.length > 0) {
    // Someone who picked "machines" but no industry should still match a
    // mechanic role; fall back to skill-implied interest at reduced credit.
    const careerSkills = new Set([...career.skills, ...career.preferredSkills])
    const implied = answers.enjoyment.flatMap((id) => {
      const opt = QUIZ_OPTION_SKILLS[id]
      return opt ?? []
    })
    if (implied.length > 0 && implied.some((s) => careerSkills.has(s))) interests = 0.6
  }

  // --- Preferred skills + environment fit --------------------------------
  const preferredMatched = career.preferredSkills.filter((s) => have.has(s)).length
  const preferredRatio = ratio(preferredMatched, career.preferredSkills.length)

  const env = career.workEnvironment.join(" ").toLowerCase()
  const envWanted = answers.environment
  const envScore =
    envWanted.length === 0
      ? 0
      : ratio(
          envWanted.filter((id) => (ENVIRONMENT_KEYWORDS[id] ?? []).some((kw) => env.includes(kw))).length,
          envWanted.length,
        )

  const preferredSkills = envWanted.length === 0 ? preferredRatio : (preferredRatio + envScore) / 2

  // --- Education stands in for physical comfort here: the spec's intake
  //     asks about physical tolerance, which gates real-world suitability.
  let education = 0
  if (answers.physical) {
    const userMax = INTENSITY_RANK[answers.physical]
    const needed = INTENSITY_RANK[career.physicalIntensity]
    education = needed <= userMax ? 1 : Math.max(0, 1 - (needed - userMax) * 0.5)
  }

  // --- Experience + training appetite ------------------------------------
  let experience = 0
  if (answers.experience !== null || answers.training) {
    const parts: number[] = []
    if (answers.experience !== null) {
      parts.push(answers.experience >= career.experienceYears ? 1 : Math.max(0, answers.experience / Math.max(1, career.experienceYears)))
    }
    if (answers.training) {
      const userRank = TRAINING_RANK[answers.training]
      const careerRank = TRAINING_RANK[trainingBucket(career)]
      parts.push(userRank >= careerRank ? 1 : Math.max(0, 1 - (careerRank - userRank) * 0.5))
    }
    experience = parts.reduce((a, b) => a + b, 0) / parts.length
  }

  // --- Priorities ---------------------------------------------------------
  let priorities = 0
  if (answers.priority) {
    switch (answers.priority) {
      case "fast-hire":
        priorities = trainingBucket(career) === "weeks" ? 1 : career.experienceYears <= 1 ? 0.5 : 0
        break
      case "earnings":
        priorities = career.advancementLevel === "strong" ? 1 : career.advancementLevel === "moderate" ? 0.5 : 0
        break
      case "own-business":
        priorities = career.entrepreneurshipLevel === "high" ? 1 : career.entrepreneurshipLevel === "moderate" ? 0.5 : 0
        break
      case "stability":
        priorities = career.level === "entry" || career.advancementLevel !== "limited" ? 0.75 : 0.4
        break
      case "outdoors":
        priorities = career.workEnvironment.join(" ").toLowerCase().includes("outdoor") ? 1 : 0
        break
    }
  }

  return { requiredSkills, interests, preferredSkills, education, experience, priorities }
}

/** Keyword lookup so environment answers can be tested against career data. */
const ENVIRONMENT_KEYWORDS: Record<string, string[]> = {
  outdoors: ["outdoor"],
  indoors: ["indoor", "shop", "office"],
  heights: ["rooftop", "height", "roof"],
  team: ["team", "crew"],
  independent: ["independent", "solo"],
  travel: ["job site", "travel", "route"],
  office: ["office", "desk"],
}

/** Skills implied by each non-industry enjoyment option. */
const QUIZ_OPTION_SKILLS: Record<string, string[]> = {
  machines: ["equipment-maintenance", "heavy-equipment", "equipment-repair", "troubleshooting"],
  people: ["customer-service", "crew-leadership", "sales", "communication"],
  planning: ["blueprint-reading", "estimating", "system-design", "project-management"],
  technology: ["software-tools", "data-analysis", "sensors-iot", "gps-gis"],
}

/**
 * Weighted total, renormalized over the dimensions the user actually answered,
 * so skipping a question does not silently cap the score.
 */
function totalScore(career: Career, answers: QuizAnswers): number {
  const b = scoreBreakdown(career, answers)
  const active: Array<[number, number]> = []

  if (answers.skills.length > 0) active.push([WEIGHTS.requiredSkills, b.requiredSkills])
  if (answers.enjoyment.length > 0) active.push([WEIGHTS.interests, b.interests])
  if (answers.skills.length > 0 || answers.environment.length > 0)
    active.push([WEIGHTS.preferredSkills, b.preferredSkills])
  if (answers.physical) active.push([WEIGHTS.education, b.education])
  if (answers.experience !== null || answers.training) active.push([WEIGHTS.experience, b.experience])
  if (answers.priority) active.push([WEIGHTS.priorities, b.priorities])

  if (active.length === 0) return 0
  const weight = active.reduce((sum, [w]) => sum + w, 0)
  return active.reduce((sum, [w, v]) => sum + w * v, 0) / weight
}

/** True when the user has answered enough for matching to mean anything. */
export function hasEnoughAnswers(answers: QuizAnswers): boolean {
  return (
    answers.enjoyment.length > 0 ||
    answers.skills.length > 0 ||
    answers.environment.length > 0 ||
    answers.physical !== null ||
    answers.training !== null ||
    answers.priority !== null
  )
}

/** Plain-language reasons a career surfaced. */
export function explainMatch(career: Career, answers: QuizAnswers): string[] {
  const reasons: string[] = []
  const have = new Set(answers.skills)

  const matched = career.skills.filter((s) => have.has(s))
  if (matched.length > 0) {
    const names = matched.map((s) => getSkill(s)?.name).filter(Boolean).slice(0, 3)
    reasons.push(
      `You already have ${names.join(", ")}${matched.length > 3 ? ` and ${matched.length - 3} more` : ""}.`,
    )
  }

  const wanted = interestedIndustries(answers)
  if (wanted.length > 0 && careerIndustries(career).some((i) => wanted.includes(i))) {
    reasons.push("It's in an industry you said interests you.")
  }

  if (answers.training && TRAINING_RANK[answers.training] >= TRAINING_RANK[trainingBucket(career)]) {
    reasons.push(`Training fits your timeline — about ${career.trainingTime.toLowerCase()}.`)
  } else if (isApprenticeship(career)) {
    // Don't claim it fits a short timeline, but do surface why the long number
    // is misleading: apprentices are hired and paid from the first day.
    reasons.push(
      `You'd be hired and earning from day one, though full qualification takes about ${durationPhrase(career.trainingTime)}.`,
    )
  }

  if (answers.physical && INTENSITY_RANK[career.physicalIntensity] <= INTENSITY_RANK[answers.physical]) {
    reasons.push(`The physical demand is ${career.physicalIntensity}, which matches what you wanted.`)
  }

  if (answers.priority === "own-business" && career.entrepreneurshipLevel === "high") {
    reasons.push("Many people in this role go on to run their own business.")
  }
  if (answers.priority === "fast-hire" && trainingBucket(career) === "weeks") {
    reasons.push("You can be hired into this with days or weeks of training.")
  }
  if (answers.priority === "earnings" && career.advancementLevel === "strong") {
    reasons.push("It has strong room to move up in pay and responsibility.")
  }

  if (reasons.length === 0) {
    reasons.push("It's an accessible entry point that fits part of your profile.")
  }
  return reasons
}

/** Top-N ranked matches. */
export function getMatches(answers: QuizAnswers, limit = 5): CareerMatch[] {
  const have = new Set(answers.skills)

  return CAREERS.map((career) => {
    const breakdown = scoreBreakdown(career, answers)
    return {
      career,
      score: Math.round(totalScore(career, answers) * 100),
      breakdown,
      matchedSkills: career.skills.filter((s) => have.has(s)),
      missingSkills: career.skills.filter((s) => !have.has(s)),
    }
  })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      // Tie-break toward the more accessible role so entry paths surface first.
      if (a.career.experienceYears !== b.career.experienceYears)
        return a.career.experienceYears - b.career.experienceYears
      return CAREER_LEVEL_ORDER[a.career.level] - CAREER_LEVEL_ORDER[b.career.level]
    })
    .slice(0, limit)
}

/**
 * Skill gap for a target career, with missing skills ranked by leverage:
 * how many *other* careers each one also unlocks.
 */
export function getSkillGap(career: Career, answers: QuizAnswers): SkillGap {
  const have = new Set(answers.skills)
  const missing = career.skills.filter((s) => !have.has(s))

  const ranked = missing
    .map((skillId) => ({
      skillId,
      unlocks: CAREERS.filter((c) => c.id !== career.id && c.skills.includes(skillId)).length,
    }))
    .sort((a, b) => b.unlocks - a.unlocks)

  return { have: career.skills.filter((s) => have.has(s)), missing: ranked }
}

/** Careers that come within reach if the user learns one specific skill. */
export function careersUnlockedBySkill(skillId: string, answers: QuizAnswers): Career[] {
  const have = new Set(answers.skills)
  if (have.has(skillId)) return []

  return CAREERS.filter((career) => {
    if (!career.skills.includes(skillId)) return false
    const stillMissing = career.skills.filter((s) => !have.has(s) && s !== skillId)
    return stillMissing.length <= 1
  })
}

/** Four-bar readiness breakdown (spec section 16). */
export function getReadiness(career: Career, answers: QuizAnswers): Readiness {
  const have = new Set(answers.skills)

  const requiredHave = career.skills.filter((s) => have.has(s)).length
  const skills = Math.round(ratio(requiredHave, career.skills.length) * 100)

  const requiredCerts = career.certifications.filter((c) => c.required)
  const certifications = requiredCerts.length === 0 ? 100 : 0

  const experienceValue =
    answers.experience === null
      ? 0
      : career.experienceYears === 0
        ? 100
        : Math.round(Math.min(1, answers.experience / career.experienceYears) * 100)

  const physical =
    answers.physical === null
      ? 0
      : INTENSITY_RANK[career.physicalIntensity] <= INTENSITY_RANK[answers.physical]
        ? 100
        : Math.round(Math.max(0, 1 - (INTENSITY_RANK[career.physicalIntensity] - INTENSITY_RANK[answers.physical]) * 0.5) * 100)

  const bars = [
    { label: "Skills", value: skills, hint: `${requiredHave} of ${career.skills.length} core skills` },
    {
      label: "Experience",
      value: experienceValue,
      hint: career.experienceYears === 0 ? "No experience needed" : `Typically ${career.experienceRequired}`,
    },
    {
      label: "Credentials",
      value: certifications,
      hint: requiredCerts.length === 0 ? "Nothing mandatory to start" : requiredCerts.map((c) => c.name).join(", "),
    },
    {
      label: "Physical fit",
      value: physical,
      hint: `${career.physicalIntensity.charAt(0).toUpperCase()}${career.physicalIntensity.slice(1)} intensity work`,
    },
  ]

  const overall = Math.round(skills * 0.4 + experienceValue * 0.2 + certifications * 0.2 + physical * 0.2)

  const gap = getSkillGap(career, answers)
  const actions: string[] = []
  for (const m of gap.missing.slice(0, 2)) {
    const skill = getSkill(m.skillId)
    if (skill) actions.push(`Learn ${skill.name} — also used in ${m.unlocks} other role${m.unlocks === 1 ? "" : "s"}.`)
  }
  for (const cert of requiredCerts.slice(0, 1)) {
    actions.push(`Start on ${cert.name}.`)
  }
  if (actions.length === 0) actions.push("You meet the core requirements — start applying.")

  return { overall, bars, actions }
}

/**
 * Shortest hop path from an entry-level career to the target, walking
 * nextCareers breadth-first so the first hit is the fewest steps.
 */
export function getFastestPath(targetId: string): Career[] {
  const target = getCareer(targetId)
  if (!target) return []
  if (target.level === "entry") return [target]

  let best: Career[] | null = null

  for (const start of CAREERS.filter((c) => c.level === "entry")) {
    const queue: Array<{ id: string; path: string[] }> = [{ id: start.id, path: [start.id] }]
    const seen = new Set([start.id])

    while (queue.length > 0) {
      const { id, path } = queue.shift()!
      if (id === targetId) {
        if (!best || path.length < best.length) {
          best = path.map((p) => getCareer(p)).filter((c): c is Career => Boolean(c))
        }
        break
      }
      for (const next of getCareer(id)?.nextCareers ?? []) {
        if (seen.has(next)) continue
        seen.add(next)
        queue.push({ id: next, path: [...path, next] })
      }
    }
  }

  return best ?? [target]
}

/** Narrative steps to reach a career, built from the fastest path + gaps. */
export function getPathSteps(career: Career, answers: QuizAnswers): PathStep[] {
  const path = getFastestPath(career.id)
  const steps: PathStep[] = []
  const gap = getSkillGap(career, answers)

  const firstMissing = gap.missing.slice(0, 2).map((m) => getSkill(m.skillId)?.name).filter(Boolean)
  if (firstMissing.length > 0) {
    steps.push({
      title: `Build ${firstMissing.join(" and ")}`,
      detail: "These are the core skills you're missing for this role.",
    })
  }

  path.forEach((node, i) => {
    if (node.id === career.id && path.length > 1) return
    steps.push({
      title: i === 0 ? `Start as ${node.name}` : `Move into ${node.name}`,
      detail: `${node.trainingTime}. ${node.experienceRequired === "None" ? "No prior experience required." : `Typically ${node.experienceRequired} of experience.`}`,
      careerId: node.id,
    })
  })

  const requiredCerts = career.certifications.filter((c) => c.required)
  if (requiredCerts.length > 0) {
    steps.push({
      title: `Get ${requiredCerts.map((c) => c.name).join(" and ")}`,
      detail: "Required before working unsupervised in most places. Rules vary by state.",
    })
  }

  steps.push({
    title: `Work as ${career.name}`,
    detail: career.description,
    careerId: career.id,
  })

  return steps
}
