import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight, ShieldCheck } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { ExplorerNav } from "@/components/careers/explorer-nav"
import { CareerReadiness } from "@/components/careers/career-readiness"
import { CareerCard } from "@/components/careers/career-card"
import { IndustryTag, LevelBadge } from "@/components/careers/career-bits"
import { CAREERS, getCareer } from "@/lib/careers/careers"
import { getFastestPath } from "@/lib/careers/matching"
import { getSkill, skillName } from "@/lib/careers/skills"
import { INDUSTRY_META } from "@/lib/careers/industries"
import { CAREER_LEVEL_LABELS } from "@/lib/careers/types"
import { absoluteUrl, jsonLdProps, pageMetadata } from "@/lib/seo"

export function generateStaticParams() {
  return CAREERS.map((career) => ({ id: career.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const career = getCareer(id)
  if (!career) return { title: "Career not found", robots: { index: false, follow: true } }
  return pageMetadata({
    title: `${career.name} — career path, skills, and training`,
    description: career.description,
    path: `/jobs/careers/${career.id}`,
  })
}

function SkillChips({ ids }: { ids: string[] }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {ids.map((id) => {
        const skill = getSkill(id)
        return (
          <li
            key={id}
            title={skill?.description}
            className="rounded-full border border-border px-3 py-1 text-sm text-muted-foreground"
          >
            {skillName(id)}
          </li>
        )
      })}
    </ul>
  )
}

export default async function CareerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const career = getCareer(id)
  if (!career) notFound()

  const path = getFastestPath(career.id)
  const nextRoles = career.nextCareers.map(getCareer).filter((c): c is NonNullable<typeof c> => !!c)
  const related = career.relatedCareers.map(getCareer).filter((c): c is NonNullable<typeof c> => !!c)
  const transfers = career.transferableCareers
    .map(getCareer)
    .filter((c): c is NonNullable<typeof c> => !!c)

  // `capitalize` tidies the single-word enum values ("moderate" -> "Moderate").
  // Prose values opt out, so "4-5 year apprenticeship" isn't title-cased.
  const facts = [
    { label: "Training time", value: career.trainingTime, asWritten: true },
    { label: "Experience expected", value: career.experienceRequired, asWritten: true },
    { label: "Physical demand", value: career.physicalIntensity },
    { label: "Room to advance", value: career.advancementLevel },
    { label: "Path to ownership", value: career.entrepreneurshipLevel },
    { label: "Level", value: CAREER_LEVEL_LABELS[career.level] },
  ]

  // Occupation schema built only from fields the career record actually has.
  // No salary data is emitted because the dataset carries none, and inventing
  // an estimatedSalary would be both wrong and a structured-data violation.
  const occupationSchema = {
    "@context": "https://schema.org",
    "@type": "Occupation",
    "@id": absoluteUrl(`/jobs/careers/${career.id}#occupation`),
    name: career.name,
    description: career.description,
    occupationalCategory: career.careerFamily,
    industry: INDUSTRY_META[career.industry].label,
    skills: career.skills.map(skillName),
    responsibilities: career.tasks,
    ...(career.educationRequirements.length > 0 && {
      educationRequirements: career.educationRequirements.join("; "),
    }),
    ...(career.experienceRequired && {
      experienceRequirements: career.experienceRequired,
    }),
    mainEntityOfPage: absoluteUrl(`/jobs/careers/${career.id}`),
    inLanguage: "en-US",
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <ExplorerNav />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-12 md:px-6">
          <script {...jsonLdProps(occupationSchema)} />

          {/* Supersedes the old single back-link. The middle crumb keeps the
              industry-filtered tree destination that link used to provide. */}
          <Breadcrumbs
            items={[
              { name: "Career paths", href: "/jobs" },
              {
                name: INDUSTRY_META[career.industry].label,
                href: `/jobs/tree?industry=${career.industry}`,
              },
              { name: career.name },
            ]}
          />

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            <IndustryTag industry={career.industry} />
            {career.alsoInIndustries?.map((i) => <IndustryTag key={i} industry={i} />)}
            <LevelBadge level={career.level} />
            <span className="text-xs text-muted-foreground">{career.careerFamily}</span>
          </div>

          <h1 className="mt-3 font-serif text-4xl font-semibold leading-tight tracking-tight text-balance md:text-5xl">
            {career.name}
          </h1>
          <p className="mt-4 max-w-3xl text-pretty text-lg leading-relaxed text-muted-foreground">
            {career.description}
          </p>

          <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_20rem]">
            {/* Main column */}
            <div className="flex flex-col gap-10">
              <section>
                <h2 className="font-serif text-2xl font-semibold tracking-tight">
                  What you&apos;d actually do
                </h2>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {career.tasks.map((task) => (
                    <li key={task} className="flex gap-2.5 text-sm leading-relaxed">
                      <span
                        className="mt-2 size-1.5 shrink-0 rounded-full bg-primary"
                        aria-hidden="true"
                      />
                      <span className="text-muted-foreground">{task}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h2 className="font-serif text-2xl font-semibold tracking-tight">The facts</h2>
                <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  {facts.map((fact) => (
                    <div key={fact.label} className="border-t border-border pt-3">
                      <dt className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                        {fact.label}
                      </dt>
                      <dd
                        className={`mt-1 text-sm font-medium ${fact.asWritten ? "" : "capitalize"}`}
                      >
                        {fact.value}
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-6 border-t border-border pt-3">
                  <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    Work environment
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {career.workEnvironment.join(" · ")}
                  </p>
                </div>
              </section>

              <section>
                <h2 className="font-serif text-2xl font-semibold tracking-tight">Skills</h2>
                <h3 className="mt-4 text-sm font-semibold">Core to the job</h3>
                <SkillChips ids={career.skills} />
                {career.preferredSkills.length > 0 ? (
                  <>
                    <h3 className="mt-5 text-sm font-semibold">Helps you stand out</h3>
                    <SkillChips ids={career.preferredSkills} />
                  </>
                ) : null}
              </section>

              <section>
                <h2 className="font-serif text-2xl font-semibold tracking-tight">
                  Education &amp; credentials
                </h2>
                <ul className="mt-4 flex flex-col gap-2">
                  {career.educationRequirements.map((req) => (
                    <li key={req} className="text-sm leading-relaxed text-muted-foreground">
                      {req}
                    </li>
                  ))}
                </ul>

                {career.certifications.length > 0 ? (
                  <ul className="mt-5 flex flex-col gap-3">
                    {career.certifications.map((cert) => (
                      <li
                        key={cert.name}
                        className="rounded-xl border border-border bg-card p-4"
                      >
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <ShieldCheck
                            className="size-4 shrink-0 text-primary"
                            aria-hidden="true"
                          />
                          <span className="text-sm font-medium">{cert.name}</span>
                          <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                            {cert.required ? "Usually required" : "Commonly expected"}
                          </span>
                        </div>
                        {cert.note ? (
                          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {cert.note}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                  Licensing rules vary by state, county, and job scope. Always confirm what applies
                  where you plan to work.
                </p>
              </section>

              {path.length > 1 ? (
                <section>
                  <h2 className="font-serif text-2xl font-semibold tracking-tight">
                    Shortest route from the ground up
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    The usual ladder people climb to reach this role.
                  </p>
                  <ol className="mt-4 flex flex-wrap items-center gap-2">
                    {path.map((step, i) => (
                      <li key={step.id} className="flex items-center gap-2">
                        <Link
                          href={`/jobs/careers/${step.id}`}
                          className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm transition-colors ${
                            step.id === career.id
                              ? "border-primary bg-primary/5 font-medium"
                              : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
                          }`}
                        >
                          {step.name}
                        </Link>
                        {i < path.length - 1 ? (
                          <ChevronRight
                            className="size-4 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                          />
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}

              {nextRoles.length > 0 ? (
                <section>
                  <h2 className="font-serif text-2xl font-semibold tracking-tight">
                    Where this leads
                  </h2>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {nextRoles.map((next) => (
                      <CareerCard key={next.id} career={next} />
                    ))}
                  </div>
                </section>
              ) : null}

              {(related.length > 0 || transfers.length > 0) && (
                <section className="grid gap-8 sm:grid-cols-2">
                  {related.length > 0 ? (
                    <div>
                      <h2 className="font-serif text-lg font-semibold tracking-tight">
                        Similar roles nearby
                      </h2>
                      <ul className="mt-3 flex flex-col gap-2">
                        {related.map((c) => (
                          <li key={c.id}>
                            <Link
                              href={`/jobs/careers/${c.id}`}
                              className="inline-flex min-h-11 items-center text-sm underline-offset-4 transition-colors hover:text-primary hover:underline"
                            >
                              {c.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {transfers.length > 0 ? (
                    <div>
                      <h2 className="font-serif text-lg font-semibold tracking-tight">
                        Your skills also transfer to
                      </h2>
                      <ul className="mt-3 flex flex-col gap-2">
                        {transfers.map((c) => (
                          <li key={c.id} className="flex flex-col">
                            <Link
                              href={`/jobs/careers/${c.id}`}
                              className="inline-flex min-h-11 items-center text-sm underline-offset-4 transition-colors hover:text-primary hover:underline"
                            >
                              {c.name}
                            </Link>
                            <span className="text-xs text-muted-foreground">
                              {INDUSTRY_META[c.industry].label}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </section>
              )}
            </div>

            {/* Sidebar */}
            <aside className="lg:sticky lg:top-6 lg:self-start">
              <CareerReadiness career={career} />
            </aside>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
