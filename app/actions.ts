"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import {
  createPost,
  deletePost,
  isCategory,
  isPostTag,
  updatePost,
  type PostInput,
} from "@/lib/posts"
import { requireAdmin } from "@/lib/admin-auth"

export type FormState = { error?: string }

function parseForm(formData: FormData): PostInput | { error: string } {
  const title = String(formData.get("title") ?? "").trim()
  const category = String(formData.get("category") ?? "")
  const excerpt = String(formData.get("excerpt") ?? "").trim()
  const content = String(formData.get("content") ?? "").trim()
  const coverImage = String(formData.get("coverImage") ?? "").trim()
  const published = formData.get("published") === "on"
  // Checkbox group: unchecked boxes submit nothing, so an empty list is the
  // valid "no collections" state. Filtered against the allowlist so a crafted
  // payload can't write an arbitrary tag.
  const tags = formData.getAll("tags").map(String).filter(isPostTag)

  if (!title) return { error: "Title is required." }
  if (!isCategory(category)) return { error: "Please choose a valid category." }
  if (!content) return { error: "Content is required." }

  return {
    title,
    category,
    tags,
    excerpt: excerpt || content.slice(0, 160),
    content,
    coverImage: coverImage || undefined,
    published,
  }
}

export async function createPostAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin()

  const parsed = parseForm(formData)
  if ("error" in parsed) return { error: parsed.error }
  await createPost(parsed)
  revalidatePath("/admin")
  revalidatePath("/blog")
  // The Jobs collection at the bottom of /jobs is built from tagged posts.
  revalidatePath("/jobs")
  redirect("/admin")
}

export async function updatePostAction(
  id: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin()

  const parsed = parseForm(formData)
  if ("error" in parsed) return { error: parsed.error }
  await updatePost(id, parsed)
  revalidatePath("/admin")
  revalidatePath("/blog")
  // The Jobs collection at the bottom of /jobs is built from tagged posts.
  revalidatePath("/jobs")
  redirect("/admin")
}

export async function deletePostAction(id: string) {
  await requireAdmin()

  await deletePost(id)
  revalidatePath("/admin")
  revalidatePath("/blog")
  // The Jobs collection at the bottom of /jobs is built from tagged posts.
  revalidatePath("/jobs")
}
