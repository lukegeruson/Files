import { ImageResponse } from "next/og"
import { SITE_NAME, SITE_TAGLINE } from "@/lib/seo"

export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`

/**
 * Site-wide social card, inherited by every route that does not define its own.
 *
 * Generated at request time rather than shipped as a static asset so the
 * wordmark and tagline always match the brand constants. Satori (the renderer
 * behind ImageResponse) does not understand oklch, so the brand colors are
 * written here as their hex equivalents.
 */
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#fdfcf9",
          padding: "80px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "8px",
              backgroundColor: "#e08a45",
            }}
          />
          <div
            style={{
              fontSize: "30px",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#7a756c",
            }}
          >
            {SITE_NAME}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: "82px",
              lineHeight: 1.05,
              color: "#26231e",
              maxWidth: "900px",
            }}
          >
            Explore the Horizon.
          </div>
          <div
            style={{
              fontSize: "82px",
              lineHeight: 1.05,
              color: "#e08a45",
              maxWidth: "900px",
            }}
          >
            Make Better Decisions.
          </div>
        </div>

        <div style={{ display: "flex", fontSize: "30px", color: "#7a756c" }}>
          Solar · Landscaping · Renovation · Agriculture
        </div>
      </div>
    ),
    size,
  )
}
