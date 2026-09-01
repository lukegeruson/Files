type AcornLogoProps = {
  className?: string
}

export function AcornLogo({ className }: AcornLogoProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role="img"
      aria-label="Evergreen logo"
    >
      {/* Acorn cap */}
      <path d="M5 8.5c0-1 1.2-2 3-2.4C11 5.4 13 5.4 16 6.1c1.8.4 3 1.4 3 2.4 0 .6-.5 1-1.2 1H6.2C5.5 9.5 5 9.1 5 8.5Z" />
      {/* Cap stem */}
      <path d="M12 5.6V4" />
      {/* Nut body */}
      <path d="M6.4 9.5c.3 4 2.3 9.5 5.6 9.5s5.3-5.5 5.6-9.5" />
    </svg>
  )
}
