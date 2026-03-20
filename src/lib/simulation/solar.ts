// =============================================================================
// Solar Exposure Proxy — Reduced-Order Approximation
//
// SCIENTIFIC DISCLAIMER: This is a reduced-order model, not a full radiative-
// transfer solver. It uses simplified sun-vector sampling and 2-D shadow
// projection to estimate relative solar exposure across a district grid. It
// does not account for atmospheric scattering, diffuse irradiance anisotropy,
// reflections, or spectral composition. Results are dimensionless proxies in
// the range [0, 1] and should be interpreted as relative exposure indicators,
// not absolute irradiance values.
// =============================================================================

import type { BuildingFeature, SunPosition, SolarConditionProfile } from "@/types/simulation";
import { toRad, clamp } from "./normalize";

// ---------------------------------------------------------------------------
// Solar position computation
// Simplified solar geometry after Spencer (1971) and Iqbal (1983).
// Ignores atmospheric refraction and uses the equation of time approximation.
// ---------------------------------------------------------------------------

/**
 * Compute solar elevation and azimuth for a given latitude, day-of-year,
 * and solar time hour (0–23 decimal hours).
 *
 * Returns null if the sun is below the horizon (elevation ≤ 0°).
 */
export function computeSunPosition(
  latDeg: number,
  hour: number,
  dayOfYear: number
): SunPosition | null {
  // Solar declination (Spencer 1971)
  const B = toRad((360 / 365) * (dayOfYear - 81));
  const declinationDeg =
    23.45 * Math.sin(B);
  const declinationRad = toRad(declinationDeg);
  const latRad = toRad(latDeg);

  // Hour angle: positive in the afternoon, negative in the morning
  const hourAngleRad = toRad(15 * (hour - 12));

  // Solar elevation angle
  const elevationRad = Math.asin(
    Math.sin(latRad) * Math.sin(declinationRad) +
      Math.cos(latRad) * Math.cos(declinationRad) * Math.cos(hourAngleRad)
  );

  const elevationDeg = (elevationRad * 180) / Math.PI;

  // Sun below horizon — no contribution
  if (elevationDeg <= 0) return null;

  // Solar azimuth (degrees from North, clockwise)
  const sinAz =
    (-Math.cos(declinationRad) * Math.sin(hourAngleRad)) /
    Math.cos(elevationRad);
  const cosAz =
    (Math.sin(declinationRad) -
      Math.sin(latRad) * Math.sin(elevationRad)) /
    (Math.cos(latRad) * Math.cos(elevationRad));

  let azimuthRad = Math.atan2(sinAz, cosAz);
  let azimuthDeg = (azimuthRad * 180) / Math.PI;
  // Ensure azimuth is in [0, 360)
  if (azimuthDeg < 0) azimuthDeg += 360;

  return { hour, elevation: elevationDeg, azimuth: azimuthDeg };
}

/**
 * Generate hourly sun positions for a representative day.
 * Returns only positions where the sun is above the horizon.
 */
export function generateDaySunPositions(
  latDeg: number,
  dayOfYear: number
): SunPosition[] {
  const positions: SunPosition[] = [];
  // Sample every 30 minutes for better resolution
  for (let h = 4; h <= 22; h += 0.5) {
    const pos = computeSunPosition(latDeg, h, dayOfYear);
    if (pos) positions.push(pos);
  }
  return positions;
}

// ---------------------------------------------------------------------------
// Polygon shadow geometry
// ---------------------------------------------------------------------------

/**
 * Project a building footprint onto the ground plane along the sun vector.
 * Returns the shadow polygon as an array of [x, y] local-metric coordinates.
 *
 * Method: translate each vertex of the building footprint by the shadow vector
 * (direction opposite to sun azimuth) scaled by shadow length. The shadow
 * polygon is the convex union of the footprint and its translated copy; for
 * the purposes of this reduced-order model, we use the translated-only polygon
 * (equivalent to the "ground shadow" of the roofline).
 *
 * Shadow length = building_height / tan(elevation_angle)
 */
