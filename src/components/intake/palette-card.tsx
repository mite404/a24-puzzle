import { getPalette } from "@/data/palettes";
import type { FilmId } from "@/lib/types";

interface PaletteCardProps {
  filmId: FilmId;
  promptText: string;
}

/**
 * Renders a film's color signature inline in the CRT viewport. The film title is
 * intentionally withheld — the oracle is gauging a reaction to the colors alone.
 */
export function CrtPaletteCard({ filmId, promptText }: PaletteCardProps) {
  const palette = getPalette(filmId);
  if (!palette) return null;

  return (
    <div className="oracle-tv-palette">
      <div className="oracle-tv-palette__bars">
        {palette.swatches.map((swatch, index) => (
          <div
            key={swatch.hex}
            className="oracle-tv-palette__bar"
            style={{
              backgroundColor: swatch.hex,
              zIndex: index + 1,
            }}
            title={swatch.name}
          >
            <span className="oracle-tv-palette__label">{swatch.name}</span>
          </div>
        ))}
      </div>
      <p className="oracle-tv-palette__prompt">{promptText}</p>
    </div>
  );
}
