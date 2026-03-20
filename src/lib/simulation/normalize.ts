// =============================================================================
// Normalization utilities for the reduced-order simulation engine
// =============================================================================

/**
 * Clamp x to [min, max].
 */
export function clamp(x: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, x));
}

/**
 * Logistic sigmoid: σ(x) = 1 / (1 + e^{-x})
 * Maps any real number to (0, 1).
 */
export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Normalise an array of values to the [0, 1] range using min-max scaling.
 * If all values are equal, returns an array of zeros (no informational content).
 */
export function minMaxNormalize(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  if (range === 0) return values.map(() => 0);
  return values.map((v) => (v - min) / range);
}

/**
 * Population standard deviation of an array.
 */
export function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Weighted mean of values with corresponding weights.
 * Weights need not sum to 1 — they are normalised internally.
 */
export function weightedMean(values: number[], weights: number[]): number {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return 0;
  return (
    values.reduce((acc, v, i) => acc + v * weights[i], 0) / totalWeight
  );
}

/**
 * Euclidean distance between two 2-D points [x1,y1] and [x2,y2].
 */
export function dist2d(
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  return Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
}

/**
 * Convert degrees to radians.
 */
export function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Convert radians to degrees.
 */
export function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Approximate metres per degree of latitude (constant everywhere).
 */
export const METRES_PER_LAT_DEG = 111_320;

/**
 * Approximate metres per degree of longitude at a given latitude.
 */
export function metresPerLngDeg(lat: number): number {
  return 111_320 * Math.cos(toRad(lat));
}

/**
 * Convert a geographic coordinate to local-metric [x, y] in metres
 * relative to a given origin coordinate.
 */
export function lngLatToLocalXY(
  lng: number,
  lat: number,
  originLng: number,
  originLat: number
): [number, number] {
  const x = (lng - originLng) * metresPerLngDeg(originLat);
  const y = (lat - originLat) * METRES_PER_LAT_DEG;
  return [x, y];
}

/**
 * Convert local-metric [x, y] back to geographic coordinates.
 */
export function localXYToLngLat(
  x: number,
  y: number,
  originLng: number,
  originLat: number
): [number, number] {
  const lng = originLng + x / metresPerLngDeg(originLat);
  const lat = originLat + y / METRES_PER_LAT_DEG;
  return [lng, lat];
}
