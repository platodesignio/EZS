// =============================================================================
// Movement-Coupled Event Proxy — Reduced-Order Approximation
//
// SCIENTIFIC DISCLAIMER: This module does not run an agent-based pedestrian
// simulation, space-syntax analysis, or a full street-network centrality
// computation. It uses a simplified degree-centrality approximation over the
// traversable cell grid, combined with proximity-weighted attractor nodes, to
// produce a relative movement-potential proxy in [0, 1].
// =============================================================================

import type { AttractorNode } from "@/types/simulation";
import { clamp, dist2d } from "./normalize";

// ---------------------------------------------------------------------------
// Grid traversability
// ---------------------------------------------------------------------------

/**
 * Compute the traversable-neighbour degree of a cell in the grid.
 *
 * A cell is traversable if it is not fully interior to a building footprint.
 * The degree is the count of non-building adjacent cells (8-connected grid).
 * Normalised to [0, 1] by dividing by 8 (the maximum possible degree).
 */
export function computeGridDegreeCentrality(
  row: number,
  col: number,
  numRows: number,
  numCols: number,
  isBuildingGrid: boolean[][]
): number {
  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1],
  ];

  let degree = 0;
  for (const [dr, dc] of directions) {
    const r = row + dr;
    const c = col + dc;
    if (r >= 0 && r < numRows && c >= 0 && c < numCols) {
      if (!isBuildingGrid[r][c]) {
        degree++;
      }
    }
  }

  return degree / 8;
}

// ---------------------------------------------------------------------------
// Attractor proximity
// ---------------------------------------------------------------------------

/**
 * Compute the total attractor proximity score for a cell.
 *
 * Each attractor contributes weight / (1 + distance / referenceScale)
 * so that cells near high-weight attractors score highest.
 * The result is normalised to [0, 1] using an approximate theoretical maximum.
 *
 * @param cellX          Cell centre X (local metres)
 * @param cellY          Cell centre Y (local metres)
 * @param attractors     List of attractor nodes (in local metres)
 * @param referenceScale Reference scale for distance normalisation (metres)
 */
export function computeAttractorProximity(
  cellX: number,
  cellY: number,
  attractors: (AttractorNode & { localX: number; localY: number })[],
  referenceScale: number
): number {
  if (attractors.length === 0) return 0;

  let score = 0;
  let maxPossible = 0;

  for (const att of attractors) {
    const d = dist2d(cellX, cellY, att.localX, att.localY);
    const contribution = att.weight / (1 + d / referenceScale);
    score += contribution;
    maxPossible += att.weight; // achieved when d = 0
  }

  return maxPossible > 0 ? clamp(score / maxPossible) : 0;
}

// ---------------------------------------------------------------------------
// Movement-Coupled Event Proxy computation
// ---------------------------------------------------------------------------

/**
 * Compute Movement-Coupled Event Proxy for a single cell.
 *
 * Formula:
 *   centrality    = traversable-neighbour degree / 8       ∈ [0, 1]
 *   attractor     = weighted proximity to attractor nodes  ∈ [0, 1]
 *   movement_density = BC scalar                           ∈ [0, 1]
 *
 *   raw = 0.5 × centrality + 0.3 × attractor + 0.2 × movement_density
 *
 * The 0.5 / 0.3 / 0.2 decomposition places structural accessibility first,
 * attractor influence second, and user scenario density third. Results are
 * further globally normalised across all cells after computation.
 */
export function computeMovementCoupledEvent(
  degreeCentrality: number,
  attractorProximity: number,
  movementDensity: number
): number {
  const raw =
    0.5 * degreeCentrality +
    0.3 * attractorProximity +
    0.2 * movementDensity;
  return clamp(raw);
}
