import type { Film, FilmId } from "@/lib/types";

export const films: Film[] = [
  {
    id: "uncut-gems",
    title: "Uncut Gems",
    year: 2019,
    director: "Josh & Benny Safdie",
    genres: ["Thriller", "Drama"],
  },
  {
    id: "good-time",
    title: "Good Time",
    year: 2017,
    director: "Josh & Benny Safdie",
    genres: ["Crime", "Thriller"],
  },
  {
    id: "the-backrooms",
    title: "The Backrooms",
    year: 2024,
    director: "Kane Parsons",
    genres: ["Horror"],
  },
  {
    id: "moonlight",
    title: "Moonlight",
    year: 2016,
    director: "Barry Jenkins",
    genres: ["Drama"],
  },
  {
    id: "hereditary",
    title: "Hereditary",
    year: 2018,
    director: "Ari Aster",
    genres: ["Horror"],
  },
  {
    id: "midsommar",
    title: "Midsommar",
    year: 2019,
    director: "Ari Aster",
    genres: ["Horror"],
  },
  {
    id: "the-witch",
    title: "The Witch",
    year: 2015,
    director: "Robert Eggers",
    genres: ["Horror"],
  },
  {
    id: "lady-bird",
    title: "Lady Bird",
    year: 2017,
    director: "Greta Gerwig",
    genres: ["Drama", "Comedy"],
  },
  {
    id: "ex-machina",
    title: "Ex Machina",
    year: 2014,
    director: "Alex Garland",
    genres: ["Sci-Fi", "Thriller"],
  },
  {
    id: "everything-everywhere",
    title: "Everything Everywhere All at Once",
    year: 2022,
    director: "Daniels",
    genres: ["Sci-Fi", "Comedy"],
  },
  {
    id: "materialists",
    title: "Materialists",
    year: 2025,
    director: "Celine Song",
    genres: ["Romance", "Comedy"],
  },
];

const filmsById = new Map<FilmId, Film>(films.map((f) => [f.id, f]));

export function getFilm(id: FilmId): Film | undefined {
  return filmsById.get(id);
}

export function getFilmTitle(id: FilmId): string {
  return filmsById.get(id)?.title ?? id;
}

/** Card copy: drop leading "The" (e.g. "The Backrooms" → "Backrooms"). */
export function getFilmShortTitle(id: FilmId): string {
  return getFilmTitle(id).replace(/^The\s+/i, "");
}
