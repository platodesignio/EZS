// =============================================================================
// GeoJSON parsing utilities
// =============================================================================

import type { GeoJsonFeatureCollection } from "@/types/project";
import type { BuildingFeature } from "@/types/simulation";

/**
 * Parse GeoJSON building data from raw string or object.
 * Returns empty array on parse failure or malformed input.
 */
export function parseBuildingGeoJson(
  raw: unknown
): BuildingFeature[] {
  let geojson: GeoJsonFeatureCollection;

  if (typeof raw === "string") {
    try {
      geojson = JSON.parse(raw) as GeoJsonFeatureCollection;
    } catch {
      return [];
    }
  } else if (raw && typeof raw === "object") {
    geojson = raw as GeoJsonFeatureCollection;
  } else {
    return [];
  }

  if (geojson.type !== "FeatureCollection" || !Array.isArray(geojson.features)) {
    return [];
  }

  const buildings: BuildingFeature[] = [];

  for (const feature of geojson.features) {
    if (!feature.geometry) continue;

    const props = feature.properties ?? {};
    const rawHeight =
      typeof props.height === "number"
        ? props.height
        : typeof props.floors === "number"
          ? (props.floors as number) * 3.5
          : 10;

    const height = Math.max(1, rawHeight as number);
    const id =
      feature.id != null
        ? String(feature.id)
        : `bld_${buildings.length}`;

    if (feature.geometry.type === "Polygon") {
      const coords = (
        feature.geometry as { type: "Polygon"; coordinates: [number, number][][] }
      ).coordinates[0];
      if (coords && coords.length >= 3) {
        buildings.push({ id, footprint: coords as [number, number][], height });
      }
    } else if (feature.geometry.type === "MultiPolygon") {
      const multiCoords = (
        feature.geometry as {
          type: "MultiPolygon";
          coordinates: [number, number][][][];
        }
      ).coordinates;
      multiCoords.forEach((poly, i) => {
        if (poly[0] && poly[0].length >= 3) {
          buildings.push({
            id: `${id}_${i}`,
            footprint: poly[0] as [number, number][],
            height,
          });
        }
      });
    }
  }

  return buildings;
}

/**
 * Compute the geographic centroid of a building array.
 */
export function computeCentroid(
  buildings: BuildingFeature[]
): { lng: number; lat: number } | null {
  if (buildings.length === 0) return null;

  let sumLng = 0;
  let sumLat = 0;
  let count = 0;

  for (const bld of buildings) {
    for (const [lng, lat] of bld.footprint) {
      sumLng += lng;
      sumLat += lat;
      count++;
    }
  }

  return count > 0
    ? { lng: sumLng / count, lat: sumLat / count }
    : null;
}

/**
 * Compute the geographic bounding box of a building array.
 */
export function computeSiteExtent(buildings: BuildingFeature[]): {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
} | null {
  if (buildings.length === 0) return null;

  let minLng = Infinity, maxLng = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;

  for (const bld of buildings) {
    for (const [lng, lat] of bld.footprint) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }

  return { minLng, minLat, maxLng, maxLat };
}
