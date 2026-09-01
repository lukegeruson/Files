import Link from "next/link"
import { ArrowRight, Building2, GitBranch, ListChecks } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { ExplorerNav } from "@/components/careers/explorer-nav"
import { ProfileStrip } from "@/components/careers/profile-strip"
import { JobsReading } from "@/components/careers/jobs-reading"
import { CAREERS } from "@/lib/careers/careers"
import { INDUSTRIES, INDUSTRY_META } from "@/lib/careers/industries"
import { QUIZ_STEP_COUNT_WORD } from "@/lib/careers/quiz"
import type { Career, Industry } from "@/lib/careers/types"
import { pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({
  title: "Career paths in the skilled trades",
  description:
    "Explore skilled trade careers in solar, landscaping, renovation, and agriculture. See what each role needs, what it leads to, and how your skills transfer.",
  path: "/jobs",
})

/**
 * Every step is actionable and lands on its own explorer tab, in the order a
 * reader works through them: quiz to Matches, path to Skill Tree, fit to
 * Companies.
 */
const STEPS: {
  icon: LucideIcon
  title: string
  detail: string
  href: string
  cta: string
}[] = [
  {
    icon: ListChecks,
    title: `Answer ${QUIZ_STEP_COUNT_WORD} questions`,
    detail:
      "Interests, work environment, how physical you want the job, how long you can train before you need to earn, and what you can already do.",
    // `view=quiz` opens the questions rather than the saved-results view,
    // matching the hero CTA above.
    href: "/jobs/quiz?view=quiz",
    cta: "Start the quiz",
  },
  {
    icon: GitBranch,
    title: "Follow the path",
    detail:
      "Every role shows what it leads to next and which careers in other industries your skills already transfer to.",
    href: "/jobs/tree",
    cta: "Explore skill trees",
  },
  {
    icon: Building2,
    title: "See where you fit",
    detail:
      "Ranked matches with the reasoning behind each one, plus the exact skills standing between you and the role.",
    href: "/jobs/openings",
    cta: "Browse companies",
  },
]

/** A role can belong to more than one industry, so count both homes. */
function industriesOf(career: Career): Industry[] {
  return [career.industry, ...(career.alsoInIndustries ?? [])]
}

export default function CareerExplorerPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <ExplorerNav />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 pt-16 md:px-6">
          <p className="text-sm font-medium uppercase tracking-widest text-primary">Careers</p>
          <h1 className="mt-3 max-w-4xl font-serif text-4xl font-semibold leading-tight tracking-tight text-balance md:text-5xl">
            Build your skill tree.
          </h1>
          <p className="mt-4 max-w-3xl text-pretty text-lg leading-relaxed text-muted-foreground">
            {CAREERS.length} roles across four industries, mapped by the skills they actually share.
            See what a job needs, what it leads to, and where the same skills can take you next.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/jobs/quiz?view=quiz"
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Take the quiz
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/jobs/tree"
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-5 text-sm font-medium transition-colors hover:bg-secondary"
            >
              <GitBranch className="size-4" />
              Explore Skill Trees
            </Link>
            <Link
              href="/jobs/openings"
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-5 text-sm font-medium transition-colors hover:bg-secondary"
            >
              <Building2 className="size-4" />
              Work for Evergreen
            </Link>
          </div>
        </section>

        <section className="mx-auto mt-10 max-w-6xl px-4 md:px-6">
          <ProfileStrip />
        </section>

        <section className="mx-auto max-w-6xl px-4 pt-14 md:px-6">
          <h2 className="font-serif text-2xl font-semibold tracking-tight">Pick an industry</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {INDUSTRIES.map((industry) => {
              const meta = INDUSTRY_META[industry]
              const count = CAREERS.filter((c) => industriesOf(c).includes(industry)).length
              return (
                <Link
                  key={industry}
                  href={`/jobs/tree?industry=${industry}`}
                  className="group flex flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary"
                >
                  <span className={`h-1 w-10 rounded-full ${meta.accent.dot}`} aria-hidden="true" />
                  <h3 className="mt-4 font-serif text-lg font-semibold">{meta.label}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {meta.blurb}
                  </p>
                  <p className="mt-4 text-xs text-muted-foreground">
                    {count} roles · {meta.families.length} specialties
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
                    Explore
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              )
            })}
          </div>
        </section>

        {/* Carries the page's bottom padding now that it is the last section
            before the reading list's own top border. */}
        <section className="mx-auto max-w-6xl px-4 py-14 md:px-6">
          <h2 className="font-serif text-2xl font-semibold tracking-tight">How it works</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {STEPS.map((step) => (
              <Link
                key={step.title}
                href={step.href}
                className="group flex flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <step.icon className="size-5 text-primary" aria-hidden="true" />
                <h3 className="mt-3 font-serif text-base font-semibold">{step.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {step.detail}
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  {step.cta}
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Full collection here; the other jobs pages show a capped preview. */}
        <JobsReading />
      </main>
      <SiteFooter />
    </div>
  )
}
