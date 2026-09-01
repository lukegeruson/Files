"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight, Check, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { QUIZ_QUESTIONS, INDUSTRY_OPTION_IDS, QUIZ_STEP_COUNT } from "@/lib/careers/quiz"
import { SKILLS } from "@/lib/careers/skills"
import { CAREERS } from "@/lib/careers/careers"
import { useProfile } from "@/lib/careers/use-profile"
import {
  EMPTY_QUIZ_ANSWERS,
  SKILL_CATEGORY_LABELS,
  type Industry,
  type PhysicalIntensity,
  type Priority,
  type QuizAnswers,
  type SkillCategory,
  type TrainingAppetite,
} from "@/lib/careers/types"

/** How many careers require each skill — used to order the skill picker. */
const SKILL_DEMAND: Record<string, number> = (() => {
  const counts: Record<string, number> = {}
  for (const career of CAREERS) {
    for (const id of career.skills) counts[id] = (counts[id] ?? 0) + 1
  }
  return counts
})()

/** How many skills to offer before the user asks for the full catalog. */
const TOP_SKILL_COUNT = 12

const byDemand = (a: (typeof SKILLS)[number], b: (typeof SKILLS)[number]) =>
  (SKILL_DEMAND[b.id] ?? 0) - (SKILL_DEMAND[a.id] ?? 0)

function SkillChip({
  skill,
  checked,
  onToggle,
}: {
  skill: (typeof SKILLS)[number]
  checked: boolean
  onToggle: () => void
}) {
  return (
    <label
      title={skill.description}
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm transition-colors",
        checked
          ? "border-primary bg-primary/5 font-medium"
          : "border-border bg-card hover:border-muted-foreground/40",
      )}
    >
      <input type="checkbox" checked={checked} onChange={onToggle} className="sr-only" />
      {checked ? <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" /> : null}
      {skill.name}
    </label>
  )
}

