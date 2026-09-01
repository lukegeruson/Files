import Link from "next/link"
import { notFound } from "next/navigation"
import { updatePostAction } from "@/app/actions"
import { PostForm } from "@/components/post-form"
import { getPostById } from "@/lib/posts"
import { requireAdmin } from "@/lib/admin-auth"

export const metadata = {
  title: "Edit Post — Evergreen Journal",
  robots: { index: false, follow: false },
}

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()

  const { id } = await params
  const post = await getPostById(id)
  if (!post) notFound()

  const action = updatePostAction.bind(null, post.id)

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:px-6">
      <Link
        href="/admin"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Back to content
      </Link>
      <h1 className="mt-2 mb-8 font-serif text-3xl font-semibold tracking-tight">
        Edit post
      </h1>
      <PostForm action={action} post={post} submitLabel="Save changes" />
    </div>
  )
}
