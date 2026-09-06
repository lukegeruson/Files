import Link from "next/link"
import { ArrowRight, Building2 } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { getPublishedCompanies } from "@/lib/companies/companies"
import { CATEGORY_LABELS, isCategory } from "@/lib/categories"
import { pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({
  title: "Company Directory",
  description:
    "Browse companies partnering with Evergreen across solar, landscaping, renovation, and agriculture.",
  path: "/companies",
})

export default async function CompaniesPage() {
  const companies = await getPublishedCompanies()

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 py-12 md:px-6">
          <p className="text-sm font-medium uppercase tracking-widest text-primary">
            Directory
          </p>
          <h1 className="mt-3 font-serif text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
            Companies in the Evergreen network
          </h1>
          <p className="mt-4 max-w-3xl text-pretty text-lg leading-relaxed text-muted-foreground">
            Businesses partnering with Evergreen across solar, landscaping,
            renovation, and agriculture.
          </p>

          {companies.length === 0 ? (
            <div className="mt-10 rounded-xl border border-border px-4 py-16 text-center">
              <Building2 className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
              <p className="mt-3 text-sm text-muted-foreground">
                No companies are listed yet. Companies join through{" "}
                <Link href="/partners" className="font-medium text-primary">
                  Partner with Evergreen
                </Link>
                .
              </p>
            </div>
          ) : (
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {companies.map((company) => (
                <Link
                  key={company.id}
                  href={`/companies/${company.slug}`}
                  className="group flex flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary"
                >
                  <span className="text-xs font-medium uppercase tracking-wide text-primary">
                    {isCategory(company.industry)
                      ? CATEGORY_LABELS[company.industry]
                      : company.industry}
                  </span>
                  <h2 className="mt-2 font-serif text-lg font-semibold">{company.name}</h2>
                  {company.description ? (
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                      {company.description}
                    </p>
                  ) : null}
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                    View profile
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
