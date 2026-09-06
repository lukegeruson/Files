import Link from "next/link"
import {
  Plus,
  Pencil,
  ArrowUpRight,
  Briefcase,
  Inbox,
  Users,
  Handshake,
  Building2,
} from "lucide-react"
import { countUnreadInquiries } from "@/app/actions/job-inquiry"
import { countUnreadLeads } from "@/app/actions/leads"
import { countUnreadPartnerApplications } from "@/app/actions/partners"
import { getLivePostings } from "@/lib/careers/postings"
import { Button } from "@/components/ui/button"
import { DeletePostButton } from "@/components/delete-post-button"
import { AdminLogoutButton } from "@/components/admin-logout-button"
import {
  CATEGORIES,
  CATEGORY_LABELS,
  POST_TAG_LABELS,
  getPosts,
  type Post,
} from "@/lib/posts"
import { requireAdmin } from "@/lib/admin-auth"

export const metadata = {
  title: "Admin — Evergreen Journal",
  robots: { index: false, follow: false },
}

// Human-friendly label for when a post was last edited. The single most
// recently edited post (isMostRecent) is labeled "Just now"; otherwise
// "Today" or "Yesterday" for the two most recent days, and "Ancient" for
// anything older than that.
function formatEdited(iso: string, isMostRecent: boolean): string {
  if (isMostRecent) return "Just now"

  const then = new Date(iso)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfThen = new Date(then.getFullYear(), then.getMonth(), then.getDate())
  const dayDiff = Math.round(
    (startOfToday.getTime() - startOfThen.getTime()) / 86_400_000,
  )

  if (dayDiff <= 0) return "Today"
  if (dayDiff === 1) return "Yesterday"
  return "Ancient"
}

