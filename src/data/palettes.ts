import type { FilmId, Palette } from "@/lib/types";

/**
 * Mock palettes. Hex values are hand-picked stand-ins; production would extract
 * them from each `stillImageUrl` with node-vibrant. Stills for uncut-gems and
 * the-backrooms point at real assets; others use a representative path.
 */
export const palettes: Palette[] = [
  {
    filmId: "uncut-gems",
    stillImageUrl: "/a24-assets/uncut-gems-01.jpg",
    swatches: [
      { hex: "#1B1A2E", name: "Midnight Opal" },
      { hex: "#E8B84B", name: "Furst Gold" },
      { hex: "#6B2D5C", name: "Velvet Plum" },
      { hex: "#2BB6A3", name: "Showroom Teal" },
      { hex: "#E04B3A", name: "Pawn Red" },
    ],
  },
  {
    filmId: "good-time",
    stillImageUrl: "/a24-assets/good-time-01.jpg",
    swatches: [
      { hex: "#E5195E", name: "Sodium Rose" },
      { hex: "#3D1E6D", name: "Bail Bond Violet" },
      { hex: "#1FB6C9", name: "Cyan Getaway" },
      { hex: "#F4A300", name: "Streetlight Amber" },
    ],
  },
  {
    filmId: "the-backrooms",
    stillImageUrl: "/a24-assets/A24_BACKROOMS_01.jpg",
    swatches: [
      { hex: "#C9B458", name: "Liminal Mustard" },
      { hex: "#8A8478", name: "Damp Carpet" },
      { hex: "#2E2A22", name: "Fluorescent Shadow" },
      { hex: "#D8CFA8", name: "Drywall Cream" },
    ],
  },
  {
    filmId: "moonlight",
    stillImageUrl: "/a24-assets/moonlight-01.jpg",
    swatches: [
      { hex: "#0E2A47", name: "Miami Night" },
      { hex: "#7B2D8E", name: "Magenta Dusk" },
      { hex: "#2BB6A3", name: "Ocean Teal" },
      { hex: "#C56B8A", name: "Bruised Rose" },
    ],
  },
  {
    filmId: "hereditary",
    stillImageUrl: "/a24-assets/hereditary-01.jpg",
    swatches: [
      { hex: "#3A2E1F", name: "Ochre Dread" },
      { hex: "#15110C", name: "Attic Shadow" },
      { hex: "#8B6B3A", name: "Miniature Amber" },
      { hex: "#5E1414", name: "Severance Red" },
    ],
  },
  {
    filmId: "midsommar",
    stillImageUrl: "/a24-assets/midsommar-01.jpg",
    swatches: [
      { hex: "#EDE3C8", name: "Acid Daylight" },
      { hex: "#F2C94C", name: "Maypole Yellow" },
      { hex: "#E07A5F", name: "Bloom Flush" },
      { hex: "#9CB071", name: "Hårga Green" },
    ],
  },
  {
    filmId: "the-witch",
    stillImageUrl: "/a24-assets/the-witch-01.jpg",
    swatches: [
      { hex: "#2B2B28", name: "Puritan Slate" },
      { hex: "#6E5C45", name: "Furrowed Earth" },
      { hex: "#9A9388", name: "Goat Pewter" },
      { hex: "#3C140E", name: "Black Phillip Red" },
    ],
  },
  {
    filmId: "lady-bird",
    stillImageUrl: "/a24-assets/lady-bird-01.jpg",
    swatches: [
      { hex: "#E26D8B", name: "Sacramento Pink" },
      { hex: "#7FB2D9", name: "Senior Year Sky" },
      { hex: "#C0432F", name: "Communion Red" },
      { hex: "#E8C36B", name: "Golden State" },
    ],
  },
  {
    filmId: "ex-machina",
    stillImageUrl: "/a24-assets/ex-machina-01.jpg",
    swatches: [
      { hex: "#0F1B1A", name: "Bunker Black" },
      { hex: "#C2362F", name: "Ava Red" },
      { hex: "#3E6E6B", name: "Glass Teal" },
      { hex: "#D9D2C5", name: "Sterile Bone" },
    ],
  },
  {
    filmId: "everything-everywhere",
    stillImageUrl: "/a24-assets/everything-everywhere-01.jpg",
    swatches: [
      { hex: "#F25CA2", name: "Verse Fuchsia" },
      { hex: "#3DB6C9", name: "Googly Cyan" },
      { hex: "#F4B63E", name: "Bagel Gold" },
      { hex: "#6C4AB6", name: "Multiverse Violet" },
    ],
  },
];

const palettesByFilm = new Map<FilmId, Palette>(palettes.map((p) => [p.filmId, p]));

export function getPalette(filmId: FilmId): Palette | undefined {
  return palettesByFilm.get(filmId);
}
