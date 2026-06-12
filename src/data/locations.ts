import type { FilmId, FilmLocation } from "@/lib/types";

/** Film-wide still pools for carousel fallback when a location omits `photoUrls`. */
const FILM_STILLS: Partial<Record<FilmId, string[]>> = {
  "uncut-gems": [
    "/a24-assets/uncut-gems-01.jpg",
    "/a24-assets/uncut-gems-02.jpg",
    "/a24-assets/uncut-gems-03.jpg",
  ],
  "the-backrooms": [
    "/a24-assets/A24_BACKROOMS_01.jpg",
    "/a24-assets/backrooms-02.jpg",
    "/a24-assets/backrooms-03.JPG",
    "/a24-assets/backrooms-04.JPG",
  ],
  materialists: [
    "/a24-assets/materialists/materialists-still-cooper-union.webp",
    "/a24-assets/materialists/materialists-Saint-Bartholomews-movie-still.webp",
    "/a24-assets/materialists/materialists-Cooper-Union-Real.webp",
    "/a24-assets/materialists/materialists-Saint-Bartholomews-Real.webp",
  ],
};

function filmStillsForFilm(filmId: FilmId): string[] {
  return FILM_STILLS[filmId] ?? [];
}

/** Carousel gallery: explicit `photoUrls` or primary still + film pool (deduped). */
export function getLocationPhotoUrls(location: FilmLocation): string[] {
  if (location.photoUrls?.length) return location.photoUrls;
  return [...new Set([location.photoUrl, ...filmStillsForFilm(location.filmId)])];
}

/**
 * NYC filming locations. Photos point at the real stills we have on hand
 * (uncut-gems + the-backrooms) so the quiz renders real imagery. Coordinates are
 * real NYC points spread across the map so the explore-mode pins feel populated.
 */
export const locations: FilmLocation[] = [
  {
    id: "ug-diamond-district",
    filmId: "uncut-gems",
    photoUrl: "/a24-assets/uncut-gems-01.jpg",
    address: "W 47th Street",
    neighborhood: "Diamond District",
    lat: 40.7575,
    lng: -73.9802,
    hint: "One block, wholesale jewels in every window.",
  },
  {
    id: "ug-midtown",
    filmId: "uncut-gems",
    photoUrl: "/a24-assets/uncut-gems-02.jpg",
    address: "Sixth Avenue",
    neighborhood: "Midtown",
    lat: 40.758,
    lng: -73.9819,
    hint: "Howard's frantic orbit never leaves Midtown for long.",
  },
  {
    id: "ug-les",
    filmId: "uncut-gems",
    photoUrl: "/a24-assets/uncut-gems-03.jpg",
    address: "The Bowery",
    neighborhood: "Lower East Side",
    lat: 40.7227,
    lng: -73.9925,
    hint: "Downtown, where the debts finally come due.",
  },
  {
    id: "br-bushwick",
    filmId: "the-backrooms",
    photoUrl: "/a24-assets/A24_BACKROOMS_01.jpg",
    address: "Flushing Avenue",
    neighborhood: "Bushwick",
    lat: 40.6944,
    lng: -73.9213,
    hint: "An endless office that should not exist.",
  },
  {
    id: "br-lic",
    filmId: "the-backrooms",
    photoUrl: "/a24-assets/backrooms-02.jpg",
    address: "Jackson Avenue",
    neighborhood: "Long Island City",
    lat: 40.7447,
    lng: -73.9485,
    hint: "Fluorescent hum, no exit in sight.",
  },
  {
    id: "br-gowanus",
    filmId: "the-backrooms",
    photoUrl: "/a24-assets/backrooms-03.JPG",
    address: "Nevins Street",
    neighborhood: "Gowanus",
    lat: 40.6745,
    lng: -73.9889,
    hint: "Damp yellow walls as far as you can run.",
  },
  {
    id: "br-koreatown",
    filmId: "the-backrooms",
    photoUrl: "/a24-assets/backrooms-04.JPG",
    address: "W 32nd Street",
    neighborhood: "Koreatown",
    lat: 40.7478,
    lng: -73.9857,
    hint: "You noclipped out of reality somewhere near here.",
  },
  {
    id: "mat-cooper-union",
    filmId: "materialists",
    photoUrl: "/a24-assets/materialists/materialists-still-cooper-union.webp",
    address: "Cooper Square",
    venueLabel: "Cooper Union",
    neighborhood: "East Village",
    lat: 40.7291,
    lng: -73.9907,
    hint: "A college where Lincoln once spoke, now backdrop for modern heartbreak.",
  },
  {
    id: "mat-st-barts",
    filmId: "materialists",
    photoUrl: "/a24-assets/materialists/materialists-Saint-Bartholomews-movie-still.webp",
    address: "Park Avenue",
    venueLabel: "St. Barts Cathedral",
    neighborhood: "Midtown East",
    lat: 40.7541,
    lng: -73.9718,
    hint: "Byzantine grandeur on Park Avenue, dressed for a wedding.",
  },
  {
    id: "mat-lotte-palace",
    filmId: "materialists",
    photoUrl:
      "/a24-assets/materialists/materialists-Saint-Bartholomews-Real.webp",
    address: "Madison Avenue",
    venueLabel: "Lotte New York Palace",
    neighborhood: "Midtown East",
    lat: 40.7579,
    lng: -73.9749,
    hint: "Gilded Age luxury where elite matchmaking feels right at home.",
  },
];

const locationsById = new Map(locations.map((l) => [l.id, l]));

export function getLocation(id: string): FilmLocation | undefined {
  return locationsById.get(id);
}
