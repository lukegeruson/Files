import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Source_Serif_4 } from 'next/font/google'
import './globals.css'
import {
  jsonLdProps,
  organizationSchema,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
} from '@/lib/seo'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-source-serif',
})

export const metadata: Metadata = {
  // Resolves every relative canonical and OG URL in the app to the production
  // hostname. Without it Next emits relative OG URLs, which crawlers and
  // social scrapers cannot follow.
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Explore the Horizon. Make Better Decisions.`,
    // Pages set a bare title (e.g. "Skill trees") and inherit the brand suffix
    // from here, so the suffix is never duplicated or hand-typed per page.
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  // Deliberately no `alternates.canonical` here. A canonical set in the root
  // layout is inherited by every route that does not override it, so a default
  // of '/' silently told Google that any such page was a duplicate of the
  // homepage — /admin and /admin/login were both emitting a homepage canonical,
  // which contradicts their own noindex. The homepage sets its own canonical
  // via pageMetadata({ path: '/' }) in app/page.tsx, so nothing is lost, and
  // pages without an explicit canonical now emit none (a safe default) rather
  // than a wrong one.
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Explore the Horizon. Make Better Decisions.`,
    description: SITE_DESCRIPTION,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — Explore the Horizon. Make Better Decisions.`,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${sourceSerif.variable} bg-background`}
    >
      <body className="antialiased font-sans">
        {/* Site-wide Organization + WebSite graph. Page-specific schema
            (BlogPosting, BreadcrumbList, FAQPage) is added by the individual
            pages and references these nodes by @id. */}
        <script {...jsonLdProps(organizationSchema())} />
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
