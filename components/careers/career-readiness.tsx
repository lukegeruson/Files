"use client"

import Link from "next/link"
import { ArrowRight, Bookmark, BookmarkCheck, Check, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"
import { useProfile } from "@/lib/careers/use-profile"
import { getPathSteps, getReadiness, getSkillGap, hasEnoughAnswers } from "@/lib/careers/matching"
import { skillName } from "@/lib/careers/skills"
import type { Career } from "@/lib/careers/types"
import { Meter, ReadinessBars } from "./career-bits"

export function CareerReadiness({ career }: { career: Career }) {
  const { profile, hydrated, toggleSaved } = useProfile()

  const saved = profile.savedCareers.includes(career.id)
  const answered = hydrated && hasEnoughAnswers(profile.answers)

  return (
    <div className="flex flex-col gap-6">
      {/* Save control renders immediately; only its label depends on storage. */}
      <button
        type="button"
        onClick={() => toggleSaved(career.id)}
        aria-pressed={saved}
        className={cn(
          "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border px-5 text-sm font-medium transition-colors",
          saved
            ? "border-primary bg-primary/5 text-foreground"
            : "border-border bg-card hover:bg-secondary",
        )}
      >
        {saved ? (
          <BookmarkCheck className="size-4 text-primary" aria-hidden="true" />
        ) : (
          <Bookmark className="size-4" aria-hidden="true" />
        )}
        {saved ? "Saved" : "Save this career"}
      </button>

      {!hydrated ? (
        <div className="h-40 animate-pulse rounded-xl bg-secondary" />
      ) : !answered ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-serif text-lg font-semibold">How ready are you?</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Answer the quiz and this panel fills in with your readiness score, the exact skills you
            are missing, and the shortest route from where you are now.
          </p>
          <Link
            href="/jobs/quiz?view=quiz"
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Take the quiz
            <ArrowRight className="size-4" />
          </Link>
        </div>
      ) : (
        <ReadinessDetail career={career} />
      )}

      {/* Sits below the readiness panel in every state — hiring geography is
          useful whether or not the reader has taken the quiz. */}
      <Link
        href="/jobs/openings"
        className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <h2 className="flex items-center gap-2 font-serif text-lg font-semibold">
          <MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
          Discover Local Companies
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          View local job opportunities across the map of the U.S.
        </p>
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
          Browse the map
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
        </span>
      </Link>
    </div>
  )
}

function ReadinessDetail({ career }: { career: Career }) {
  const { profile } = useProfile()
  const readiness = getReadiness(career, profile.answers)
  const gap = getSkillGap(career, profile.answers)
  const steps = getPathSteps(career, profile.answers)

  return (
    <>
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-serif text-lg font-semibold">Your readiness</h2>
          <span className="font-serif text-2xl font-semibold tabular-nums text-primary">
            {readiness.overall}%
          </span>
        </div>
        <Meter className="mt-3 h-2" value={readiness.overall} label="Overall readiness" />
        <div className="mt-6">
          <ReadinessBars bars={readiness.bars} />
        </div>
        {readiness.actions.length > 0 ? (
          <div className="mt-6 border-t border-border pt-5">
            <h3 className="text-sm font-semibold">Do these next</h3>
            <ol className="mt-2 flex flex-col gap-2">
              {readiness.actions.map((action, i) => (
                <li key={action} className="flex gap-2.5 text-sm leading-relaxed">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground">{action}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-serif text-lg font-semibold">Your skill gap</h2>

        {gap.have.length > 0 ? (
          <div className="mt-4">
            <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Already have
            </h3>
            <ul className="mt-2 flex flex-wrap gap-2">
              {gap.have.map((id) => (
                <li
                  key={id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary bg-primary/5 px-3 py-1 text-sm"
                >
                  <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                  {skillName(id)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {gap.missing.length > 0 ? (
          <div className="mt-5">
            <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Still to learn
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Ordered by leverage — the ones at the top are used by the most other roles too.
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {gap.missing.map(({ skillId, unlocks }) => (
                <li key={skillId} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">{skillName(skillId)}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {unlocks === 0
                      ? "specific to this role"
                      : `+${unlocks} other ${unlocks === 1 ? "role" : "roles"}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            You have claimed every core skill this role needs.
          </p>
        )}
      </section>

      {steps.length > 0 ? (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-serif text-lg font-semibold">Your route in</h2>
          <ol className="mt-4 flex flex-col gap-4">
            {steps.map((step, i) => (
              <li key={`${step.title}-${i}`} className="flex gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  {step.careerId ? (
                    <Link
                      href={`/jobs/careers/${step.careerId}`}
                      className="text-sm font-medium transition-colors hover:text-primary"
                    >
                      {step.title}
                    </Link>
                  ) : (
                    <p className="text-sm font-medium">{step.title}</p>
                  )}
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </>
  )
}
