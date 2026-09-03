import Link from "next/link"
import { ArrowRight, Info, MapPin } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { ExplorerNav } from "@/components/careers/explorer-nav"
import { JobsReading } from "@/components/careers/jobs-reading"
import { EmailOpenings } from "@/components/careers/email-openings"
import {
  CompanySearch,
  CompanySearchIntro,
} from "@/components/careers/company-search"
import { getEvergreen } from "@/lib/careers/companies"
// Runs on the server only: projects the state atlas and pin coordinates so
// d3-geo and the 114KB TopoJSON never reach the client bundle.
import { buildJobMap } from "@/lib/careers/job-map"
import {
  employmentLabel,
  getLivePostings,
  jobPostingSchema,
  payLabel,
} from "@/lib/careers/postings"
import { jsonLdProps, pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({
  title: "Companies hiring near you",
  description:
    "Search local companies hiring in solar, landscaping, renovation, and agriculture by ZIP code, matched to the roles on your skill tree.",
  path: "/jobs/openings",
})

export default async function CompaniesPage() {
  const evergreen = getEvergreen()
  // Both hit the database, and neither depends on the other.
  const [map, livePostings] = await Promise.all([
    buildJobMap(),
    getLivePostings(),
  ])
  const schemas = jobPostingSchema(livePostings)

  return (
    <div className="flex min-h-screen flex-col">
      {/* One JobPosting block per real opening. First-party rows only — see
          the note on `jobPostingSchema`. */}
      {livePostings.map((row, i) => (
        <script key={row.id} {...jsonLdProps(schemas[i])} />
      ))}
      <SiteHeader />
      <ExplorerNav />
      <main className="flex-1">
        {/* Two columns from `lg` up: the title keeps the lead, and Evergreen's
            own openings ride alongside it. A fixed 21rem right column stops the
            card from stealing width from the headline as the viewport grows. */}
        <section className="mx-auto max-w-6xl px-4 pt-16 md:px-6">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-12">
            <div>
              <p className="text-sm font-medium uppercase tracking-widest text-primary">
                Companies
              </p>
              <h1 className="mt-3 font-serif text-4xl font-semibold leading-tight tracking-tight text-balance md:text-5xl">
                Find local companies hiring for your skills.
              </h1>
              <p className="mt-4 max-w-3xl text-pretty text-lg leading-relaxed text-muted-foreground">
                Enter your ZIP code to see employers near you. If you have taken
                the quiz or saved roles in the Skill Tree, we highlight the
                companies hiring for those roles first.
              </p>
              <div className="mt-6">
                <CompanySearchIntro liveCount={map.liveCount} />
              </div>
            </div>

            {/* Deliberately one compact block. This page is about the wider
                local market; Evergreen is a single employer within it. */}
            {evergreen ? (
              <div className="rounded-xl border border-border bg-card p-5 lg:self-start">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h2 className="font-serif text-xl font-semibold tracking-tight">
                    Working for Evergreen
                  </h2>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {evergreen.city}, {evergreen.state}
                  </span>
                </div>
                <ul className="mt-4 flex flex-col gap-2.5">
                  <li className="rounded-lg border border-border bg-secondary/40 px-4 py-3.5">
                    <p className="font-medium leading-snug text-balance">
                      Door to Door Lead Generation
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                      San Jose
                    </p>
                  </li>
                  <li className="rounded-lg border border-border bg-secondary/40 px-4 py-3.5">
                    <p className="font-medium leading-snug text-balance">
                      SEO Link Building Specialist
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                      Remote
                    </p>
                  </li>
                </ul>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <EmailOpenings />
                  <Link
                    href="/jobs/tree"
                    className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary"
                  >
                    Browse all roles
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {/* The wording tracks what is actually in the database. Once real
            openings exist, claiming the whole page is sample data would be as
            misleading as the reverse was before they did. */}
        <section className="mx-auto mt-8 max-w-6xl px-4 md:px-6">
          <div className="flex items-start gap-3 rounded-xl border border-border bg-secondary/40 p-4 md:p-5">
            <Info
              className="mt-0.5 size-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            {map.liveCount > 0 ? (
              <p className="text-sm leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">
                  {map.liveCount} real{" "}
                  {map.liveCount === 1 ? "opening" : "openings"} on the map.
                </span>{" "}
                Solid pins are live roles you can apply to. Hollow pins are
                illustrative sample employers that do not exist — they are there
                so the skill matching works across the whole country while our
                own listings are still few.
              </p>
            ) : (
              <p className="text-sm leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">
                  Sample data for now.
                </span>{" "}
                These are illustrative employers, not live postings — the search
                runs against a small seeded directory so the matching works
                end-to-end. Real openings will appear here as we post them.
              </p>
            )}
          </div>
        </section>

        <div className="mt-12 pb-10">
          <CompanySearch map={map} />
        </div>

        {/* Plain list of every real opening, below the map.
            The map cannot place ZIPs outside the Albers-USA projection, so
            openings in Puerto Rico, Guam or the Virgin Islands have no pin.
            This list is the one place they are guaranteed to appear. */}
        {livePostings.length > 0 ? (
          <section className="mx-auto max-w-6xl px-4 pb-14 md:px-6">
            <h2 className="font-serif text-2xl font-semibold tracking-tight">
              All open roles
            </h2>
            <ul className="mt-6 flex flex-col gap-3">
              {livePostings.map((row) => {
                const pay = payLabel(row)
                const href =
                  row.applyUrl ??
                  (row.applyEmail
                    ? `mailto:${row.applyEmail}?subject=${encodeURIComponent(
                        `Application: ${row.title}`,
                      )}`
                    : null)
                return (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 rounded-xl border border-border bg-card p-4 md:p-5"
                  >
                    <div className="min-w-0">
                      <h3 className="font-medium">{row.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {row.employer} · {row.city}, {row.state} ·{" "}
                        {employmentLabel(row.employmentType)}
                        {pay ? ` · ${pay}` : ""}
                      </p>
                    </div>
                    {href ? (
                      <a
                        href={href}
                        {...(row.applyUrl
                          ? { target: "_blank", rel: "noopener noreferrer" }
                          : {})}
                        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                      >
                        Apply
                        <ArrowRight className="size-3.5" aria-hidden="true" />
                      </a>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </section>
        ) : null}

        <JobsReading />
      </main>
      <SiteFooter />
    </div>
  )
}
