// =============================================================================
// Wind Accessibility Proxy — Reduced-Order Urban Canyon Approximation
//
// SCIENTIFIC DISCLAIMER: This is a reduced-order model. It does not solve the
// Navier-Stokes equations or use computational fluid dynamics. The method is a
// simplified urban canyon H/W ratio approach adapted from Oke (1987) Street
// Canyon Theory and ASHRAE urban ventilation guidelines. It estimates relative
// wind accessibility as a proxy, not actual wind speed or pressure. Results in
// [0, 1] are relative indicators only.
// =============================================================================

import type { BuildingFeature } from "@/types/simulation";
import { toRad, clamp } from "./normalize";

// ---------------------------------------------------------------------------
// Upstream blockage computation
// ---------------------------------------------------------------------------

/**
 * Compute the approximate blockage fraction presented by buildings in the
 * upwind half-plane of a cell.
 *
 * Method:
 * 1. Define the upwind half-plane as the semicircle of radius `searchRadius`
 *    centred on the cell, in the direction opposite to wind bearing.
 * 2. For each building whose centroid falls in this half-plane, compute a
 *    blockage contribution proportional to its projected width perpendicular
 *    to the wind direction and its height-to-distance ratio.
 * 3. Aggregate and normalise to [0, 1].
 *
 * @param cellX        Cell centre X (local metres)
 * @param cellY        Cell centre Y (local metres)
 * @param buildings    Building list in local metres
 * @param windDirDeg   Prevailing wind direction (degrees from North, to-source)
 * @param searchRadius Upstream search radius in metres (default 5 × cell size)
 */
export function computeUpstreamBlockage(
  cellX: number,
  cellY: number,
  buildings: { footprint: [number, number][]; height: number }[],
  windDirDeg: number,
  searchRadius: number
): number {
  // Wind arrives FROM windDirDeg, so upwind direction = windDirDeg + 180
  const upwindDirRad = toRad(windDirDeg + 180);
  // Unit vector in upwind direction (X = East, Y = North)
  const upwindX = Math.sin(upwindDirRad);
  const upwindY = Math.cos(upwindDirRad);

  let totalBlockage = 0;
  let maxBlockage = 0;

  for (const bld of buildings) {
    // Use building footprint centroid
    const centX =
      bld.footprint.reduce((s, p) => s + p[0], 0) / bld.footprint.length;
    const centY =
      bld.footprint.reduce((s, p) => s + p[1], 0) / bld.footprint.length;

    const dx = centX - cellX;
    const dy = centY - cellY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist === 0 || dist > searchRadius) continue;

    // Check if building is in the upwind half-plane
    const dotProduct = dx * upwindX + dy * upwindY;
    if (dotProduct <= 0) continue; // building is downwind

    // Perpendicular width approximation: use bounding-box width perpendicular
    // to wind direction
    const perpX = -upwindY;
    const perpY = upwindX;
    let minPerp = Infinity;
    let maxPerp = -Infinity;
    for (const [vx, vy] of bld.footprint) {
      const perp = (vx - centX) * perpX + (vy - centY) * perpY;
      if (perp < minPerp) minPerp = perp;
      if (perp > maxPerp) maxPerp = perp;
    }
    const projectedWidth = Math.max(0, maxPerp - minPerp);

    // Blockage contribution: height × projected width / (dist × searchRadius)
    // Dimensionless, normalised by search area cross-section
    const contribution =
      (bld.height * projectedWidth) / (dist * searchRadius * 2);
    totalBlockage += contribution;
    maxBlockage += bld.height / dist;
  }

  // Normalise blockage to [0, 1]
  if (maxBlockage === 0) return 0;
  return clamp(totalBlockage / (maxBlockage * 0.5 + 0.001));
}

// ---------------------------------------------------------------------------
// Street alignment bonus
// ---------------------------------------------------------------------------

/**
 * Compute a street-alignment factor in [0, 1].
 *
 * Wind penetration is enhanced when the wind direction aligns with the
 * dominant street orientation. We model this as |cos(Δangle)| where Δangle
 * is the difference between the wind bearing and the (assumed) primary street
 * grid bearing.
 *
 * For simplicity, we assume the dominant street orientation is either N-S (0°)
 * or E-W (90°), and pick the better alignment.
 *
 * @param windDirDeg  Prevailing wind direction in degrees from North
 */
export function streetAlignmentFactor(windDirDeg: number): number {
  const modWind = ((windDirDeg % 180) + 180) % 180; // fold to [0, 180)
  // N-S streets align best when wind is N or S (0° or 180°)
  const nsAlignment = Math.abs(Math.cos(toRad(modWind)));
  // E-W streets align best when wind is E or W (90°)
  const ewAlignment = Math.abs(Math.cos(toRad(modWind - 90)));
  return Math.max(nsAlignment, ewAlignment);
}

// ---------------------------------------------------------------------------
// Wind channel openness
// ---------------------------------------------------------------------------

/**
 * Compute the effective H/W ratio (height-to-width) for the urban canyon
 * at a given cell, which is the primary predictor in the Oke (1987) model.
 *
 * We approximate the canyon width as the mean gap between buildings in the
 * cross-wind direction within the search radius.
 */
export function canyonHWRatio(
  meanNeighbourHeight: number,
  streetWidth: number
): number {
  if (streetWidth <= 0) return 10; // heavily blocked
  return meanNeighbourHeight / streetWidth;
}

/**
 * Compute Wind Accessibility Proxy for a single cell.
 *
 * Formula (reduced-order urban canyon approximation):
 *   blockage = upstream_blockage_fraction ∈ [0, 1]
 *   openness  = 1 − blockage
 *   alignment = street_alignment_factor ∈ [0, 1]
 *   channel   = user-defined wind-channel openness scalar ∈ [0, 1]
 *   W = clamp( openness × (1 + 0.3 × alignment) / 1.3 × channel_weight )
 *
 * The canyon openness weight blends the geometric estimate with the user-
 * defined boundary-condition scalar to allow scenario overrides.
 *
 * @param cellX              Cell centre X (local metres)
 * @param cellY              Cell centre Y (local metres)
 * @param buildings          Buildings in local metres
 * @param windDirDeg         Prevailing wind direction (°N)
 * @param windChannelOpenness User BC scalar ∈ [0, 1]
 * @param cellSize           Grid cell size in metres
 */
export function computeWindAccessibility(
  cellX: number,
  cellY: number,
  buildings: { footprint: [number, number][]; height: number }[],
  windDirDeg: number,
  windChannelOpenness: number,
  cellSize: number
): number {
  const searchRadius = 5 * cellSize;

  const blockage = computeUpstreamBlockage(
    cellX,
    cellY,
    buildings,
    windDirDeg,
    searchRadius
  );
  const geometricOpenness = 1 - blockage;
  const alignment = streetAlignmentFactor(windDirDeg);

  // Blend geometric estimate with user BC channel openness (equal weight)
  const blendedOpenness =
    0.6 * geometricOpenness + 0.4 * windChannelOpenness;

  // Apply street alignment bonus (up to +30%)
  const withAlignment = blendedOpenness * (1 + 0.3 * alignment) / 1.3;

  return clamp(withAlignment);
}
