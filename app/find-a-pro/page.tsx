import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { FindAProForm } from "@/components/find-a-pro/find-a-pro-form"
import { pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({
  title: "Find a Professional",
  description:
    "Tell us about your solar, landscaping, renovation, or agriculture project and we'll help connect you with a professional that fits your needs.",
  path: "/find-a-pro",
})

export default function FindAProPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-4 py-12 md:px-6">
          <p className="text-sm font-medium uppercase tracking-widest text-primary">
            Find a Professional
          </p>
          <h1 className="mt-3 text-balance font-serif text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
            Connect with the right professional
          </h1>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
            Answer a few quick questions about your project. We&apos;ll use them
            to find professionals in our network that match what you need.
          </p>

          <div className="mt-8">
            <FindAProForm />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
