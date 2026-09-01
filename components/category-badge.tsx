import Link from "next/link"
import { CATEGORY_LABELS, type Category } from "@/lib/categories"

export function CategoryBadge({
  category,
  asLink = true,
}: {
  category: Category
  asLink?: boolean
}) {
  const label = CATEGORY_LABELS[category]
  const className =
    "inline-flex items-center rounded-full bg-accent px-3 py-1 text-xs font-medium uppercase tracking-wide text-accent-foreground"

  if (!asLink) {
    return <span className={className}>{label}</span>
  }

  return (
    <Link href={`/category/${category}`} className={`${className} transition-colors hover:bg-primary hover:text-primary-foreground`}>
      {label}
    </Link>
  )
}
