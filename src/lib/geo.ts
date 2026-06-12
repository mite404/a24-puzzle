import type { FilmLocation } from "@/lib/types";

const EARTH_RADIUS_MI = 3958.8;

interface LatLng {
  lat: number;
  lng: number;
}

/** Great-circle distance in miles between two lat/lng points. */
function haversine(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.sqrt(h));
}

interface NearbyOptions {
  minResults?: number;
  startRadiusMi?: number;
  stepMi?: number;
  maxRadiusMi?: number;
}

/**
 * Returns locations near `hero`, expanding the search radius in increments
 * until at least `minResults` are found. All current data is in NYC so the
 * first pass (10 mi) will almost always suffice; the expansion exists for
 * when the dataset grows beyond a single city.
 */
export function getNearbyLocations(
  hero: FilmLocation,
  allLocations: FilmLocation[],
  opts: NearbyOptions = {},
): FilmLocation[] {
  const {
    minResults = 1,
    startRadiusMi = 10,
    stepMi = 10,
    maxRadiusMi = 100,
  } = opts;

  const others = allLocations.filter((l) => l.id !== hero.id);

  for (let radius = startRadiusMi; radius <= maxRadiusMi; radius += stepMi) {
    const nearby = others.filter((l) => haversine(hero, l) <= radius);
    if (nearby.length >= minResults) return nearby;
  }

  return others;
}
