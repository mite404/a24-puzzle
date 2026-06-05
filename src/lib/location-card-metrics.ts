/**
 * Location pin card dimensions — Figma 16.5×18.625rem collapsed,
 * 16.5×25rem expanded (footer shape 9.125rem), scaled ~92.5% for the map.
 */
export const LOCATION_CARD = {
  width: 260,
  collapsedHeight: 247,
  expandedHeight: 370,
  bodyHeight: 235,
  footerHeight: 135,
  radius: 43,
  mapPadding: 12,
  pinGap: 10,
  /** Mapbox popup tip (~10px) included in vertical fit math */
  tipHeight: 10,
} as const;

export type LocationPopupAnchor =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

function verticalOverflow(
  top: number,
  bottom: number,
  mapHeight: number,
  padding: number,
): number {
  return (
    Math.max(0, padding - top) +
    Math.max(0, bottom - (mapHeight - padding))
  );
}

export function getLocationCardPopupPlacement({
  pinX,
  pinY,
  mapWidth,
  mapHeight,
  cardWidth,
  cardHeight,
  padding = LOCATION_CARD.mapPadding,
  gap = LOCATION_CARD.pinGap,
  tipHeight = LOCATION_CARD.tipHeight,
}: {
  pinX: number;
  pinY: number;
  mapWidth: number;
  mapHeight: number;
  cardWidth: number;
  cardHeight: number;
  padding?: number;
  gap?: number;
  tipHeight?: number;
}): { anchor: LocationPopupAnchor; offset: [number, number] } {
  /* anchor bottom: card sits above the pin, tip points down */
  const aboveTop = pinY - gap - cardHeight - tipHeight;
  const aboveBottom = pinY;

  /* anchor top: card sits below the pin, tip points up */
  const belowTop = pinY + gap + tipHeight;
  const belowBottom = pinY + gap + tipHeight + cardHeight;

  const overflowAbove = verticalOverflow(
    aboveTop,
    aboveBottom,
    mapHeight,
    padding,
  );
  const overflowBelow = verticalOverflow(
    belowTop,
    belowBottom,
    mapHeight,
    padding,
  );

  let anchor: LocationPopupAnchor = "bottom";
  let offsetY = gap;

  if (overflowAbove < overflowBelow) {
    anchor = "bottom";
    if (aboveTop < padding) {
      offsetY = gap + (padding - aboveTop);
    }
  } else if (overflowBelow < overflowAbove) {
    anchor = "top";
    const maxBottom = mapHeight - padding;
    if (belowBottom > maxBottom) {
      offsetY = gap - (belowBottom - maxBottom);
    }
  } else {
    /* Equal overflow — park card toward bottom of map when pin is high */
    const pinInUpperHalf = pinY < mapHeight * 0.5;
    anchor = pinInUpperHalf ? "top" : "bottom";
    offsetY = gap;
    if (anchor === "bottom" && aboveTop < padding) {
      offsetY = gap + (padding - aboveTop);
    }
    if (anchor === "top" && belowBottom > mapHeight - padding) {
      offsetY = gap - (belowBottom - (mapHeight - padding));
    }
  }

  let offsetX = 0;
  const left = pinX - cardWidth / 2;
  const right = pinX + cardWidth / 2;

  if (left < padding) {
    offsetX = padding - left;
  } else if (right > mapWidth - padding) {
    offsetX = mapWidth - padding - right;
  }

  return { anchor, offset: [offsetX, Math.round(offsetY)] };
}

export function getLocationCardHeight(expanded: boolean): number {
  return expanded ? LOCATION_CARD.expandedHeight : LOCATION_CARD.collapsedHeight;
}
