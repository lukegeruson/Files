import Link from "next/link"
import { CompanyForm } from "@/components/admin/company-form"
import { requireAdmin } from "@/lib/admin-auth"

export const metadata = {
  title: "New company — Evergreen",
  robots: { index: false, follow: false },
}

export default async function NewCompanyPage() {
  await requireAdmin()

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:px-6">
      <Link
        href="/admin/companies"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Back to companies
      </Link>
      <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight">New company</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Add a company profile. ZIP codes drive lead matching; publish when the
        profile is ready to be public.
      </p>

      <CompanyForm />
    </div>
  )
}
