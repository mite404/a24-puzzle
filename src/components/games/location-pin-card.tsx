"use client";

import Image from "next/image";
import { getFilmShortTitle, getFilmTitle } from "@/data/films";
import type { FilmLocation } from "@/lib/types";

const A24_LOGO_SRC = "/a24-assets/A24-Films-Logo-Vector.png";

const CAROUSEL_SEGMENTS = 4;

interface LocationPinCardProps {
  location: FilmLocation;
  expanded: boolean;
  onMoreInfo: () => void;
}

function venueLabel(location: FilmLocation): string {
  return location.venueLabel ?? location.address;
}

function LocationPinCardMedia({
  location,
  showLogo = false,
}: {
  location: FilmLocation;
  showLogo?: boolean;
}) {
  const alt = `${getFilmTitle(location.filmId)} — ${location.neighborhood}`;

  return (
    <div className="location-pin-card__media">
      <Image
        src={location.photoUrl}
        alt={alt}
        fill
        sizes="364px"
        className="location-pin-card__image"
        priority={false}
      />
      <div className="location-pin-card__gradient" />
      {showLogo ? (
        <Image
          src={A24_LOGO_SRC}
          alt="A24"
          width={47}
          height={20}
          className="location-pin-card__logo"
        />
      ) : null}
    </div>
  );
}

function LocationPinCarousel({ activeIndex = 0 }: { activeIndex?: number }) {
  return (
    <div
      className="location-pin-card__carousel"
      role="tablist"
      aria-label="Location photos"
    >
      {Array.from({ length: CAROUSEL_SEGMENTS }, (_, i) => (
        <span
          key={i}
          role="presentation"
          className={
            i === activeIndex
              ? "location-pin-card__carousel-seg is-active"
              : "location-pin-card__carousel-seg"
          }
        />
      ))}
    </div>
  );
}

export function LocationPinCard({
  location,
  expanded,
  onMoreInfo,
}: LocationPinCardProps) {
  const filmShort = getFilmShortTitle(location.filmId);
  const filmFull = getFilmTitle(location.filmId);
  const venue = venueLabel(location);

  return (
    <article
      className={
        expanded
          ? "location-pin-card location-pin-card--expanded"
          : "location-pin-card location-pin-card--collapsed"
      }
    >
      <div className="location-pin-card__body">
        <LocationPinCardMedia location={location} showLogo={expanded} />
        <div
          className={
            expanded
              ? "location-pin-card__overlay location-pin-card__overlay--expanded"
              : "location-pin-card__overlay"
          }
        >
          <h2 className="location-pin-card__title">{location.neighborhood}</h2>
          {expanded ? (
            <>
              <p className="location-pin-card__eyebrow">Film</p>
              <p className="location-pin-card__film">{filmShort}</p>
            </>
          ) : (
            <>
              <div className="location-pin-card__meta">
                <span>{filmShort}</span>
                <span>{venue}</span>
              </div>
              <button
                type="button"
                className="location-pin-card__more"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onMoreInfo();
                }}
              >
                more info&hellip;
              </button>
            </>
          )}
        </div>
      </div>
      {expanded ? (
        <footer className="location-pin-card__footer">
          <LocationPinCarousel activeIndex={0} />
          <p className="location-pin-card__footer-caption">
            {venue} &mdash; {filmFull}
          </p>
        </footer>
      ) : null}
    </article>
  );
}
