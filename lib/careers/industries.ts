import type { Industry } from "./types"

export const INDUSTRIES: Industry[] = ["solar", "landscaping", "renovation", "agriculture"]

export type IndustryMeta = {
  id: Industry
  label: string
  /** One-line promise shown on the explorer cards. */
  blurb: string
  /**
   * Tailwind class fragments for the industry accent. The palette reuses the
   * existing --chart-1..4 tokens so the four industries stay in-palette.
   *
   * These tokens collapse to greyscale in dark mode, so colour is never the
   * only signal: every surface that uses them also carries the industry label.
   */
  accent: {
    text: string
    border: string
    bg: string
    dot: string
  }
  families: string[]
}

export const INDUSTRY_META: Record<Industry, IndustryMeta> = {
  solar: {
    id: "solar",
    label: "Solar & Energy",
    blurb: "Install, wire, and maintain the systems that turn sunlight into power.",
    accent: {
      text: "text-[var(--chart-1)]",
      border: "border-[var(--chart-1)]",
      bg: "bg-[var(--chart-1)]/10",
      dot: "bg-[var(--chart-1)]",
    },
    families: [
      "Installation",
      "Electrical",
      "Sales & Consultation",
      "Design & Engineering",
      "Maintenance & Service",
      "Energy Storage",
      "Project Management",
      "Inspection & Compliance",
    ],
  },
  landscaping: {
    id: "landscaping",
    label: "Landscaping & Outdoor",
    blurb: "Shape outdoor spaces, from mowing crews to design-build ownership.",
    accent: {
      text: "text-[var(--chart-2)]",
      border: "border-[var(--chart-2)]",
      bg: "bg-[var(--chart-2)]/10",
      dot: "bg-[var(--chart-2)]",
    },
    families: [
      "Grounds & Maintenance",
      "Hardscaping",
      "Irrigation",
      "Horticulture",
      "Tree Care",
      "Landscape Design",
      "Equipment Operation",
      "Business & Estimating",
    ],
  },
  renovation: {
    id: "renovation",
    label: "Renovation & Building",
    blurb: "Build, remodel, and upgrade the places people live and work.",
    accent: {
      text: "text-[var(--chart-4)]",
      border: "border-[var(--chart-4)]",
      bg: "bg-[var(--chart-4)]/10",
      dot: "bg-[var(--chart-4)]",
    },
    families: [
      "General Construction",
      "Carpentry",
      "Electrical",
      "Plumbing",
      "HVAC",
      "Finishing Trades",
      "Estimating & Management",
      "Specialty Restoration",
    ],
  },
  agriculture: {
    id: "agriculture",
    label: "Agriculture & Growing",
    blurb: "Grow food and manage land, with tech playing a bigger role every year.",
    accent: {
      text: "text-[var(--chart-3)]",
      border: "border-[var(--chart-3)]",
      bg: "bg-[var(--chart-3)]/10",
      dot: "bg-[var(--chart-3)]",
    },
    families: [
      "Field & Crop Work",
      "Irrigation",
      "Equipment & Mechanics",
      "Livestock",
      "Agronomy & Soil",
      "Controlled Environment",
      "Agricultural Technology",
      "Farm Business",
    ],
  },
}

export function industryLabel(industry: Industry): string {
  return INDUSTRY_META[industry].label
}
