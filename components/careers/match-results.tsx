"use client"

import Link from "next/link"
import { ArrowRight, GitBranch, Lightbulb } from "lucide-react"
import { useProfile } from "@/lib/careers/use-profile"
import { explainMatch, getMatches, getSkillGap, hasEnoughAnswers } from "@/lib/careers/matching"
import { skillName } from "@/lib/careers/skills"
import { CareerCard } from "./career-card"
import { ScoreBadge } from "./career-bits"

export function MatchResults({ onRetake }: { onRetake: () => void }) {
  const { profile, hydrated } = useProfile()

  // Profile lives in localStorage, so nothing profile-dependent can render
  // until the first client effect has run.
  if (!hydrated) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 md:px-6">
        <div className="h-8 w-56 animate-pulse rounded-md bg-secondary" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-52 animate-pulse rounded-xl bg-secondary" />
          ))}
        </div>
      </div>
    )
  }

  if (!hasEnoughAnswers(profile.answers)) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center md:px-6">
        {/* H2, not H1: the quiz page owns the single server-rendered H1. */}
        <h2 className="font-serif text-3xl font-semibold tracking-tight text-balance">
          No answers yet
        </h2>
        <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
          Take the quiz and we&apos;ll rank all the roles against what you told us, then show you the
          exact skills between you and each one.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onRetake}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Take the quiz
            <ArrowRight className="size-4" />
          </button>
          <Link
            href="/jobs/tree"
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-5 text-sm font-medium transition-colors hover:bg-secondary"
          >
            <GitBranch className="size-4" />
            Browse the skill trees
          </Link>
        </div>
      </div>
    )
  }

  const matches = getMatches(profile.answers, 12)
  const top = matches[0]
  const gap = top ? getSkillGap(top.career, profile.answers) : null
  const leverage = gap?.missing.filter((m) => m.unlocks > 0).slice(0, 6) ?? []

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:px-6">
      <p className="text-sm font-medium uppercase tracking-widest text-primary">Your matches</p>
      <h2 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-balance md:text-4xl">
        {matches.length} roles ranked against your answers
      </h2>
      <p className="mt-3 max-w-3xl text-pretty leading-relaxed text-muted-foreground">
        Scores weigh the skills you already have, your stated interests, training timeline, physical
        comfort, and what you said matters most. Skipped questions are left out of the maths rather
        than counted against you.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={onRetake}
          className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline"
        >
          Restart Quiz
        </button>
        <Link
          href="/jobs/tree"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <GitBranch className="size-3.5" />
          See the skill trees
        </Link>
      </div>

      {/* Top match, called out with its reasoning. */}
      {top ? (
        <section className="mt-10 rounded-xl border border-primary bg-primary/5 p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-widest text-primary">
                Strongest match
              </p>
              <h2 className="mt-2 font-serif text-2xl font-semibold leading-snug">
                {top.career.name}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {top.career.description}
              </p>
            </div>
            <ScoreBadge score={top.score} className="text-2xl" />
          </div>

          <div className="mt-5 grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold">Why it surfaced</h3>
              <ul className="mt-2 flex flex-col gap-1.5">
                {explainMatch(top.career, profile.answers).map((reason) => (
                  <li key={reason} className="text-sm leading-relaxed text-muted-foreground">
                    {reason}
                  </li>
                ))}
              </ul>
            </div>

            {leverage.length > 0 ? (
              <div>
                <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                  <Lightbulb className="size-4 text-primary" aria-hidden="true" />
                  Highest-leverage skills to learn
                </h3>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {leverage.map(({ skillId, unlocks }) => (
                    <li key={skillId} className="text-sm leading-relaxed text-muted-foreground">
                      <span className="font-medium text-foreground">{skillName(skillId)}</span> — also
                      used by {unlocks} other {unlocks === 1 ? "role" : "roles"}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <Link
            href={`/jobs/careers/${top.career.id}`}
            className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            See the full path
            <ArrowRight className="size-4" />
          </Link>
        </section>
      ) : null}

      <h2 className="mt-12 font-serif text-2xl font-semibold tracking-tight">The rest of the list</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {matches.slice(1).map((match) => (
          <CareerCard key={match.career.id} career={match.career} score={match.score}>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              {match.matchedSkills.length > 0
                ? `You have ${match.matchedSkills.length} of ${match.career.skills.length} core skills.`
                : `Needs ${match.career.skills.length} core skills you haven't claimed yet.`}
            </p>
          </CareerCard>
        ))}
      </div>
    </div>
  )
}
