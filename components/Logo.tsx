export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2 select-none">
      <span
        className="inline-flex items-center justify-center rounded-md font-display font-semibold"
        style={{
          width: size,
          height: size,
          background: "linear-gradient(135deg, var(--accent), #17395f)",
          color: "var(--gold-soft)",
          fontSize: size * 0.5,
        }}
      >
        LM
      </span>
      <span className="font-display text-lg tracking-tight">
        <span style={{ color: "var(--accent)" }}>Lease</span>
        <span style={{ color: "var(--gold)" }}>Match</span>
      </span>
    </span>
  );
}
