import Link from "next/link"
import { notFound } from "next/navigation"
import { ExternalLink, Mail, MapPin, Phone } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { getPublishedCompanyBySlug } from "@/lib/companies/companies"
import { CATEGORY_LABELS, isCategory } from "@/lib/categories"
import { absoluteUrl, jsonLdProps, pageMetadata } from "@/lib/seo"

type Params = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Params) {
  const { slug } = await params
  const company = await getPublishedCompanyBySlug(slug)
  if (!company) {
    // Missing/unpublished: keep it out of the index rather than emitting a
    // canonical for a page that 404s.
    return { title: "Company not found", robots: { index: false, follow: false } }
  }

  const industry = isCategory(company.industry)
    ? CATEGORY_LABELS[company.industry]
    : company.industry
  return pageMetadata({
    title: `${company.name} | Evergreen`,
    description:
      company.description ||
      `${company.name} — a ${industry.toLowerCase()} company in the Evergreen network.`,
    path: `/companies/${company.slug}`,
  })
}

export default async function CompanyProfilePage({ params }: Params) {
  const { slug } = await params
  const company = await getPublishedCompanyBySlug(slug)
  if (!company) notFound()

  const industry = isCategory(company.industry)
    ? CATEGORY_LABELS[company.industry]
    : company.industry

  // Organization, not LocalBusiness: no precise street address is published, so
  // areaServed carries what is actually known and nothing is invented.
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: company.name,
    url: absoluteUrl(`/companies/${company.slug}`),
    ...(company.website ? { sameAs: [company.website] } : {}),
    ...(company.description ? { description: company.description } : {}),
    ...(company.contactEmail ? { email: company.contactEmail } : {}),
    ...(company.contactPhone ? { telephone: company.contactPhone } : {}),
    ...(company.serviceAreas.length > 0 ? { areaServed: company.serviceAreas } : {}),
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-12 md:px-6">
          <Link
            href="/companies"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← All companies
          </Link>

          <span className="mt-6 block text-xs font-medium uppercase tracking-wide text-primary">
            {industry}
          </span>
          <h1 className="mt-2 text-balance font-serif text-4xl font-semibold leading-tight tracking-tight">
            {company.name}
          </h1>

          {company.description ? (
            <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
              {company.description}
            </p>
          ) : null}

          {company.services.length > 0 ? (
            <section className="mt-8">
              <h2 className="font-serif text-lg font-semibold tracking-tight">Services</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {company.services.map((service) => (
                  <li
                    key={service}
                    className="rounded-full border border-border bg-secondary/40 px-3 py-1 text-sm text-muted-foreground"
                  >
                    {service}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {company.serviceAreas.length > 0 || company.locations.length > 0 ? (
            <section className="mt-8">
              <h2 className="font-serif text-lg font-semibold tracking-tight">
                Locations &amp; service areas
              </h2>
              <div className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
                {[...company.locations, ...company.serviceAreas].map((place, i) => (
                  <span key={`${place}-${i}`} className="inline-flex items-center gap-2">
                    <MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
                    {place}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {company.hiring ? (
            <p className="mt-8 inline-flex items-center rounded-full bg-primary/15 px-3 py-1 text-sm font-medium text-primary">
              Currently hiring
            </p>
          ) : null}

          {(company.website || company.contactEmail || company.contactPhone) ? (
            <section className="mt-8 rounded-xl border border-border bg-card p-5">
              <h2 className="font-serif text-lg font-semibold tracking-tight">Contact</h2>
              <div className="mt-3 flex flex-col gap-2 text-sm">
                {company.website ? (
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex items-center gap-2 font-medium text-primary"
                  >
                    <ExternalLink className="size-4 shrink-0" aria-hidden="true" />
                    Visit website
                  </a>
                ) : null}
                {company.contactEmail ? (
                  <a
                    href={`mailto:${company.contactEmail}`}
                    className="inline-flex items-center gap-2 font-medium text-primary"
                  >
                    <Mail className="size-4 shrink-0" aria-hidden="true" />
                    {company.contactEmail}
                  </a>
                ) : null}
                {company.contactPhone ? (
                  <a
                    href={`tel:${company.contactPhone.replace(/[^\d+]/g, "")}`}
                    className="inline-flex items-center gap-2 font-medium text-primary"
                  >
                    <Phone className="size-4 shrink-0" aria-hidden="true" />
                    {company.contactPhone}
                  </a>
                ) : null}
              </div>
            </section>
          ) : null}

          <div className="mt-10 rounded-xl border border-border bg-secondary/40 p-5">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Looking for help with a project?{" "}
              <Link href="/find-a-pro" className="font-medium text-primary">
                Find a Professional
              </Link>{" "}
              and we&apos;ll match you with companies like this one.
            </p>
          </div>
        </article>
      </main>
      <SiteFooter />
      <script {...jsonLdProps(schema)} />
    </div>
  )
}
