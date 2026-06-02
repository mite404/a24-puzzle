import { getPalette } from "@/data/palettes";
import type { FilmId } from "@/lib/types";

interface PaletteCardProps {
  filmId: FilmId;
  promptText: string;
}

/**
 * Renders a film's color signature inline in the conversation. The film title is
 * intentionally withheld — the oracle is gauging a reaction to the colors alone.
 */
export function PaletteCard({ filmId, promptText }: PaletteCardProps) {
  const palette = getPalette(filmId);
  if (!palette) return null;

  return (
    <div className="my-2 overflow-hidden ring-1 ring-foreground">
      <div className="flex h-28 w-full">
        {palette.swatches.map((swatch) => (
          <div
            key={swatch.hex}
            className="group relative flex-1 transition-[flex-grow] duration-500 ease-out hover:flex-[1.6]"
            style={{ backgroundColor: swatch.hex }}
            title={swatch.name}
          >
            <span className="pointer-events-none absolute bottom-1.5 left-1.5 font-mono text-[9px] uppercase tracking-widest text-white/0 transition-colors duration-300 group-hover:text-white/80">
              {swatch.name}
            </span>
          </div>
        ))}
      </div>
      <p className="bg-muted/50 px-4 py-3 text-sm italic text-muted-foreground">
        {promptText}
      </p>
    </div>
  );
}
