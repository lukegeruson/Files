import Link from "next/link"
import { createPostAction } from "@/app/actions"
import { PostForm } from "@/components/post-form"
import { requireAdmin } from "@/lib/admin-auth"

export const metadata = {
  title: "New Post — Evergreen Journal",
  robots: { index: false, follow: false },
}

export default async function NewPostPage() {
  await requireAdmin()

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:px-6">
      <Link
        href="/admin"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Back to content
      </Link>
      <h1 className="mt-2 mb-8 font-serif text-3xl font-semibold tracking-tight">
        New post
      </h1>
      <PostForm action={createPostAction} submitLabel="Publish post" />
    </div>
  )
}
