/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    // AVIF first, WebP as the fallback. Next picks per-request from the
    // browser's Accept header, so unsupported browsers still get the
    // original PNG rather than a broken image.
    formats: ["image/avif", "image/webp"],

    // Required from Next 16 on: quality values must be allowlisted. 75 is
    // the default and is visually transparent for these photographs.
    qualities: [75],

    // Every source file in public/blog is 1024x1024, and Next never upscales
    // past the source. Widths beyond ~1024 would all resolve to the same
    // 1024px output under different cache keys, so the default ladders
    // (up to 3840) are trimmed to what these sources can actually produce.
    //
    // deviceSizes serves the full-width mobile case; imageSizes serves the
    // constrained slots (720px hero, ~350px card) including their 2x variants.
    deviceSizes: [640, 750, 828, 1080],
    imageSizes: [128, 256, 384, 512],

    // Blog art is replaced by uploading a new filename rather than
    // overwriting, so optimized output can be cached aggressively.
    minimumCacheTTL: 2678400, // 31 days
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Removes a real redirect hop. Reaching the site over http currently
          // costs two hops (http://evergreen.builders -> https://evergreen.builders
          // -> https://www.evergreen.builders). With HSTS remembered, the
          // browser rewrites http:// to https:// internally on later visits,
          // so that first network round trip disappears. The apex -> www hop
          // is domain configuration and stays as-is.
          //
          // No includeSubDomains: it would cover every *.evergreen.builders
          // host, and that has not been verified as HTTPS-only.
          { key: "Strict-Transport-Security", value: "max-age=63072000" },
        ],
      },
    ]
  },
  async redirects() {
    return [
      // The renovation category used to live at /category/home-improvement.
      // A 308 preserves any accumulated search ranking and keeps old links,
      // bookmarks, and inbound backlinks working.
      {
        source: "/category/home-improvement",
        destination: "/category/renovation",
        permanent: true,
      },
    ]
  },
}

export default nextConfig
