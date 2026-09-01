import { Suspense } from "react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { QuizFlow } from "@/components/careers/quiz-flow"
import { ExplorerNav } from "@/components/careers/explorer-nav"
import { JobsReading } from "@/components/careers/jobs-reading"
import { pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({
  title: "Trade career quiz",
  description:
    "A few quick questions about your interests, work environment, training timeline, and current skills — then see every trade role ranked against your answers.",
  path: "/jobs/quiz",
})

export default function CareerQuizPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <ExplorerNav />
      <main className="flex-1">
        {/* Server-rendered so the page always has an H1 in its initial HTML.
            The views below are client-only (the saved profile lives in
            localStorage), so without this a crawler would see no heading. */}
        <section className="mx-auto max-w-3xl px-4 pt-12 md:px-6">
          <p className="text-sm font-medium uppercase tracking-widest text-primary">Careers</p>
          <h1 className="mt-3 text-balance font-serif text-3xl font-semibold tracking-tight md:text-4xl">
            Find the trade career that fits you
          </h1>
        </section>

        {/* Reads ?view= via useSearchParams, which needs a boundary. */}
        <Suspense
          fallback={
            <div className="mx-auto max-w-3xl px-4 py-12 md:px-6">
              <div className="h-1.5 w-full animate-pulse rounded-full bg-secondary" />
              <div className="mt-8 h-9 w-3/4 animate-pulse rounded-md bg-secondary" />
            </div>
          }
        >
          <QuizFlow />
        </Suspense>
        <JobsReading />
      </main>
      <SiteFooter />
    </div>
  )
}
