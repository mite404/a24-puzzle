"use client";

import { useCallback, useState } from "react";
import Map, { Marker, NavigationControl, Popup } from "react-map-gl/mapbox";
import Image from "next/image";
import "mapbox-gl/dist/mapbox-gl.css";
import { getFilmTitle } from "@/data/films";
import type { FilmLocation } from "@/lib/types";
import { Button } from "@/components/ui/button";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

interface LocationMapProps {
  heroLocation: FilmLocation;
  nearbyLocations: FilmLocation[];
  onContinue: () => void;
}

export function LocationMap({
  heroLocation,
  nearbyLocations,
  onContinue,
}: LocationMapProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const hoveredLocation =
    hoveredId
      ? nearbyLocations.find((l) => l.id === hoveredId) ?? null
      : null;

  const handleMarkerEnter = useCallback((id: string) => {
    setHoveredId(id);
    setExpandedId(null);
  }, []);

  const handlePopupClose = useCallback(() => {
    setHoveredId(null);
    setExpandedId(null);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="relative aspect-video w-full overflow-hidden ring-1 ring-foreground">
        <Map
          mapboxAccessToken={MAPBOX_TOKEN}
          initialViewState={{
            longitude: heroLocation.lng,
            latitude: heroLocation.lat,
            zoom: 13,
          }}
          style={{ width: "100%", height: "100%" }}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          scrollZoom={false}
          attributionControl={false}
        >
          <NavigationControl position="top-right" showCompass={false} />

          {/* Hero pin */}
          <Marker
            longitude={heroLocation.lng}
            latitude={heroLocation.lat}
            anchor="center"
          >
            <div className="hero-pin" />
          </Marker>

          {/* Nearby pins */}
          {nearbyLocations.map((loc) => (
            <Marker
              key={loc.id}
              longitude={loc.lng}
              latitude={loc.lat}
              anchor="center"
            >
              <div
                className="nearby-pin"
                onMouseEnter={() => handleMarkerEnter(loc.id)}
              />
            </Marker>
          ))}

          {/* Hover popup */}
          {hoveredLocation && (
            <Popup
              longitude={hoveredLocation.lng}
              latitude={hoveredLocation.lat}
              anchor="bottom"
              closeOnClick={false}
              onClose={handlePopupClose}
              className="location-popup"
              maxWidth="260px"
            >
              <div className="flex flex-col gap-2 bg-background p-0 font-sans">
                <div className="relative aspect-video w-full overflow-hidden">
                  <Image
                    src={hoveredLocation.photoUrl}
                    alt={`${getFilmTitle(hoveredLocation.filmId)} — ${hoveredLocation.neighborhood}`}
                    fill
                    sizes="260px"
                    className="object-cover"
                  />
                </div>

                <div className="flex flex-col gap-1 px-3 pb-2">
                  <p className="a24-eyebrow text-foreground">
                    {hoveredLocation.neighborhood}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {getFilmTitle(hoveredLocation.filmId)} &middot;{" "}
                    {hoveredLocation.address}
                  </p>

                  {expandedId === hoveredLocation.id ? (
                    <div className="mt-2 border-t border-border pt-2">
                      <div className="relative aspect-video w-full overflow-hidden">
                        <Image
                          src={hoveredLocation.photoUrl}
                          alt={`${hoveredLocation.neighborhood} — real location`}
                          fill
                          sizes="240px"
                          className="object-cover"
                        />
                      </div>
                    </div>
                  ) : (
                    <button
                      className="mt-1 self-start text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                      onClick={() => setExpandedId(hoveredLocation.id)}
                    >
                      more info&hellip;
                    </button>
                  )}
                </div>
              </div>
            </Popup>
          )}
        </Map>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={onContinue}
          variant="outline"
          className="a24-cta h-auto"
        >
          To the crossword
        </Button>
      </div>
    </div>
  );
}
