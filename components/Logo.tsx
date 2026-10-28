// LeaseMatch brand mark from the brand sheet: the split-bracket monogram —
// "L" in navy and "M" in gold inside a square drawn as two brackets —
// with "UAE" in the lower right, as on the original.
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <path d="M19 3 H3 V37 H19" fill="none" stroke="#002147" strokeWidth="2.4" />
      <path d="M21 3 H37 V37 H21" fill="none" stroke="#C5A059" strokeWidth="2.4" />
      <path d="M9.5 9 V25.5 H19" fill="none" stroke="#002147" strokeWidth="3" strokeLinecap="square" />
      <path d="M19 25.5 V11 L24.5 19.5 L30 11 V25.5" fill="none" stroke="#C5A059" strokeWidth="2.6" strokeLinejoin="miter" />
      <text x="22.4" y="33.6" fontSize="5.6" fontWeight="600" fill="#C5A059" fontFamily="ui-sans-serif, system-ui, sans-serif" letterSpacing="0.4">
        UAE
      </text>
    </svg>
  );
}

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <LogoMark size={size} />
      <span className="flex flex-col leading-none">
        <span className="text-[1.1rem] tracking-tight">
          <span className="font-extrabold" style={{ color: "#002147" }}>
            Lease
          </span>
          <span className="font-normal" style={{ color: "#B08A3E" }}>
            Match
          </span>
        </span>
        <span className="mt-1 hidden text-[9px] font-bold uppercase tracking-[0.16em] text-text-muted sm:block">
          AI rental agent
        </span>
      </span>
    </span>
  );
}