export default async function AdminPage() {
  await requireAdmin()

  // Independent queries, so run them together rather than in series.
  const [posts, unreadInquiries, livePostings, unreadLeads, unreadPartners] =
    await Promise.all([
      getPosts({ includeUnpublished: true }),
      countUnreadInquiries(),
      getLivePostings(),
      countUnreadLeads(),
      countUnreadPartnerApplications(),
    ])
  const liveOpenings = livePostings.length

  // Id of the single most recently edited post across all categories.
  const mostRecentPostId = posts.reduce<string | number | null>(
    (mostRecent, post) => {
      if (mostRecent === null) return post.id
      const current = posts.find((p) => p.id === mostRecent)!
      return new Date(post.updatedAt).getTime() >
        new Date(current.updatedAt).getTime()
        ? post.id
        : mostRecent
    },
    null,
  )

  // Admin-only ordering: show "agriculture" at the top and "solar" at the
  // bottom. The shared CATEGORIES order is left untouched so the public site
  // is unaffected.
  const adminCategoryOrder = [
    ...CATEGORIES.filter((category) => category === "agriculture"),
    ...CATEGORIES.filter(
      (category) => category !== "agriculture" && category !== "solar",
    ),
    ...CATEGORIES.filter((category) => category === "solar"),
  ]

  const byMostRecentlyEdited = (a: Post, b: Post) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()

  const groupedCategories: {
    key: string
    label: string
    note?: string
    posts: Post[]
  }[] = adminCategoryOrder
    .map((category) => ({
      key: category,
      label: CATEGORY_LABELS[category],
      posts: posts
        .filter((post) => post.category === category)
        .sort(byMostRecentlyEdited),
    }))
    .filter((group) => group.posts.length > 0)

  // Jobs is a tag, not a category, so these posts are listed again here in
  // addition to their own category group above. Reachable on the public site
  // only from the bottom of /jobs.
  const jobsPosts = posts
    .filter((post) => post.tags.includes("jobs"))
    .sort(byMostRecentlyEdited)

  if (jobsPosts.length > 0) {
    groupedCategories.push({
      key: "jobs",
      label: POST_TAG_LABELS.jobs,
      note: "Also listed under their own category. Shown at the bottom of the Jobs page.",
      posts: jobsPosts,
    })
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 md:px-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Back to site
          </Link>
          <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight">
            Content
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {posts.length} {posts.length === 1 ? "post" : "posts"} total
          </p>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <AdminLogoutButton />
          <Link
            href="/admin/openings"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Briefcase className="size-4 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">Openings</span>
            {liveOpenings > 0 ? (
              <span
                className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground"
                aria-label={`${liveOpenings} live`}
              >
                {liveOpenings}
              </span>
            ) : null}
          </Link>
          <Link
            href="/admin/inquiries"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Inbox className="size-4 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">Inbox</span>
            {unreadInquiries > 0 ? (
              <span
                className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground"
                aria-label={`${unreadInquiries} unhandled`}
              >
                {unreadInquiries}
              </span>
            ) : null}
          </Link>
          <Link
            href="/admin/leads"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Users className="size-4 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">Leads</span>
            {unreadLeads > 0 ? (
              <span
                className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground"
                aria-label={`${unreadLeads} to route`}
              >
                {unreadLeads}
              </span>
            ) : null}
          </Link>
          <Link
            href="/admin/partners"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Handshake className="size-4 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">Partners</span>
            {unreadPartners > 0 ? (
              <span
                className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground"
                aria-label={`${unreadPartners} unhandled`}
              >
                {unreadPartners}
              </span>
            ) : null}
          </Link>
          <Link
            href="/admin/companies"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Building2 className="size-4 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">Companies</span>
          </Link>
          <Button
            nativeButton={false}
            render={
              <Link href="/admin/new">
                <Plus className="size-4" />
                New post
              </Link>
            }
          />
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="mt-8 overflow-hidden rounded-xl border border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No posts yet. Create your first one.
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          {groupedCategories.map((group) => (
            <section key={group.key}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-serif text-xl font-semibold tracking-tight">
                  {group.label}
                </h2>
                <span className="shrink-0 text-xs uppercase tracking-wide text-muted-foreground">
                  {group.posts.length} {group.posts.length === 1 ? "post" : "posts"}
                </span>
              </div>
              {group.note ? (
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {group.note}
                </p>
              ) : null}

              <div className="mt-3 overflow-hidden rounded-xl border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Title</th>
                      <th className="hidden px-4 py-3 font-medium sm:table-cell">
                        Status
                      </th>
                      <th className="hidden px-4 py-3 font-medium sm:table-cell">
                        Edited
                      </th>
                      <th className="px-2 py-3 text-right font-medium sm:px-4">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.posts.map((post) => (
                      <tr key={post.id} className="border-b border-border last:border-0">
                        <td className="w-full py-3 pl-4 pr-2 sm:pr-4">
                          <span className="font-medium">{post.title}</span>
                          {post.tags.includes("jobs") && group.key !== "jobs" ? (
                            <span className="ml-2 inline-flex items-center rounded-full border border-border px-2 py-0.5 align-middle text-xs font-medium text-muted-foreground">
                              {POST_TAG_LABELS.jobs}
                            </span>
                          ) : null}
                          <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:hidden">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                post.published
                                  ? "bg-primary/15 text-primary"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {post.published ? "Published" : "Draft"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatEdited(
                                post.updatedAt,
                                post.id === mostRecentPostId,
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              post.published
                                ? "bg-primary/15 text-primary"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {post.published ? "Published" : "Draft"}
                          </span>
                        </td>
                        <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                          {formatEdited(
                            post.updatedAt,
                            post.id === mostRecentPostId,
                          )}
                        </td>
                        <td className="px-2 py-3 sm:px-4">
                          <div className="flex items-center justify-end gap-1.5 sm:gap-2">
                            {post.published && (
                              <Link
                                href={`/blog/${post.slug}`}
                                aria-label={`View ${post.title}`}
                                className="inline-flex size-9 items-center justify-center gap-1.5 rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground sm:size-auto sm:px-2.5 sm:py-1.5 sm:text-sm"
                              >
                                <ArrowUpRight className="size-4 shrink-0" />
                                <span className="hidden sm:inline">View</span>
                              </Link>
                            )}
                            <Link
                              href={`/admin/${post.id}/edit`}
                              aria-label={`Edit ${post.title}`}
                              className="inline-flex size-9 items-center justify-center gap-1.5 rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground sm:size-auto sm:px-2.5 sm:py-1.5 sm:text-sm"
                            >
                              <Pencil className="size-4 shrink-0" />
                              <span className="hidden sm:inline">Edit</span>
                            </Link>
                            <DeletePostButton id={post.id} title={post.title} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
