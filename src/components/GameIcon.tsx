import { useEffect, useMemo, useState } from "react";
import type { Game } from "../games";
import { getGameIconCandidates } from "../games";
import { PartnerGameGlyph } from "./PartnerGameGlyph";

export function GameIcon({
  game,
  className,
  alt = "",
}: {
  game: Game;
  className?: string;
  alt?: string;
}) {
  if (game.thirdParty) {
    return <PartnerGameGlyph className={className} />;
  }

  const candidates = useMemo(() => getGameIconCandidates(game), [game]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [game.id, game.url]);

  const src = candidates[index];

  if (!src || index >= candidates.length) {
    return (
      <div
        className={className}
        style={{
          background: "linear-gradient(145deg, #1e293b, #0f172a)",
          border: "2px solid #334155",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        aria-hidden
      >
        <span className="text-3xl font-black text-sky-400/90">
          {game.name.slice(0, 1).toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      className={className}
      alt={alt}
      decoding="async"
      onError={() => setIndex((i) => i + 1)}
      style={
        game.thirdParty
          ? {
              filter: "drop-shadow(0 0 12px rgba(56,189,248,0.25))",
            }
          : undefined
      }
    />
  );
}
