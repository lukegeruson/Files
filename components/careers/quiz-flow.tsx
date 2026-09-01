"use client"

import { useCallback, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useProfile } from "@/lib/careers/use-profile"
import { hasEnoughAnswers } from "@/lib/careers/matching"
import { CareerQuiz } from "./career-quiz"
import { MatchResults } from "./match-results"

type View = "quiz" | "results"

/**
 * Quiz and results as a single destination.
 *
 * Finishing the quiz swaps this view in place rather than navigating, so the
 * answers-to-results moment has no page transition. Which view opens first is
 * derived from the stored profile: someone returning after finishing should see
 * their matches, not be made to retake the quiz to reach them.
 */
export function QuizFlow() {
  const { profile, hydrated } = useProfile()
  const [view, setView] = useState<View | null>(null)
  // Lets callers aim at a specific view: "Retake" must reach the questions even
  // though a finished profile would otherwise open on results, and "See all
  // matches" must reach results. Once the user acts, state takes over.
  const forced = useSearchParams().get("view")

  // Scroll back to the top on every swap — the two views have very different
  // heights, so keeping the old offset can drop you mid-page in the new one.
  const go = useCallback((next: View) => {
    setView(next)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  const showResults = useCallback(() => go("results"), [go])
  const showQuiz = useCallback(() => go("quiz"), [go])

  // The profile lives in localStorage, so the starting view isn't knowable
  // until the first client effect. Hold back both views rather than guessing
  // and flashing the wrong one.
  if (!hydrated) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 md:px-6">
        <div className="h-1.5 w-full animate-pulse rounded-full bg-secondary" />
        <div className="mt-8 h-9 w-3/4 animate-pulse rounded-md bg-secondary" />
        <div className="mt-6 flex flex-col gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-secondary" />
          ))}
        </div>
      </div>
    )
  }

  // `completedQuiz` and not just `hasEnoughAnswers`: the latter passes on a
  // single skill ticked from a career page, which would drop someone into
  // results for a quiz they never took.
  const finished = profile.completedQuiz && hasEnoughAnswers(profile.answers)
  const resolved: View =
    view ??
    (forced === "quiz" || forced === "results" ? forced : finished ? "results" : "quiz")

  return resolved === "results" ? (
    <MatchResults onRetake={showQuiz} />
  ) : (
    <CareerQuiz onComplete={showResults} />
  )
}
