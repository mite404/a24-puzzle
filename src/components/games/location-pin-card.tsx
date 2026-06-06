"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { getLocationPhotoUrls } from "@/data/locations";
import { getFilmShortTitle, getFilmTitle } from "@/data/films";
import type { FilmLocation } from "@/lib/types";

const A24_LOGO_SRC = "/a24-assets/A24-Films-Logo-Vector.png";
const CAROUSEL_INTERVAL_MS = 4000;

interface LocationPinCardProps {
  location: FilmLocation;
  expanded: boolean;
  onMoreInfo: () => void;
}

function venueLabel(location: FilmLocation): string {
  return location.venueLabel ?? location.address;
}

function LocationPinCardMedia({
  photos,
  alt,
  activeIndex,
  animate,
  showLogo = false,
}: {
  photos: string[];
  alt: string;
  activeIndex: number;
  animate: boolean;
  showLogo?: boolean;
}) {
  const safeIndex = Math.min(activeIndex, Math.max(photos.length - 1, 0));

  return (
    <div className="location-pin-card__media">
      <div
        className="location-pin-card__media-track"
        style={{
          transform: animate
            ? `translateX(-${safeIndex * 100}%)`
            : undefined,
        }}
      >
        {photos.map((src, i) => (
          <div key={src} className="location-pin-card__media-slide">
            <Image
              src={src}
              alt={i === 0 ? alt : `${alt} (${i + 1})`}
              fill
              sizes="260px"
              className="location-pin-card__image"
              priority={i === 0}
            />
          </div>
        ))}
      </div>
      <div className="location-pin-card__gradient" aria-hidden="true" />
      {showLogo ? (
        <Image
          src={A24_LOGO_SRC}
          alt="A24"
          width={34}
          height={14}
          className="location-pin-card__logo"
        />
      ) : null}
    </div>
  );
}

function LocationPinCarousel({
  count,
  activeIndex,
}: {
  count: number;
  activeIndex: number;
}) {
  if (count <= 1) return null;

  return (
    <div
      className="location-pin-card__carousel"
      role="tablist"
      aria-label="Location photos"
    >
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          role="presentation"
          aria-hidden={i !== activeIndex}
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

export function LocationPinCard(props: LocationPinCardProps) {
  return (
    <LocationPinCardInner
      key={`${props.location.id}-${props.expanded}`}
      {...props}
    />
  );
}

function LocationPinCardInner({
  location,
  expanded,
  onMoreInfo,
}: LocationPinCardProps) {
  const filmTitle = getFilmShortTitle(location.filmId);
  const venue = venueLabel(location);
  const galleryPhotos = getLocationPhotoUrls(location);
  const collapsedPhoto = [location.photoUrl];

  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const advance = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % galleryPhotos.length);
  }, [galleryPhotos.length]);

  useEffect(() => {
    if (!expanded || paused || reducedMotion || galleryPhotos.length <= 1) {
      return;
    }

    const id = window.setInterval(advance, CAROUSEL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [expanded, paused, reducedMotion, galleryPhotos.length, advance]);

  const alt = `${getFilmTitle(location.filmId)} — ${location.neighborhood}`;
  const photos = expanded ? galleryPhotos : collapsedPhoto;
  const carouselIndex = expanded && !reducedMotion ? activeIndex : 0;
  const animateSlides =
    expanded && !reducedMotion && galleryPhotos.length > 1;

  return (
    <article
      className={
        expanded
          ? "location-pin-card location-pin-card--expanded"
          : "location-pin-card location-pin-card--collapsed"
      }
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="location-pin-card__body">
        <LocationPinCardMedia
          photos={photos}
          alt={alt}
          activeIndex={carouselIndex}
          animate={animateSlides}
          showLogo={expanded}
        />
        <div
          className={
            expanded
              ? "location-pin-card__overlay location-pin-card__overlay--expanded"
              : "location-pin-card__overlay"
          }
        >
          <h2 className="location-pin-card__title">{filmTitle}</h2>
          {!expanded ? (
            <p className="location-pin-card__location">{venue}</p>
          ) : null}
          {!expanded ? (
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
          ) : null}
        </div>
      </div>
      {expanded ? (
        <footer className="location-pin-card__footer">
          <LocationPinCarousel
            count={galleryPhotos.length}
            activeIndex={carouselIndex}
          />
          <div className="location-pin-card__footer-copy">
            <p className="location-pin-card__footer-location">{venue}</p>
            <p className="location-pin-card__footer-neighborhood">
              {location.neighborhood}
            </p>
          </div>
        </footer>
      ) : null}
    </article>
  );
}
