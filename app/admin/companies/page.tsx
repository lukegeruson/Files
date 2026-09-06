import Link from "next/link"
import { ArrowUpRight, Building2, Plus } from "lucide-react"
import {
  CompanyDeleteButton,
  CompanyPublishToggle,
} from "@/components/admin/company-actions"
import { getAllCompanies } from "@/lib/companies/companies"
import { CATEGORY_LABELS, isCategory } from "@/lib/categories"
import { requireAdmin } from "@/lib/admin-auth"

export const metadata = {
  title: "Companies — Evergreen",
  robots: { index: false, follow: false },
}

export default async function AdminCompaniesPage() {
  await requireAdmin()

  const companies = await getAllCompanies()

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 md:px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/admin"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Back to admin
          </Link>
          <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight">Companies</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {companies.length === 0
              ? "No companies yet"
              : `${companies.length} ${companies.length === 1 ? "company" : "companies"}`}
          </p>
        </div>
        <Link
          href="/admin/companies/new"
          className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="size-4" aria-hidden="true" />
          New company
        </Link>
      </div>

      <p className="mt-6 rounded-xl border border-border bg-secondary/40 p-4 text-sm leading-relaxed text-muted-foreground">
        Company profiles support both flows: published lead-partners are matched
        to Find a Professional leads, and every published profile appears in the
        public directory.
      </p>

      {companies.length === 0 ? (
        <div className="mt-8 rounded-xl border border-border px-4 py-12 text-center">
          <Building2 className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm text-muted-foreground">
            Add your first company, or approve one from a partner application.
          </p>
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-4">
          {companies.map((company) => {
            const industry = isCategory(company.industry)
              ? CATEGORY_LABELS[company.industry]
              : company.industry
            return (
              <li key={company.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-serif text-lg font-semibold tracking-tight">
                        {company.name}
                      </h2>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          company.published
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {company.published ? "Published" : "Draft"}
                      </span>
                      {company.leadPartner ? (
                        <span className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                          Lead partner
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {industry}
                      {company.zips.length > 0 ? ` · ${company.zips.length} ZIPs` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {company.published ? (
                      <Link
                        href={`/companies/${company.slug}`}
                        aria-label={`View ${company.name}`}
                        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
                        <span className="hidden sm:inline">View</span>
                      </Link>
                    ) : null}
                    <CompanyPublishToggle
                      id={company.id}
                      published={company.published}
                      name={company.name}
                    />
                    <CompanyDeleteButton id={company.id} name={company.name} />
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
