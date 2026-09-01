// Pure, dependency-free career-tool types.
// Mirrors the approach in lib/categories.ts: no database imports here, so these
// types and the data modules that use them are safe to import from client
// components without pulling the pg driver into the browser bundle.

import type { Category } from "@/lib/categories"

/**
 * The career tool's four industries intentionally reuse the site's existing
 * content categories, so a career can point at the 125 published articles
 * later (Phase 3) without a second taxonomy to keep in sync.
 */
export type Industry = Category

/** The six-rung ladder every career family is placed on. */
export const CAREER_LEVELS = [
  "entry",
  "skilled",
  "specialist",
  "lead",
  "management",
  "owner",
] as const

export type CareerLevel = (typeof CAREER_LEVELS)[number]

export const CAREER_LEVEL_LABELS: Record<CareerLevel, string> = {
  entry: "Entry level",
  skilled: "Skilled",
  specialist: "Specialist",
  lead: "Lead",
  management: "Management",
  owner: "Owner",
}

/** Ordinal position of a level, used for sorting and ladder rendering. */
export const CAREER_LEVEL_ORDER: Record<CareerLevel, number> = {
  entry: 0,
  skilled: 1,
  specialist: 2,
  lead: 3,
  management: 4,
  owner: 5,
}

export type SkillCategory =
  | "physical"
  | "technical"
  | "mechanical"
  | "digital"
  | "business"
  | "people"
  | "safety"
  | "environmental"

export const SKILL_CATEGORY_LABELS: Record<SkillCategory, string> = {
  physical: "Physical & hands-on",
  technical: "Technical",
  mechanical: "Mechanical",
  digital: "Digital & data",
  business: "Business",
  people: "People & communication",
  safety: "Safety & compliance",
  environmental: "Environmental",
}

export type Skill = {
  id: string
  name: string
  category: SkillCategory
  description: string
  /** Industries where this skill is commonly used. */
  industries: Industry[]
  /** Skills that tend to be learned alongside this one. */
  relatedSkills: string[]
}

/**
 * A credential a career commonly expects.
 *
 * `required` exists so the UI never implies a license is legally mandated when
 * it is only customary. Licensing rules vary by state, county, and job scope,
 * so anything uncertain is stored as `required: false` and rendered as
 * "commonly expected" rather than "required".
 */
export type Certification = {
  name: string
  required: boolean
  note?: string
}

export type PhysicalIntensity = "low" | "moderate" | "high"
export type AdvancementLevel = "limited" | "moderate" | "strong"
export type EntrepreneurshipLevel = "low" | "moderate" | "high"

export type Career = {
  id: string
  name: string
  /** Primary industry. Shared nodes list their other homes in `alsoInIndustries`. */
  industry: Industry
  /**
   * Some roles genuinely belong to more than one industry (an electrician works
   * in both solar and renovation). Rather than duplicating the node, the extra
   * industries are listed here so filters and the tree can show it in both.
   */
  alsoInIndustries?: Industry[]
  careerFamily: string
  level: CareerLevel
  description: string
  tasks: string[]
  /** Skill ids that matter most for this role. */
  skills: string[]
  /** Skill ids that help but are not core. */
  preferredSkills: string[]
  educationRequirements: string[]
  certifications: Certification[]
  /** Human-readable experience expectation, e.g. "None" or "2-4 years". */
  experienceRequired: string
  /** Rough years of experience, used by the matching engine. */
  experienceYears: number
  workEnvironment: string[]
  physicalIntensity: PhysicalIntensity
  /** Realistic time to become employable in this role. */
  trainingTime: string
  advancementLevel: AdvancementLevel
  entrepreneurshipLevel: EntrepreneurshipLevel
  /** Career ids that are a natural promotion from here. */
  nextCareers: string[]
  /** Career ids in the same industry that use similar skills. */
  relatedCareers: string[]
  /** Career ids in a *different* industry reachable with existing skills. */
  transferableCareers: string[]
}

/** A crossover chain: one skill that opens doors across industries. */
export type TransferableChain = {
  id: string
  /** The shared skill id at the centre of the chain. */
  skillId: string
  label: string
  description: string
  careerIds: string[]
}

// ---------------------------------------------------------------------------
// Quiz
// ---------------------------------------------------------------------------

export type QuizQuestionId =
  | "enjoyment"
  | "environment"
  | "physical"
  | "training"
  | "priority"
  | "experience"

export type QuizOption = {
  id: string
  label: string
  description?: string
  /** Skill ids implied by picking this option. */
  skills?: string[]
  /** Work environments implied by picking this option. */
  environments?: string[]
}

export type QuizQuestion = {
  id: QuizQuestionId
  question: string
  helper?: string
  /** Multi-select questions let the user pick several options. */
  multiSelect: boolean
  options: QuizOption[]
}

export type TrainingAppetite = "weeks" | "months" | "year-plus" | "any"
export type Priority = "fast-hire" | "earnings" | "own-business" | "stability" | "outdoors"

export type QuizAnswers = {
  /** Option ids from the "what do you enjoy" question. */
  enjoyment: string[]
  /** Preferred work environments. */
  environment: string[]
  /** Comfort with physical work. */
  physical: PhysicalIntensity | null
  /** How long the user is willing to train. */
  training: TrainingAppetite | null
  /** What matters most to them. */
  priority: Priority | null
  /** Rough years of relevant experience. */
  experience: number | null
  /** Skills the user says they already have (skill ids). */
  skills: string[]
}

export const EMPTY_QUIZ_ANSWERS: QuizAnswers = {
  enjoyment: [],
  environment: [],
  physical: null,
  training: null,
  priority: null,
  experience: null,
  skills: [],
}

// ---------------------------------------------------------------------------
// Matching results
// ---------------------------------------------------------------------------

export type ScoreBreakdown = {
  requiredSkills: number
  interests: number
  preferredSkills: number
  education: number
  experience: number
  priorities: number
}

export type CareerMatch = {
  career: Career
  /** 0-100. */
  score: number
  breakdown: ScoreBreakdown
  /** Skill ids the user already has that this career needs. */
  matchedSkills: string[]
  /** Skill ids this career needs that the user lacks. */
  missingSkills: string[]
}

export type SkillGap = {
  have: string[]
  /** Ordered by leverage: skills unlocking the most careers come first. */
  missing: { skillId: string; unlocks: number }[]
}

export type PathStep = {
  title: string
  detail: string
  /** Optional career id when the step is "work this role for a while". */
  careerId?: string
}

export type ReadinessBar = {
  label: string
  /** 0-100. */
  value: number
  hint: string
}

export type Readiness = {
  /** 0-100 overall. */
  overall: number
  bars: ReadinessBar[]
  /** Up to three concrete next actions. */
  actions: string[]
}
