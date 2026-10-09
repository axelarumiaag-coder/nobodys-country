export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="logo-mark">
      <path d="M8 33V16.5L20 7l12 9.5V33" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      <circle cx="20" cy="23.5" r="5.2" fill="none" stroke="var(--olive)" strokeWidth="2.2" />
      <path d="M14.8 23.5h10.4" stroke="var(--olive)" strokeWidth="1.2" />
    </svg>
  );
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className={`logo${light ? ' logo--light' : ''}`}>
      <LogoMark />
      <span className="logo-word">
        <span className="logo-main">HABITAT</span>
        <span className="logo-sub">IMMERSIVE</span>
      </span>
    </span>
  );
}