export function buildingShadowPolygon(
  footprint: [number, number][],
  height: number,
  sunElevationDeg: number,
  sunAzimuthDeg: number
): [number, number][] {
  const elevRad = toRad(sunElevationDeg);
  if (elevRad <= 0) return [];

  const shadowLength = height / Math.tan(elevRad);

  // Shadow extends opposite to the sun azimuth direction
  const shadowAzRad = toRad(sunAzimuthDeg + 180);
  // Shadow vector in local-XY (X = East, Y = North)
  const dx = shadowLength * Math.sin(shadowAzRad);
  const dy = shadowLength * Math.cos(shadowAzRad);

  // Translate the footprint by the shadow vector (roofline shadow)
  const shadow: [number, number][] = footprint.map(([x, y]) => [
    x + dx,
    y + dy,
  ]);

  // Return the union: original footprint + translated shadow.
  // For the occlusion test, we care whether the cell centre falls inside
  // either polygon. We concatenate both and test each separately.
  return shadow;
}

// ---------------------------------------------------------------------------
// Point-in-polygon: ray-casting algorithm
// Coordinates are [x, y] in any consistent 2-D space.
// ---------------------------------------------------------------------------

export function pointInPolygon(
  px: number,
  py: number,
  polygon: [number, number][]
): boolean {
  const n = polygon.length;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

// ---------------------------------------------------------------------------
// Cloud-condition attenuation factors
// ---------------------------------------------------------------------------

const CLOUD_ATTENUATION: Record<SolarConditionProfile, number> = {
  clear: 1.0,
  partly_cloudy: 0.65,
  overcast: 0.25,
};

// ---------------------------------------------------------------------------
// Per-cell Solar Exposure Proxy
// ---------------------------------------------------------------------------

/**
 * Compute the Solar Exposure Proxy for a single cell.
 *
 * Algorithm (reduced-order):
 * 1. Sample hourly sun positions across a representative day.
 * 2. For each sun position with elevation > 0°, determine whether the cell
 *    centre is occluded by any building's ground shadow.
 * 3. Accumulate weighted (by sin(elevation)) visible fractions.
 * 4. Apply cloud-condition attenuation and return value in [0, 1].
 *
 * The result is a relative proxy, not absolute irradiance.
 *
 * @param cellX  Cell centre X in local metres
 * @param cellY  Cell centre Y in local metres
 * @param buildingsLocal  Building footprints in local metres
 * @param sunPositions  Precomputed day sun-position samples
 * @param solarCondition  Atmospheric condition affecting attenuation
 */
export function computeSolarExposure(
  cellX: number,
  cellY: number,
  buildingsLocal: { footprint: [number, number][]; height: number }[],
  sunPositions: SunPosition[],
  solarCondition: SolarConditionProfile
): number {
  if (sunPositions.length === 0) return 0;

  let weightedVisible = 0;
  let totalWeight = 0;

  for (const sun of sunPositions) {
    const weight = Math.sin(toRad(sun.elevation));
    totalWeight += weight;

    let isShadowed = false;

    for (const bld of buildingsLocal) {
      // First check: is the cell inside the building footprint itself?
      if (pointInPolygon(cellX, cellY, bld.footprint)) {
        isShadowed = true;
        break;
      }

      // Second check: is the cell inside this building's ground shadow?
      const shadow = buildingShadowPolygon(
        bld.footprint,
        bld.height,
        sun.elevation,
        sun.azimuth
      );
      if (shadow.length > 0 && pointInPolygon(cellX, cellY, shadow)) {
        isShadowed = true;
        break;
      }
    }

    if (!isShadowed) {
      weightedVisible += weight;
    }
  }

  const rawExposure = totalWeight > 0 ? weightedVisible / totalWeight : 0;
  const attenuated = rawExposure * CLOUD_ATTENUATION[solarCondition];
  return clamp(attenuated);
}
