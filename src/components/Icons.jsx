const ICONS = {
  menu: (
    <>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </>
  ),
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2v-17Z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
  book: (
    <>
      <path d="M4 4.5h6.5A3.5 3.5 0 0 1 14 8v11.5a2.5 2.5 0 0 0-2.5-2.5H4v-12.5Z" />
      <path d="M20 4.5h-2.5A3.5 3.5 0 0 0 14 8v11.5a2.5 2.5 0 0 1 2.5-2.5H20v-12.5Z" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="5.5" rx="7.5" ry="3" />
      <path d="M4.5 5.5v6c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-6" />
      <path d="M4.5 11.5v6c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-6" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11a8 8 0 0 0-14.9-4M4 5v5h5" />
      <path d="M4 13a8 8 0 0 0 14.9 4M20 19v-5h-5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronLeft: <path d="m15 6-6 6 6 6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  arrowUpRight: (
    <>
      <path d="M7 17 17 7M8 7h9v9" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M4 12h16M14 6l6 6-6 6" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.2l3.2 2" />
    </>
  ),
  wallet: (
    <>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 17.5v-10Z" />
      <path d="M4 8h16M15.5 13h2.5" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  warning: (
    <>
      <path d="M10.3 4.6 2.8 17.4A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.7-2.6L13.7 4.6a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4.5M12 17.2v.1" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 8v.1" />
    </>
  ),
  building: (
    <>
      <path d="M4 21V5l8-2v18M12 7h8v14M2 21h20" />
      <path d="M7.5 8v2M7.5 13v2M16 11v2M16 16v2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2.5" />
      <path d="M16 8V5.5A2.5 2.5 0 0 0 13.5 3h-8A2.5 2.5 0 0 0 3 5.5v8A2.5 2.5 0 0 0 5.5 16H8" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6M20 4l-8 8" />
      <path d="M19 14v4.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 3 18.5v-11A2.5 2.5 0 0 1 5.5 5H10" />
    </>
  ),
  bed: (
    <>
      <path d="M3 19v-9M3 13h18v6M21 19v-8a2 2 0 0 0-2-2h-7v4" />
      <path d="M6.5 9.5h4v3.5h-4z" />
    </>
  ),
  plane: (
    <>
      <path d="M3 13.5 21 4l-4.5 8.5L21 21l-8-5-4 3v-4.5l-6-1Z" />
    </>
  ),
  train: (
    <>
      <rect x="5" y="3.5" width="14" height="14" rx="4" />
      <path d="M8 21l2-3.5M16 21l-2-3.5M8 8h8M5 11h14" />
      <circle cx="8.5" cy="14" r=".6" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="14" r=".6" fill="currentColor" stroke="none" />
    </>
  ),
  car: (
    <>
      <path d="M5 17h14M4 17v-4l2-6h12l2 6v4" />
      <path d="M6 13h12M7 17v2M17 17v2" />
      <circle cx="7" cy="14.5" r="1" />
      <circle cx="17" cy="14.5" r="1" />
    </>
  ),
  meal: (
    <>
      <path d="M6 3v7a2 2 0 0 0 4 0V3M8 10v11M17 3c-2 2.5-2.5 5-2.5 7.5a2.5 2.5 0 0 0 5 0V3h-2.5ZM17 13v8" />
    </>
  ),
  box: (
    <>
      <path d="m12 3 8.5 4.5v9L12 21l-8.5-4.5v-9L12 3Z" />
      <path d="m3.5 7.5 8.5 4.5 8.5-4.5M12 12v9" />
    </>
  ),
  filter: (
    <>
      <path d="M4 6h16M7 12h10M10 18h4" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3c.6 5.4 3.6 8.4 9 9-5.4.6-8.4 3.6-9 9-.6-5.4-3.6-8.4-9-9 5.4-.6 8.4-3.6 9-9Z" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 4.5 6v5.5c0 4.5 3.2 8 7.5 9.5 4.3-1.5 7.5-5 7.5-9.5V6L12 3Z" />
      <path d="m8.8 12 2.2 2.2 4.4-4.5" />
    </>
  ),
  file: (
    <>
      <path d="M6 3.5h7l5 5V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
      <path d="M13 3.5V9h5M9 13h6M9 17h4" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
    </>
  ),
  coins: (
    <>
      <ellipse cx="9" cy="6" rx="6" ry="3" />
      <path d="M3 6v5c0 1.7 2.7 3 6 3 1 0 1.9-.1 2.7-.3M15 9.5c3.3 0 6 1.2 6 2.9v5.1c0 1.7-2.7 3-6 3s-6-1.3-6-3v-5c0-1.4 1.9-2.5 4.6-2.9" />
    </>
  ),
  sparkbars: (
    <>
      <path d="M4 20V13M9 20V8M14 20v-4M19 20V4" />
    </>
  ),
  dot: <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  filterList: (
    <>
      <path d="M9 6h12M9 12h8M9 18h4M3 6h.01M3 12h.01M3 18h.01" />
    </>
  ),
}

export function Icon({ name, size = 18, strokeWidth = 1.8, className = '', ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon ${className}`.trim()}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {ICONS[name] || ICONS.dot}
    </svg>
  )
}

export function BrandMark({ size = 40 }) {
  return (
    <span className="brand-mark" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 44 44" width="100%" height="100%" fill="none">
        <path d="M8 33 19 11h6l11 22h-7l-2.2-5H17.2L15 33H8Z" fill="currentColor" />
        <path d="M19.7 22.8h4.6L22 17.3l-2.3 5.5Z" fill="#0D2620" />
      </svg>
    </span>
  )
}
