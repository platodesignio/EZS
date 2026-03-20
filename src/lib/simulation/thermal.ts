// =============================================================================
// Thermal Differential Proxy — Reduced-Order Approximation
//
// SCIENTIFIC DISCLAIMER: This module does not model heat transfer, urban heat
// island effects, or boundary-layer thermodynamics. It computes a relative
// thermal contrast proxy based on the spatial gradient of solar exposure and
// shading patterns across adjacent cells. Cells with stronger local contrast
// (e.g., adjacent sun-exposed and shaded zones) score higher than cells with
// uniform exposure, regardless of absolute temperature. This is consistent
// with the definition: Thermal Differential Proxy must favour cells with
// stronger local contrast rather than absolute temperature alone.
// =============================================================================

import type { SurfaceExposureClass } from "@/types/simulation";
import { sigmoid, stdDev, clamp } from "./normalize";

// ---------------------------------------------------------------------------
// Material/surface class albedo and emissivity adjustments
// ---------------------------------------------------------------------------

/** Effective thermal-contrast amplification factor by surface class */
const SURFACE_CLASS_FACTOR: Record<SurfaceExposureClass, number> = {
  standard: 1.0,
  high_albedo: 0.7,   // High albedo surfaces reduce absorbed heat → less contrast
  green_roof: 0.85,   // Evapotranspiration moderates contrast
  pv_panel: 1.2,      // Dark PV cells absorb strongly → higher thermal gradient
};

// ---------------------------------------------------------------------------
// Thermal Differential Proxy computation
// ---------------------------------------------------------------------------

/**
 * Compute the Thermal Differential Proxy for a single cell.
 *
 * Algorithm:
 * 1. Collect the solar exposure values of the cell and its immediate neighbours.
 * 2. Compute the population standard deviation of these values as a contrast term.
 * 3. Compute the absolute difference between cell exposure and neighbour mean
 *    as a shading gradient term.
 * 4. Combine via sigmoid to produce a contrast score in (0, 1).
 * 5. Apply surface-class amplification factor.
 * 6. Values are returned unnormalised for later global min-max normalisation.
 *
 * @param cellSolar         Solar exposure of this cell [0, 1]
 * @param neighbourSolars   Solar exposures of adjacent cells [0, 1] each
 * @param surfaceClass      Surface/material class for the scenario
 * @param thermalExposure   User BC thermal-exposure scalar [0, 1]
 */
export function computeThermalDifferential(
  cellSolar: number,
  neighbourSolars: number[],
  surfaceClass: SurfaceExposureClass,
  thermalExposure: number
): number {
  if (neighbourSolars.length === 0) {
    // Isolated cell: no contrast possible
    return 0;
  }

  const allValues = [cellSolar, ...neighbourSolars];
  const contrast = stdDev(allValues);

  const neighbourMean =
    neighbourSolars.reduce((a, b) => a + b, 0) / neighbourSolars.length;
  const shadingGradient = Math.abs(cellSolar - neighbourMean);

  // Combine: strong contrast AND strong local gradient → high thermal differential
  // The sigmoid is scaled so typical urban contrast values (~0.2–0.5) map
  // to the informative region of the sigmoid (input ~ ±2–4).
  const rawScore = sigmoid(5 * contrast + 3 * shadingGradient - 2);

  // Blend with user-defined BC thermal exposure (allows scenario override)
  const blended = 0.7 * rawScore + 0.3 * thermalExposure;

  // Apply surface class amplification
  const classFactor = SURFACE_CLASS_FACTOR[surfaceClass];

  return clamp(blended * classFactor);
}
