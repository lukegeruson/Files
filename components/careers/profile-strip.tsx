"use client"

import Link from "next/link"
import { ArrowRight, RotateCcw } from "lucide-react"
import { useProfile } from "@/lib/careers/use-profile"
import { getMatches, hasEnoughAnswers } from "@/lib/careers/matching"
import { ScoreBadge } from "./career-bits"

/**
 * Shows quiz state on the explorer landing page.
 *
 * Renders nothing until `hydrated` is true: the profile lives in localStorage,
 * so drawing it during SSR would cause a hydration mismatch.
 */
export function ProfileStrip() {
  const { profile, hydrated, reset } = useProfile()

  if (!hydrated) return null

  const answered = hasEnoughAnswers(profile.answers)
  if (!answered) return null

  const top = getMatches(profile.answers, 1)[0]

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Your saved answers
          </p>
          {top ? (
            <p className="mt-2 font-serif text-lg font-semibold leading-snug">
              Top match: {top.career.name}
            </p>
          ) : null}
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {profile.savedCareers.length > 0
              ? `${profile.savedCareers.length} career${profile.savedCareers.length === 1 ? "" : "s"} saved.`
              : "Answers are stored on this device only."}
          </p>
        </div>
        {top ? <ScoreBadge score={top.score} /> : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link
          href="/jobs/quiz?view=results"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary"
        >
          See all matches
          <ArrowRight className="size-3.5" />
        </Link>
        <Link
          href="/jobs/quiz?view=quiz"
          className="inline-flex min-h-11 items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Retake
        </Link>
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <RotateCcw className="size-3.5" />
          Clear
        </button>
      </div>
    </div>
  )
}
