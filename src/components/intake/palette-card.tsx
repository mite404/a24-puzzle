import { getPalette } from "@/data/palettes";
import type { FilmId } from "@/lib/types";

interface PaletteCardProps {
  filmId: FilmId;
  promptText: string;
}

type PaletteCardInternalProps = PaletteCardProps & {
  /** Compact color bars for the CRT viewport. */
  variant: "default" | "crt";
}

/**
 * Renders a film's color signature inline in the conversation. The film title is
 * intentionally withheld — the oracle is gauging a reaction to the colors alone.
 */
function PaletteCardBase({ filmId, promptText, variant }: PaletteCardInternalProps) {
  const palette = getPalette(filmId);
  if (!palette) return null;

  if (variant === "crt") {
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

export function CrtPaletteCard(props: PaletteCardProps) {
  return <PaletteCardBase variant="crt" {...props} />;
}
