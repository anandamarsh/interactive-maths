/**
 * Generic art for third-party / partner games — white linework on dark tile.
 */
const W = "#f8fafc";
const W_DIM = "rgba(248, 250, 252, 0.55)";

export function PartnerGameGlyph({ className }: { className?: string }) {
  return (
    <div
      className={className}
      style={{
        borderRadius: "1rem",
        background: "linear-gradient(160deg, #1e293b 0%, #0f172a 50%, #020617 100%)",
        border: "2px solid rgba(255, 255, 255, 0.12)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      aria-hidden
    >
      <svg
        viewBox="0 0 64 64"
        className="w-[72%] h-[72%] max-w-full max-h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="32" cy="38" r="17" stroke={W_DIM} strokeWidth="1.25" strokeDasharray="2.5 3.5" />
        <path d="M 32 38 L 54 38" stroke={W} strokeWidth="2" strokeLinecap="round" />
        <path d="M 32 38 L 20 22" stroke={W} strokeWidth="2.25" strokeLinecap="round" />
        <path d="M 32 38 L 16 48" stroke={W_DIM} strokeWidth="2" strokeLinecap="round" />
        <circle cx="32" cy="38" r="3.25" fill={W} />
        <path d="M 44 24 Q 52 30 50 38" stroke={W} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity={0.9} />
      </svg>
    </div>
  );
}
