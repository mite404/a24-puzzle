import type { Film, FilmId } from "@/lib/types";

export const films: Film[] = [
  {
    id: "uncut-gems",
    title: "Uncut Gems",
    year: 2019,
    director: "Josh & Benny Safdie",
    genres: ["Thriller", "Drama"],
    cast: [
      "Adam Sandler",
      "Julia Fox",
      "Lakeith Stanfield",
      "Kevin Garnett",
      "Idina Menzel",
      "Eric Bogosian",
    ],
  },
  {
    id: "good-time",
    title: "Good Time",
    year: 2017,
    director: "Josh & Benny Safdie",
    genres: ["Crime", "Thriller"],
    cast: [
      "Robert Pattinson",
      "Benny Safdie",
      "Jennifer Jason Leigh",
      "Taliah Webster",
      "Buddy Duress",
      "Barkhad Abdi",
    ],
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
    cast: [
      "Mahershala Ali",
      "Naomie Harris",
      "Trevante Rhodes",
      "Ashton Sanders",
      "Alex Hibbert",
      "André Holland",
      "Janelle Monáe",
      "Jharrel Jerome",
    ],
  },
  {
    id: "hereditary",
    title: "Hereditary",
    year: 2018,
    director: "Ari Aster",
    genres: ["Horror"],
    cast: [
      "Toni Collette",
      "Alex Wolff",
      "Milly Shapiro",
      "Gabriel Byrne",
      "Ann Dowd",
    ],
  },
  {
    id: "midsommar",
    title: "Midsommar",
    year: 2019,
    director: "Ari Aster",
    genres: ["Horror"],
    cast: [
      "Florence Pugh",
      "Jack Reynor",
      "William Jackson Harper",
      "Will Poulter",
      "Vilhelm Blomgren",
    ],
  },
  {
    id: "the-witch",
    title: "The Witch",
    year: 2015,
    director: "Robert Eggers",
    genres: ["Horror"],
    cast: [
      "Anya Taylor-Joy",
      "Ralph Ineson",
      "Kate Dickie",
      "Harvey Scrimshaw",
    ],
  },
  {
    id: "lady-bird",
    title: "Lady Bird",
    year: 2017,
    director: "Greta Gerwig",
    genres: ["Drama", "Comedy"],
    cast: [
      "Saoirse Ronan",
      "Laurie Metcalf",
      "Tracy Letts",
      "Lucas Hedges",
      "Timothée Chalamet",
      "Beanie Feldstein",
    ],
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
    cast: ["Dakota Johnson", "Chris Evans", "Pedro Pascal"],
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
