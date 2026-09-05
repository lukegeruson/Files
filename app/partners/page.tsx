import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { PartnerForm } from "@/components/partners/partner-form"
import { pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({
  title: "Partner With Evergreen",
  description:
    "Connect your company with Evergreen through customer leads, company listings, hiring, expert contributions, referrals, research, sponsorships, and other partnerships.",
  path: "/partners",
})

export default function PartnersPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-4 py-12 md:px-6">
          <p className="text-sm font-medium uppercase tracking-widest text-primary">
            For Businesses
          </p>
          <h1 className="mt-3 text-balance font-serif text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
            Partner With Evergreen
          </h1>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
            Connect your company with Evergreen through customer leads, company
            listings, hiring, expert contributions, referrals, research,
            sponsorships, and other partnerships.
          </p>

          <div className="mt-8">
            <PartnerForm />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
