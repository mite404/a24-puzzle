"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Map, { Marker, NavigationControl, Popup } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import type { FilmLocation } from "@/lib/types";
import { A24CtaButton } from "@/components/a24-cta-button";
import { LocationPinCard } from "@/components/games/location-pin-card";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

/** Brief delay so the cursor can travel pin → card without dismissing collapsed hover. */
const HOVER_BRIDGE_MS = 120;

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
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hoveredLocation =
    hoveredId
      ? nearbyLocations.find((l) => l.id === hoveredId) ?? null
      : null;

  const cancelScheduledClose = useCallback(() => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const handlePopupClose = useCallback(() => {
    cancelScheduledClose();
    setHoveredId(null);
    setExpandedId(null);
  }, [cancelScheduledClose]);

  const scheduleCollapsedClose = useCallback(() => {
    if (expandedId) {
      return;
    }
    cancelScheduledClose();
    closeTimerRef.current = setTimeout(() => {
      handlePopupClose();
      closeTimerRef.current = null;
    }, HOVER_BRIDGE_MS);
  }, [expandedId, cancelScheduledClose, handlePopupClose]);

  useEffect(() => () => cancelScheduledClose(), [cancelScheduledClose]);

  const handleMarkerEnter = useCallback(
    (id: string) => {
      cancelScheduledClose();
      setHoveredId((prev) => {
        if (prev !== id) {
          setExpandedId(null);
        }
        return id;
      });
    },
    [cancelScheduledClose],
  );

  const handleMapClick = useCallback(() => {
    if (expandedId) {
      handlePopupClose();
    }
  }, [expandedId, handlePopupClose]);

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
          onClick={handleMapClick}
        >
          <NavigationControl position="top-right" showCompass={false} />

          <Marker
            longitude={heroLocation.lng}
            latitude={heroLocation.lat}
            anchor="center"
          >
            <div className="hero-pin" />
          </Marker>

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
                onMouseLeave={scheduleCollapsedClose}
              />
            </Marker>
          ))}

          {hoveredLocation && (
            <Popup
              longitude={hoveredLocation.lng}
              latitude={hoveredLocation.lat}
              anchor="bottom"
              offset={12}
              closeOnClick={false}
              closeButton={false}
              onClose={handlePopupClose}
              className="location-popup"
              maxWidth="none"
            >
              <div
                className="location-popup__hit"
                onMouseEnter={() => handleMarkerEnter(hoveredLocation.id)}
                onMouseLeave={scheduleCollapsedClose}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <LocationPinCard
                  location={hoveredLocation}
                  expanded={expandedId === hoveredLocation.id}
                  onMoreInfo={() => setExpandedId(hoveredLocation.id)}
                />
              </div>
            </Popup>
          )}
        </Map>
      </div>

      <div className="flex justify-end">
        <A24CtaButton onClick={onContinue}>To the crossword</A24CtaButton>
      </div>
    </div>
  );
}
