import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import type { Career } from "@/lib/careers/types"
import { IndustryTag, LevelBadge, ScoreBadge } from "./career-bits"

export function CareerCard({
  career,
  score,
  children,
}: {
  career: Career
  /** Match percentage, shown only when the user has quiz answers. */
  score?: number
  /** Extra content (match reasons, skill chips) rendered above the CTA. */
  children?: ReactNode
}) {
  return (
    <Link
      href={`/jobs/careers/${career.id}`}
      className="group flex flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-serif text-lg font-semibold leading-snug">{career.name}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <IndustryTag industry={career.industry} />
            <LevelBadge level={career.level} />
          </div>
        </div>
        {typeof score === "number" ? <ScoreBadge score={score} /> : null}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{career.description}</p>

      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
        <div>
          <dt className="inline font-medium text-foreground">Training: </dt>
          <dd className="inline">{career.trainingTime}</dd>
        </div>
        <div>
          <dt className="inline font-medium text-foreground">Experience: </dt>
          <dd className="inline">{career.experienceRequired}</dd>
        </div>
      </dl>

      {children}

      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
        View path
        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
      </span>
    </Link>
  )
}
