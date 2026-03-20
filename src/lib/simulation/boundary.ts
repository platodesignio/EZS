// =============================================================================
// Boundary-Condition Update Vector
//
// Computes the 11-dimensional normalised change vector between a baseline and
// an intervention boundary configuration. The vector magnitude is used as the
// denominator in the Minimal Mode PPGR computation.
// =============================================================================

import type { BoundaryConditions, BcUpdateVector } from "@/types/simulation";
import { clamp } from "./normalize";

// ---------------------------------------------------------------------------
// Discrete class distance functions
// ---------------------------------------------------------------------------

type RoofClass = BoundaryConditions["roofOrientationClass"];
type SurfaceClass = BoundaryConditions["surfaceExposureClass"];
type SolarProfile = BoundaryConditions["solarConditionProfile"];

const ROOF_ORDER: RoofClass[] = ["flat", "pitched_ns", "pitched_ew", "mixed"];
const SURFACE_ORDER: SurfaceClass[] = [
  "standard",
  "high_albedo",
  "green_roof",
  "pv_panel",
];
const SOLAR_ORDER: SolarProfile[] = ["clear", "partly_cloudy", "overcast"];

/**
 * Ordinal distance between two discrete class values, normalised to [0, 1].
 */
function ordinalDist<T>(a: T, b: T, order: T[]): number {
  const ia = order.indexOf(a);
  const ib = order.indexOf(b);
  if (ia === -1 || ib === -1) return a === b ? 0 : 1;
  return Math.abs(ia - ib) / (order.length - 1);
}

/**
 * Jaccard distance between two sets of conversion layers.
 * Jaccard distance = 1 − |A ∩ B| / |A ∪ B|
 */
function jaccardDist(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const union = new Set([...setA, ...setB]);
  if (union.size === 0) return 0;
  let intersect = 0;
  for (const v of setA) {
    if (setB.has(v)) intersect++;
  }
  return 1 - intersect / union.size;
}

// ---------------------------------------------------------------------------
// BC Update Vector
// ---------------------------------------------------------------------------

/**
 * Compute the 11-dimensional normalised BC update vector between a baseline
 * and an intervention scenario boundary configuration.
 *
 * Each dimension is individually normalised to [0, 1] before combination.
 * The vector magnitude is ||v|| = sqrt(Σ v_i²) and is bounded to [0, sqrt(11)].
 *
 * Normalised magnitude = ||v|| / sqrt(11) ∈ [0, 1]
 */
export function computeBcUpdateVector(
  baseline: BoundaryConditions,
  intervention: BoundaryConditions
): { vector: BcUpdateVector; magnitude: number; normalizedMagnitude: number } {
  const vector: BcUpdateVector = {
    // Building height: range [0.5, 2.0] → normalise by 1.5
    buildingHeight: clamp(
      Math.abs(
        intervention.buildingHeightMultiplier -
          baseline.buildingHeightMultiplier
      ) / 1.5
    ),

    // Street canyon openness: already [0, 1]
    streetCanyonOpenness: clamp(
      Math.abs(
        intervention.streetCanyonOpenness - baseline.streetCanyonOpenness
      )
    ),

    // Roof orientation class: ordinal distance
    roofOrientationClass: ordinalDist(
      intervention.roofOrientationClass,
      baseline.roofOrientationClass,
      ROOF_ORDER
    ),

    // Surface exposure class: ordinal distance
    surfaceExposureClass: ordinalDist(
      intervention.surfaceExposureClass,
      baseline.surfaceExposureClass,
      SURFACE_ORDER
    ),

    // Wind channel openness: already [0, 1]
    windChannelOpenness: clamp(
      Math.abs(
        intervention.windChannelOpenness - baseline.windChannelOpenness
      )
    ),

    // Thermal exposure: already [0, 1]
    thermalExposure: clamp(
      Math.abs(intervention.thermalExposure - baseline.thermalExposure)
    ),

    // Movement density: already [0, 1]
    movementDensity: clamp(
      Math.abs(intervention.movementDensity - baseline.movementDensity)
    ),

    // Routing accessibility: already [0, 1]
    routingAccessibility: clamp(
      Math.abs(
        intervention.routingAccessibility - baseline.routingAccessibility
      )
    ),

    // Conversion surface assignment: Jaccard distance
    conversionSurfaceAssignment: jaccardDist(
      intervention.conversionSurfaceAssignment,
      baseline.conversionSurfaceAssignment
    ),

    // Wind direction: circular difference normalised to [0, 1] over 180°
    windDirection: clamp(
      circularAbsDiff(intervention.windDirection, baseline.windDirection) / 180
    ),

    // Solar condition profile: ordinal distance
    solarConditionProfile: ordinalDist(
      intervention.solarConditionProfile,
      baseline.solarConditionProfile,
      SOLAR_ORDER
    ),
  };

  const components = Object.values(vector) as number[];
  const sumOfSquares = components.reduce((acc, v) => acc + v * v, 0);
  const magnitude = Math.sqrt(sumOfSquares);
  const normalizedMagnitude = clamp(magnitude / Math.sqrt(11));

  return { vector, magnitude, normalizedMagnitude };
}

/**
 * Circular absolute difference between two angles in degrees.
 * Returns the minimum difference in [0, 180].
 */
function circularAbsDiff(a: number, b: number): number {
  let diff = Math.abs(((a - b + 540) % 360) - 180);
  return Math.min(diff, 180);
}

/**
 * Compute the Boundary-Condition Updating Rate (BCUR) for a cell.
 *
 * BCUR is the normalised magnitude of the BC update vector, representing
 * how rapidly boundary conditions are changing. It is uniform across all
 * cells in a given scenario step (it reflects scenario-level change, not
 * per-cell change).
 *
 * @param normalizedMagnitude  Normalised BC update magnitude ∈ [0, 1]
 */
export function computeBCUR(normalizedMagnitude: number): number {
  return clamp(normalizedMagnitude);
}
