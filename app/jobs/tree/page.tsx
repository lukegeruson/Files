import { Suspense } from "react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { SkillTreeExplorer } from "@/components/careers/skill-tree"
import { ExplorerNav } from "@/components/careers/explorer-nav"
import { JobsReading } from "@/components/careers/jobs-reading"
import { pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({
  title: "Skill trees for four trade industries",
  description:
    "Four interactive skill trees for solar, landscaping, renovation, and agriculture. Start at the seed with no experience and branch upward through entry level, apprentice, and master.",
  path: "/jobs/tree",
})

export default function CareerTreePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <ExplorerNav />
      <main className="flex-1">
        {/* Reads ?industry= via useSearchParams, which needs a boundary. */}
        <Suspense
          fallback={
            <div className="mx-auto max-w-6xl px-4 py-12 md:px-6">
              <div className="h-10 w-72 animate-pulse rounded-md bg-secondary" />
              <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-xl bg-secondary" />
                ))}
              </div>
            </div>
          }
        >
          <SkillTreeExplorer />
        </Suspense>
        <JobsReading />
      </main>
      <SiteFooter />
    </div>
  )
}