export function CareerQuiz({ onComplete }: { onComplete: () => void }) {
  const { profile, hydrated, saveAnswers } = useProfile()

  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<QuizAnswers>({ ...EMPTY_QUIZ_ANSWERS })
  const [loaded, setLoaded] = useState(false)
  const [skillQuery, setSkillQuery] = useState("")
  const [showAllSkills, setShowAllSkills] = useState(false)

  // Seed the draft from a previously saved profile exactly once, so retaking
  // the quiz starts from the user's last answers instead of a blank slate.
  if (hydrated && !loaded) {
    setDraft({ ...profile.answers })
    setLoaded(true)
  }

  const chosenIndustries = useMemo(
    () => draft.enjoyment.filter((id): id is Industry => (INDUSTRY_OPTION_IDS as readonly string[]).includes(id)),
    [draft.enjoyment],
  )

  // 74 skills across 8 categories is far more than anyone will read, so the
  // default view is a short, demand-ranked shortlist. Search and "show all"
  // are the escape hatches to the full catalog.
  const skillView = useMemo(() => {
    const relevant =
      chosenIndustries.length === 0
        ? SKILLS
        : SKILLS.filter((s) => s.industries.some((i) => chosenIndustries.includes(i)))

    const q = skillQuery.trim().toLowerCase()
    if (q) {
      // Search the whole catalog, not just the industry slice: someone typing a
      // specific skill wants it found even if it sits outside their industries.
      const hits = SKILLS.filter(
        (s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q),
      ).sort(byDemand)
      return { mode: "flat" as const, skills: hits, hidden: 0, total: relevant.length }
    }

    if (showAllSkills) {
      const grouped = new Map<SkillCategory, typeof SKILLS>()
      for (const skill of relevant) {
        const list = grouped.get(skill.category) ?? []
        list.push(skill)
        grouped.set(skill.category, list)
      }
      for (const list of grouped.values()) list.sort(byDemand)
      return { mode: "grouped" as const, groups: [...grouped.entries()], total: relevant.length }
    }

    const ranked = [...relevant].sort(byDemand)
    const top = ranked.slice(0, TOP_SKILL_COUNT)
    // Keep anything already ticked on screen so collapsing the full list can
    // never hide a selection the user has to trust is still counted.
    const shownIds = new Set(top.map((s) => s.id))
    const stillSelected = ranked.filter((s) => draft.skills.includes(s.id) && !shownIds.has(s.id))
    const skills = [...top, ...stillSelected]
    return {
      mode: "flat" as const,
      skills,
      hidden: relevant.length - skills.length,
      total: relevant.length,
    }
  }, [chosenIndustries, showAllSkills, skillQuery, draft.skills])

  const isSkillStep = step === QUIZ_QUESTIONS.length
  const question = isSkillStep ? null : QUIZ_QUESTIONS[step]

  function toggleMulti(key: "enjoyment" | "environment", id: string) {
    setDraft((prev) => {
      const current = prev[key]
      return {
        ...prev,
        [key]: current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
      }
    })
  }

  function setSingle(id: string, optionId: string) {
    setDraft((prev) => {
      switch (id) {
        case "physical":
          return { ...prev, physical: optionId as PhysicalIntensity }
        case "training":
          return { ...prev, training: optionId as TrainingAppetite }
        case "priority":
          return { ...prev, priority: optionId as Priority }
        case "experience":
          return { ...prev, experience: Number(optionId) }
        default:
          return prev
      }
    })
  }

  function selectedSingle(id: string): string | null {
    switch (id) {
      case "physical":
        return draft.physical
      case "training":
        return draft.training
      case "priority":
        return draft.priority
      case "experience":
        return draft.experience === null ? null : String(draft.experience)
      default:
        return null
    }
  }

  function toggleSkill(id: string) {
    setDraft((prev) => ({
      ...prev,
      skills: prev.skills.includes(id)
        ? prev.skills.filter((s) => s !== id)
        : [...prev.skills, id],
    }))
  }

  function finish() {
    saveAnswers(draft, true)
    onComplete()
  }

  const progress = Math.round(((step + 1) / QUIZ_STEP_COUNT) * 100)

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:px-6">
      {/* Progress */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Step {step + 1} of {QUIZ_STEP_COUNT}
        </p>
        <Link
          href="/jobs"
          className="inline-flex min-h-11 items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Exit
        </Link>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary"
        role="img"
        aria-label={`Progress: step ${step + 1} of ${QUIZ_STEP_COUNT}`}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {question ? (
        <fieldset className="mt-8 border-0 p-0">
          <legend className="font-serif text-2xl font-semibold leading-snug tracking-tight text-balance md:text-3xl">
            {question.question}
          </legend>
          {question.helper ? (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{question.helper}</p>
          ) : null}

          <div className="mt-6 flex flex-col gap-2.5">
            {question.options.map((option) => {
              const multi = question.multiSelect
              const key = question.id === "enjoyment" ? "enjoyment" : "environment"
              const checked = multi
                ? draft[key].includes(option.id)
                : selectedSingle(question.id) === option.id

              return (
                <label
                  key={option.id}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
                    checked
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:border-muted-foreground/40",
                  )}
                >
                  <input
                    type={multi ? "checkbox" : "radio"}
                    name={question.id}
                    value={option.id}
                    checked={checked}
                    onChange={() =>
                      multi ? toggleMulti(key, option.id) : setSingle(question.id, option.id)
                    }
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center border",
                      multi ? "rounded-md" : "rounded-full",
                      checked ? "border-primary bg-primary text-primary-foreground" : "border-border",
                    )}
                  >
                    {checked ? <Check className="size-3.5" /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-base font-medium leading-snug">{option.label}</span>
                    {option.description ? (
                      <span className="mt-0.5 block text-sm leading-relaxed text-muted-foreground">
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>
      ) : (
        <div className="mt-8">
          <h2 className="font-serif text-2xl font-semibold leading-snug tracking-tight text-balance md:text-3xl">
            Which of these can you already do?
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Be generous — hobby and household experience counts. This is what turns your matches into
            a real gap analysis, so skipping it makes the results vaguer.
          </p>

          <div className="relative mt-5">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={skillQuery}
              onChange={(e) => setSkillQuery(e.target.value)}
              placeholder="Search all 74 skills"
              aria-label="Search skills"
              className="h-11 w-full rounded-md border border-border bg-card pl-9 pr-3 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary"
            />
          </div>

          {draft.skills.length > 0 ? (
            <p aria-live="polite" className="mt-4 text-sm text-muted-foreground">
              {draft.skills.length} selected
            </p>
          ) : null}

          <div className="mt-4">
            {skillView.mode === "grouped" ? (
              <div className="flex flex-col gap-6">
                {skillView.groups.map(([category, skills]) => (
                  <fieldset key={category} className="border-0 p-0">
                    <legend className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                      {SKILL_CATEGORY_LABELS[category]}
                    </legend>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {skills.map((skill) => (
                        <SkillChip
                          key={skill.id}
                          skill={skill}
                          checked={draft.skills.includes(skill.id)}
                          onToggle={() => toggleSkill(skill.id)}
                        />
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>
            ) : skillView.skills.length === 0 ? (
              <p className="text-sm text-muted-foreground">No skills match that search.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {skillView.skills.map((skill) => (
                  <SkillChip
                    key={skill.id}
                    skill={skill}
                    checked={draft.skills.includes(skill.id)}
                    onToggle={() => toggleSkill(skill.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {!skillQuery.trim() &&
          (skillView.mode === "grouped" || skillView.hidden > 0) ? (
            <button
              type="button"
              onClick={() => setShowAllSkills((v) => !v)}
              className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline"
            >
              {skillView.mode === "grouped"
                ? "Show fewer"
                : `Show all ${skillView.total} skills`}
            </button>
          ) : null}
        </div>
      )}

      {/* Navigation */}
      <div className="mt-10 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border px-4 text-sm font-medium transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-40"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>

        <div className="flex items-center gap-3">
          {!isSkillStep ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Skip
            </button>
          ) : null}
          {isSkillStep ? (
            <button
              type="button"
              onClick={finish}
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              See my matches
              <ArrowRight className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Next
              <ArrowRight className="size-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
