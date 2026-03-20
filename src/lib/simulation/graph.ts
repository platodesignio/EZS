// =============================================================================
// Graph-Based Metrics: Systemic Availability and Broadcast Reach Rate
//
// SCIENTIFIC DISCLAIMER: These metrics use a simplified grid-based graph
// representation of the district, not a full power-flow or circuit simulation.
// Systemic Availability represents relative reachability from a cell to
// storage/load nodes. Broadcast Reach Rate represents relative network
// propagation quality. Both are proxies in [0, 1].
// =============================================================================

import type { StorageNode } from "@/types/simulation";
import { clamp, dist2d } from "./normalize";

// ---------------------------------------------------------------------------
// Grid graph construction
// ---------------------------------------------------------------------------

/** Adjacency entry: [row, col, edge_weight] */
type GridEdge = [number, number, number];

/**
 * Build a 4-connected (cardinal directions only) adjacency list for the grid.
 * Building-interior cells are non-traversable and excluded.
 * Edge weight = 1 by default, increased by factor for high-building cells.
 */
export function buildGridAdjacency(
  numRows: number,
  numCols: number,
  isBuildingGrid: boolean[][]
): Map<string, GridEdge[]> {
  const adj = new Map<string, GridEdge[]>();

  const key = (r: number, c: number) => `${r}_${c}`;

  const directions: [number, number][] = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
  ];

  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      if (isBuildingGrid[r][c]) continue;
      const edges: GridEdge[] = [];
      for (const [dr, dc] of directions) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < numRows && nc >= 0 && nc < numCols) {
          if (!isBuildingGrid[nr][nc]) {
            edges.push([nr, nc, 1]);
          }
        }
      }
      adj.set(key(r, c), edges);
    }
  }

  return adj;
}

// ---------------------------------------------------------------------------
// BFS-based shortest-path distance from multiple source nodes
// ---------------------------------------------------------------------------

/**
 * Multi-source BFS to compute shortest-path distances from a set of
 * source (row, col) pairs to all reachable cells.
 *
 * Returns a 2-D array [row][col] = distance in hops, or Infinity if unreachable.
 */
export function multiSourceBFS(
  sources: [number, number][],
  numRows: number,
  numCols: number,
  isBuildingGrid: boolean[][]
): number[][] {
  // Initialise distances to Infinity
  const dist: number[][] = Array.from({ length: numRows }, () =>
    new Array(numCols).fill(Infinity)
  );

  const queue: [number, number][] = [];

  for (const [sr, sc] of sources) {
    if (sr >= 0 && sr < numRows && sc >= 0 && sc < numCols) {
      dist[sr][sc] = 0;
      queue.push([sr, sc]);
    }
  }

  const directions: [number, number][] = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
  ];

  let head = 0;
  while (head < queue.length) {
    const [r, c] = queue[head++];
    for (const [dr, dc] of directions) {
      const nr = r + dr;
      const nc = c + dc;
      if (
        nr >= 0 && nr < numRows &&
        nc >= 0 && nc < numCols &&
        !isBuildingGrid[nr][nc] &&
        dist[nr][nc] === Infinity
      ) {
        dist[nr][nc] = dist[r][c] + 1;
        queue.push([nr, nc]);
      }
    }
  }

  return dist;
}

// ---------------------------------------------------------------------------
// Storage node grid index mapping
// ---------------------------------------------------------------------------

/**
 * Convert storage node geographic coordinates to grid [row, col] indices.
 * Clamps to valid grid bounds.
 */
export function storageNodesToGridIndices(
  storageNodes: StorageNode[],
  originLng: number,
  originLat: number,
  cellSizeM: number,
  numRows: number,
  numCols: number,
  metresPerLng: number,
  metresPerLat: number
): [number, number][] {
  const result: [number, number][] = [];
  for (const node of storageNodes) {
    const localX = (node.lng - originLng) * metresPerLng;
    const localY = (node.lat - originLat) * metresPerLat;
    const col = Math.round(localX / cellSizeM);
    const row = Math.round(localY / cellSizeM);
    const clampedRow = Math.max(0, Math.min(numRows - 1, row));
    const clampedCol = Math.max(0, Math.min(numCols - 1, col));
    result.push([clampedRow, clampedCol]);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Systemic Availability
// ---------------------------------------------------------------------------

/**
 * Compute Systemic Availability for a single cell.
 *
 * SA = exp(−λ × d) where d is the shortest path (in hops) to the nearest
 * storage/load node, and λ = 0.1 is a decay constant.
 *
 * λ = 0.1 means SA ≈ 0.37 at d = 10 hops, ≈ 0.14 at d = 20 hops.
 * Disconnected cells (d = Infinity) receive SA = 0.
 *
 * The BC routing-accessibility scalar blends the geometric result with the
 * user-defined scenario value to allow interventions.
 */
export function computeSystemicAvailability(
  hopDistance: number,
  routingAccessibility: number,
  decayLambda = 0.1
): number {
  const geometric =
    hopDistance === Infinity ? 0 : Math.exp(-decayLambda * hopDistance);

  // Blend geometric with user BC scalar (60/40)
  return clamp(0.6 * geometric + 0.4 * routingAccessibility);
}

// ---------------------------------------------------------------------------
// Broadcast Reach Rate
// ---------------------------------------------------------------------------

/**
 * Compute Broadcast Reach Rate for a single cell.
 *
 * BRR reflects how well a cell can propagate energy-state changes to the
 * network. It increases with shorter routing distance, higher connectivity,
 * and more reachable storage endpoints.
 *
 * Formula:
 *   path_score    = exp(−0.05 × d)                          ∈ [0, 1]
 *   conn_score    = degree / 4 (cardinal neighbours)        ∈ [0, 1]
 *   endpoint_score = log(1 + reachableEndpoints)
 *                    / log(1 + totalStorageNodes)            ∈ [0, 1]
 *
 *   BRR = path_score × (0.5 + 0.3 × conn_score + 0.2 × endpoint_score)
 *
 * Normalised globally across all cells after computation.
 */
export function computeBroadcastReachRate(
  hopDistance: number,
  cardinalDegree: number,
  reachableEndpoints: number,
  totalStorageNodes: number
): number {
  const pathScore =
    hopDistance === Infinity ? 0 : Math.exp(-0.05 * hopDistance);

  const connScore = clamp(cardinalDegree / 4);

  const endpointScore =
    totalStorageNodes > 0
      ? Math.log(1 + reachableEndpoints) / Math.log(1 + totalStorageNodes)
      : 0;

  const raw = pathScore * (0.5 + 0.3 * connScore + 0.2 * endpointScore);
  return clamp(raw);
}
