// =============================================================================
// Generative Power Space Explorer — Core Simulation Engine
//
// This engine implements a REDUCED-ORDER URBAN MODEL. It is explicitly labelled
// as such and is not a full CFD solver, full radiative-transfer solver, or full
// urban microclimate simulator. All computations are deterministic given fixed
// inputs. The model is credible as a relative comparison tool for urban design
// scenarios but does not produce absolute physical quantities.
//
// The engine runs entirely server-side (Node.js) within a Next.js API route.
// =============================================================================

import type {
  BuildingFeature,
  SimCell,
  SimParams,
  BoundaryConditions,
  AttractorNode,
  StorageNode,
  SimulationResult,
  RunSummary,
  Hotspot,
  ConversionLayer,
  BcUpdateVector,
} from "@/types/simulation";

import {
  lngLatToLocalXY,
  localXYToLngLat,
  minMaxNormalize,
  clamp,
  sigmoid,
  stdDev,
  weightedMean,
  metresPerLngDeg,
  METRES_PER_LAT_DEG,
} from "./normalize";

import { generateDaySunPositions, computeSolarExposure } from "./solar";
import {
  computeWindAccessibility,
} from "./wind";
import { computeThermalDifferential } from "./thermal";
import {
  computeGridDegreeCentrality,
  computeAttractorProximity,
  computeMovementCoupledEvent,
} from "./movement";
import {
  multiSourceBFS,
  computeSystemicAvailability,
  computeBroadcastReachRate,
} from "./graph";
import {
  computeBcUpdateVector,
  computeBCUR,
} from "./boundary";
import { pointInPolygon } from "./solar";

// ---------------------------------------------------------------------------
// Grid generation
// ---------------------------------------------------------------------------

interface CellMeta {
  row: number;
  col: number;
  /** Centre in local metres */
  localX: number;
  localY: number;
  /** Centre in geographic coordinates */
  lng: number;
  lat: number;
  /** Geographic bounding box */
  bounds: [number, number, number, number];
  polygon: [number, number][];
}

/**
 * Generate the 2-D spatial cell grid over the district extent.
 *
 * The grid is axis-aligned in geographic space. Cell centres are placed at
 * half-cell offsets from the grid origin. The grid covers the full building-
 * footprint bounding box with a configurable padding.
 */
function generateGrid(
  buildings: BuildingFeature[],
  cellSizeM: number,
  originLng: number,
  originLat: number
): {
  cells: CellMeta[];
  numRows: number;
  numCols: number;
  gridWidthM: number;
  gridHeightM: number;
} {
  if (buildings.length === 0) {
    return { cells: [], numRows: 0, numCols: 0, gridWidthM: 0, gridHeightM: 0 };
  }

  const mPerLng = metresPerLngDeg(originLat);
  const mPerLat = METRES_PER_LAT_DEG;

  // Compute site extent in local metres
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const bld of buildings) {
    for (const [lng, lat] of bld.footprint) {
      const [x, y] = lngLatToLocalXY(lng, lat, originLng, originLat);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  // Add one-cell padding around the site
  const pad = cellSizeM;
  minX -= pad; minY -= pad; maxX += pad; maxY += pad;

  const numCols = Math.ceil((maxX - minX) / cellSizeM);
  const numRows = Math.ceil((maxY - minY) / cellSizeM);
  const gridWidthM = numCols * cellSizeM;
  const gridHeightM = numRows * cellSizeM;

  const cells: CellMeta[] = [];

  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      const localX = minX + (c + 0.5) * cellSizeM;
      const localY = minY + (r + 0.5) * cellSizeM;
      const [lng, lat] = localXYToLngLat(localX, localY, originLng, originLat);

      // Cell bounding box in geographic coordinates
      const [bMinLng, bMinLat] = localXYToLngLat(
        minX + c * cellSizeM,
        minY + r * cellSizeM,
        originLng,
        originLat
      );
      const [bMaxLng, bMaxLat] = localXYToLngLat(
        minX + (c + 1) * cellSizeM,
        minY + (r + 1) * cellSizeM,
        originLng,
        originLat
      );

      const polygon: [number, number][] = [
        [bMinLng, bMinLat],
        [bMaxLng, bMinLat],
        [bMaxLng, bMaxLat],
        [bMinLng, bMaxLat],
        [bMinLng, bMinLat],
      ];

      cells.push({
        row: r,
        col: c,
        localX,
        localY,
        lng,
        lat,
        bounds: [bMinLng, bMinLat, bMaxLng, bMaxLat],
        polygon,
      });
    }
  }

  return { cells, numRows, numCols, gridWidthM, gridHeightM };
}

// ---------------------------------------------------------------------------
// Building interior detection
// ---------------------------------------------------------------------------

/**
 * Mark cells that fall entirely inside a building footprint as non-traversable.
 * A cell is "interior" if its centre is inside any building polygon.
 */
function buildBuildingGrid(
  gridCells: CellMeta[],
  buildingsLocal: { footprint: [number, number][]; height: number }[],
  numRows: number,
  numCols: number
): {
  isBuildingGrid: boolean[][];
  buildingCountGrid: number[][];
  meanHeightGrid: number[][];
} {
  const isBuildingGrid: boolean[][] = Array.from({ length: numRows }, () =>
    new Array(numCols).fill(false)
  );
  const buildingCountGrid: number[][] = Array.from({ length: numRows }, () =>
    new Array(numCols).fill(0)
  );
  const heightSumGrid: number[][] = Array.from({ length: numRows }, () =>
    new Array(numCols).fill(0)
  );

  for (const cell of gridCells) {
    for (const bld of buildingsLocal) {
      if (pointInPolygon(cell.localX, cell.localY, bld.footprint)) {
        isBuildingGrid[cell.row][cell.col] = true;
        buildingCountGrid[cell.row][cell.col]++;
        heightSumGrid[cell.row][cell.col] += bld.height;
      }
    }
  }

  const meanHeightGrid: number[][] = Array.from({ length: numRows }, (_, r) =>
    Array.from({ length: numCols }, (__, c) =>
      buildingCountGrid[r][c] > 0
        ? heightSumGrid[r][c] / buildingCountGrid[r][c]
        : 0
    )
  );

  return { isBuildingGrid, buildingCountGrid, meanHeightGrid };
}

// ---------------------------------------------------------------------------
// Conversion Realizability
// ---------------------------------------------------------------------------

/**
 * Compute Conversion Realizability for a cell.
 *
 * CR = match quality between available source terms and installed conversion layers.
 *
 * Each layer type has a preferred source:
 *   photovoltaic   → solar (fit 0.90)
 *   piezoelectric  → movement (fit 0.75)
 *   thermoelectric → thermal (fit 0.80)
 *   hybrid         → mean of all sources (fit 0.85)
 *
 * CR = mean(layer_scores) or 0 if no layers are installed.
 */
function computeConversionRealizability(
  solar: number,
  wind: number,
  thermal: number,
  movement: number,
  layers: ConversionLayer[]
): number {
  if (layers.length === 0) return 0;

  let total = 0;
  for (const layer of layers) {
    switch (layer) {
      case "photovoltaic":
        total += solar * 0.9;
        break;
      case "piezoelectric":
        total += movement * 0.75;
        break;
      case "thermoelectric":
        total += thermal * 0.8;
        break;
      case "hybrid":
        total += weightedMean([solar, wind, thermal, movement], [1, 1, 1, 1]) * 0.85;
        break;
    }
  }

  return clamp(total / layers.length);
}

// ---------------------------------------------------------------------------
// Conversion-Coupling Efficiency
// ---------------------------------------------------------------------------

/**
 * Compute Conversion-Coupling Efficiency (CCE) for a cell.
 *
 * CCE measures the match quality between the dominant source composition and
 * the installed conversion layers. High CCE means the installed layers are
 * well-matched to what is actually available at this cell.
 *
 * Formula:
 *   dominant_source = argmax(solar, wind, thermal, movement)
 *   if optimal_layer_for_dominant_source is installed → CCE boost = 1.0
 *   else if hybrid is installed → CCE boost = 0.85
 *   else → CCE boost = 0.40 + 0.30 × (second-best layer match)
 *
 *   CCE = resource_flux × CCE_boost
 */
function computeCCE(
  solar: number,
  wind: number,
  thermal: number,
  movement: number,
  resourceFlux: number,
  layers: ConversionLayer[]
): number {
  if (layers.length === 0) return 0;

  const sources = { solar, wind, thermal, movement };
  const dominant = (Object.keys(sources) as (keyof typeof sources)[]).reduce(
    (a, b) => (sources[a] > sources[b] ? a : b)
  );

  const optimalLayerMap: Record<string, ConversionLayer> = {
    solar: "photovoltaic",
    movement: "piezoelectric",
    thermal: "thermoelectric",
    wind: "hybrid",
  };

  const optimalLayer = optimalLayerMap[dominant];
  const hasOptimal = layers.includes(optimalLayer);
  const hasHybrid = layers.includes("hybrid");

  let boost: number;
  if (hasOptimal) {
    boost = 1.0;
  } else if (hasHybrid) {
    boost = 0.85;
  } else {
    // partial match based on secondary sources
    const secondaryScore = layers.reduce((acc, l) => {
      if (l === "photovoltaic") return acc + solar * 0.9;
      if (l === "piezoelectric") return acc + movement * 0.75;
      if (l === "thermoelectric") return acc + thermal * 0.8;
      return acc;
    }, 0);
    boost = 0.40 + 0.30 * clamp(secondaryScore / layers.length);
  }

  return clamp(resourceFlux * boost);
}

// ---------------------------------------------------------------------------
// Reachable Energetic Difference
// ---------------------------------------------------------------------------

/**
 * Compute Reachable Energetic Difference (RED) for a cell.
 *
 * Formula:
 *   weighted_contrast = stdDev([solar, wind, thermal, movement]
 *                               weighted by source weights)
 *   accessibility = (wind_proxy + traversable_fraction + has_layer) / 3
 *   RED = sigmoid(8 × weighted_contrast × accessibility − 2)
 *
 * The sigmoid is offset by −2 so that cells with zero contrast remain near
 * zero, and those with high contrast and good accessibility approach 1.
 */
function computeRED(
  solar: number,
  wind: number,
  thermal: number,
  movement: number,
  windAccessibility: number,
  traversableFraction: number,
  hasConversionLayers: boolean
): number {
  const contrast = stdDev([solar, wind, thermal, movement]);
  const hasLayer = hasConversionLayers ? 1.0 : 0.5;
  const accessibility =
    (windAccessibility + traversableFraction + hasLayer) / 3;

  return clamp(sigmoid(8 * contrast * accessibility - 2));
}

// ---------------------------------------------------------------------------
// Information Generation Rate
// ---------------------------------------------------------------------------

/**
 * Determine whether a cell is in a new distinguishable power-possible state
 * relative to the baseline.
 *
 * A cell enters a new state when the updated value crosses a threshold in at
 * least one of these layers:
 *   - Reachable Energetic Difference (RED)
 *   - Conversion Realizability (CR)
 *   - Systemic Availability (SA)
 *   - Broadcast Reach Rate (BRR) — treated as temporal operability proxy
 *
 * @param threshold  Minimum absolute change to qualify as a new state (default 0.1)
 */
function isNewDistinguishableState(
  cell: {
    reachableEnergeticDifference: number;
    conversionRealizability: number;
    systemicAvailability: number;
    broadcastReachRate: number;
  },
  baseline: {
    reachableEnergeticDifference: number;
    conversionRealizability: number;
    systemicAvailability: number;
    broadcastReachRate: number;
  } | null,
  threshold: number
): boolean {
  if (!baseline) return false;
  return (
    Math.abs(cell.reachableEnergeticDifference - baseline.reachableEnergeticDifference) > threshold ||
    Math.abs(cell.conversionRealizability - baseline.conversionRealizability) > threshold ||
    Math.abs(cell.systemicAvailability - baseline.systemicAvailability) > threshold ||
    Math.abs(cell.broadcastReachRate - baseline.broadcastReachRate) > threshold
  );
}

/**
 * Compute IGR across all cells.
 *
 * IGR_global = alpha × (new_states / total) + beta × (new_transitions / total_possible)
 *
 * where total_possible transitions = number of adjacent traversable cell pairs.
 * IGR is then broadcast to per-cell values (uniform per scenario step,
 * consistent with definition: rate of emergence of new states per unit time).
 */
function computeIGR(
  cells: (SimCell & { baselineRed?: number; baselineCr?: number; baselineSa?: number; baselineBrr?: number })[],
  alpha: number,
  beta: number,
  threshold: number
): number {
  const total = cells.length;
  if (total === 0) return 0;

  let newStates = 0;
  let newTransitions = 0;
  let totalPossibleTransitions = 0;

  const stateMap = new Map<string, boolean>();
  for (const cell of cells) {
    const isNew = cell.isNewState;
    if (isNew) newStates++;
    stateMap.set(cell.id, isNew);
  }

  // Count adjacent pairs where at least one cell changed state (new transition)
  const cellMap = new Map<string, boolean>();
  for (const cell of cells) {
    cellMap.set(cell.id, cell.isNewState);
  }

  const checked = new Set<string>();
  for (const cell of cells) {
    const neighbours = [
      `r${cell.row - 1}_c${cell.col}`,
      `r${cell.row + 1}_c${cell.col}`,
      `r${cell.row}_c${cell.col - 1}`,
      `r${cell.row}_c${cell.col + 1}`,
    ];
    for (const nId of neighbours) {
      if (cellMap.has(nId)) {
        const pairKey = [cell.id, nId].sort().join("|");
        if (!checked.has(pairKey)) {
          checked.add(pairKey);
          totalPossibleTransitions++;
          const aNew = stateMap.get(cell.id) ?? false;
          const bNew = stateMap.get(nId) ?? false;
          if (aNew || bNew) newTransitions++;
        }
      }
    }
  }

  const newStateRate = newStates / total;
  const newTransitionRate =
    totalPossibleTransitions > 0
      ? newTransitions / totalPossibleTransitions
      : 0;

  return clamp(alpha * newStateRate + beta * newTransitionRate);
}

// ---------------------------------------------------------------------------
// PPGR Minimal Mode
// ---------------------------------------------------------------------------

/**
 * Compute the Per-Cell PPGR in Minimal Mode.
 *
 * PPGR_min = |PP_intervention − PP_baseline| / |ΔBC_vector|
 *
 * If bcUpdateMagnitude = 0 (no boundary change), returns 0.
 * Normalised globally after computation.
 */
function computePPGRMinimal(
  ppIntervention: number,
  ppBaseline: number | null,
  bcUpdateMagnitude: number
): number {
  if (ppBaseline === null) return 0; // this is the baseline run
  if (bcUpdateMagnitude <= 0) return 0;
  return Math.abs(ppIntervention - ppBaseline) / bcUpdateMagnitude;
}

// ---------------------------------------------------------------------------
// Main engine entry point
// ---------------------------------------------------------------------------

export interface EngineInput {
  scenarioId: string;
  buildings: BuildingFeature[];
  envParams: {
    latitude: number;
    longitude: number;
    windDirection: number;
  };
  simParams: SimParams;
  boundaryConditions: BoundaryConditions;
  attractorNodes: AttractorNode[];
  storageNodes: StorageNode[];
  baselineCells: SimCell[] | null;
  baselineBcUpdate: { vector: BcUpdateVector; magnitude: number; normalizedMagnitude: number } | null;
  baselineBoundaryConditions: BoundaryConditions | null;
}

export async function runSimulation(input: EngineInput): Promise<SimulationResult> {
  const startMs = Date.now();

  const {
    scenarioId,
    buildings,
    envParams,
    simParams,
    boundaryConditions,
    attractorNodes,
    storageNodes,
    baselineCells,
    baselineBoundaryConditions,
  } = input;

  const originLng = envParams.longitude;
  const originLat = envParams.latitude;

  // ---- Compute BC update vector ----
  let bcUpdateVector: BcUpdateVector | null = null;
  let bcUpdateMagnitude = 0;
  let normalizedBcMagnitude = 0;
  let bcur = 0;

  if (baselineBoundaryConditions) {
    const bcResult = computeBcUpdateVector(
      baselineBoundaryConditions,
      boundaryConditions
    );
    bcUpdateVector = bcResult.vector;
    bcUpdateMagnitude = bcResult.magnitude;
    normalizedBcMagnitude = bcResult.normalizedMagnitude;
    bcur = computeBCUR(normalizedBcMagnitude);
  }

  // ---- Convert buildings to local metric coordinates ----
  const mPerLng = metresPerLngDeg(originLat);
  const mPerLat = METRES_PER_LAT_DEG;

  const buildingsLocal = buildings.map((bld) => ({
    id: bld.id,
    height: bld.height * boundaryConditions.buildingHeightMultiplier,
    footprint: bld.footprint.map(([lng, lat]) => {
      const x = (lng - originLng) * mPerLng;
      const y = (lat - originLat) * mPerLat;
      return [x, y] as [number, number];
    }),
  }));

  // ---- Generate cell grid ----
  const { cells: gridCells, numRows, numCols } = generateGrid(
    buildings,
    simParams.cellSize,
    originLng,
    originLat
  );

  if (gridCells.length === 0) {
    throw new Error("No cells generated — check building geometry.");
  }

  // ---- Building interior detection ----
  const { isBuildingGrid, buildingCountGrid, meanHeightGrid } =
    buildBuildingGrid(gridCells, buildingsLocal, numRows, numCols);

  // ---- Generate sun positions ----
  const sunPositions = generateDaySunPositions(
    envParams.latitude,
    simParams.dayOfYear
  );

  // ---- Build attractor nodes in local coordinates ----
  const attractorsLocal = attractorNodes.map((att) => ({
    ...att,
    localX: (att.lng - originLng) * mPerLng,
    localY: (att.lat - originLat) * mPerLat,
  }));

  // ---- Convert storage nodes to grid indices for BFS ----
  const storageIndices: [number, number][] = storageNodes.map((n) => {
    const localX = (n.lng - originLng) * mPerLng;
    const localY = (n.lat - originLat) * mPerLat;
    const col = Math.round(localX / simParams.cellSize);
    const row = Math.round(localY / simParams.cellSize);
    return [
      Math.max(0, Math.min(numRows - 1, row)),
      Math.max(0, Math.min(numCols - 1, col)),
    ];
  });

  // Default storage nodes: corners of the grid if none supplied
  const effectiveStorageIndices =
    storageIndices.length > 0
      ? storageIndices
      : ([
          [0, 0],
          [0, numCols - 1],
          [numRows - 1, 0],
          [numRows - 1, numCols - 1],
        ] as [number, number][]);

  // ---- Multi-source BFS from storage nodes ----
  const hopDistances = multiSourceBFS(
    effectiveStorageIndices,
    numRows,
    numCols,
    isBuildingGrid
  );

  // ---- Build baseline cell lookup ----
  const baselineCellMap = new Map<string, SimCell>();
  if (baselineCells) {
    for (const bc of baselineCells) {
      baselineCellMap.set(bc.id, bc);
    }
  }

  // ---- Per-cell computation ----
  const partialCells: SimCell[] = [];

  for (const meta of gridCells) {
    const { row, col, localX, localY, lng, lat, bounds, polygon } = meta;
    const isBuilding = isBuildingGrid[row][col];
    const cellId = `r${row}_c${col}`;

    // Determine conversion layers for this cell from BC assignment
    const conversionLayers: ConversionLayer[] =
      boundaryConditions.conversionSurfaceAssignment;

    // --- Solar Exposure Proxy ---
    const solarExposure = computeSolarExposure(
      localX,
      localY,
      buildingsLocal,
      sunPositions,
      boundaryConditions.solarConditionProfile
    );

    // --- Wind Accessibility Proxy ---
    const windAccessibility = computeWindAccessibility(
      localX,
      localY,
      buildingsLocal,
      boundaryConditions.windDirection,
      boundaryConditions.windChannelOpenness,
      simParams.cellSize
    );

    // --- Thermal Differential Proxy (requires neighbour solar, computed as placeholder first) ---
    // Populated below after all solar values are known
    const windA = windAccessibility;

    // --- Movement-Coupled Event Proxy ---
    const degreeCentrality = computeGridDegreeCentrality(
      row,
      col,
      numRows,
      numCols,
      isBuildingGrid
    );
    const attractorProximity = computeAttractorProximity(
      localX,
      localY,
      attractorsLocal,
      200 // 200m reference scale
    );
    const movementCoupledEvent = computeMovementCoupledEvent(
      degreeCentrality,
      attractorProximity,
      boundaryConditions.movementDensity
    );

    // --- Resource Flux (partial, thermal added after) ---
    const { weights } = simParams;

    // --- Graph metrics ---
    const hopDist = hopDistances[row][col];

    // Cardinal degree for BRR
    const cardinalDegree = [
      [-1, 0], [1, 0], [0, -1], [0, 1],
    ].filter(([dr, dc]) => {
      const nr = row + dr;
      const nc = col + dc;
      return (
        nr >= 0 && nr < numRows &&
        nc >= 0 && nc < numCols &&
        !isBuildingGrid[nr][nc]
      );
    }).length;

    // Count reachable storage nodes (within 20 hops)
    const maxHopsForReach = 20;
    const reachableEndpoints = effectiveStorageIndices.filter(
      ([sr, sc]) => {
        const d = hopDistances[sr] !== undefined ? hopDistances[sr][sc] : Infinity;
        return d !== undefined && d !== Infinity && hopDist !== Infinity && hopDist + d <= maxHopsForReach * 2;
      }
    ).length;

    partialCells.push({
      id: cellId,
      row,
      col,
      lng,
      lat,
      bounds,
      polygon,
      solarExposure,
      windAccessibility,
      thermalDifferential: 0, // filled in pass 2
      movementCoupledEvent,
      resourceFlux: 0,        // filled in pass 2
      reachableEnergeticDifference: 0,
      conversionRealizability: 0,
      systemicAvailability: 0,
      boundaryConditionUpdatingRate: bcur,
      informationGenerationRate: 0,
      conversionCouplingEfficiency: 0,
      broadcastReachRate: 0,
      powerPotential: 0,
      ppgrMinimal: 0,
      ppgrCoupled: 0,
      conversionLayers,
      buildingCount: buildingCountGrid[row][col],
      meanBuildingHeight: meanHeightGrid[row][col],
      isBuilding,
      isNewState: false,
      // Store intermediate values for pass 2
      _hopDist: hopDist,
      _cardinalDegree: cardinalDegree,
      _reachableEndpoints: reachableEndpoints,
    } as SimCell & { _hopDist: number; _cardinalDegree: number; _reachableEndpoints: number });
  }

  // ---- Pass 2: Thermal Differential (needs neighbour solar values) ----
  const cellByPos = new Map<string, SimCell & { _hopDist: number; _cardinalDegree: number; _reachableEndpoints: number }>();
  for (const c of partialCells as (SimCell & { _hopDist: number; _cardinalDegree: number; _reachableEndpoints: number })[]) {
    cellByPos.set(c.id, c);
  }

  for (const cell of partialCells as (SimCell & { _hopDist: number; _cardinalDegree: number; _reachableEndpoints: number })[]) {
    const neighbourSolars: number[] = [];
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]) {
      const nId = `r${cell.row + dr}_c${cell.col + dc}`;
      const n = cellByPos.get(nId);
      if (n) neighbourSolars.push(n.solarExposure);
    }

    cell.thermalDifferential = computeThermalDifferential(
      cell.solarExposure,
      neighbourSolars,
      boundaryConditions.surfaceExposureClass,
      boundaryConditions.thermalExposure
    );
  }

  // ---- Pass 3: Normalise thermal, then compute all derived metrics ----

  // Normalise thermal differentials globally
  const thermalRaw = partialCells.map((c) => c.thermalDifferential);
  const thermalNorm = minMaxNormalize(thermalRaw);
  for (let i = 0; i < partialCells.length; i++) {
    partialCells[i].thermalDifferential = thermalNorm[i];
  }

  // Compute resource flux, RED, CR, SA, BRR, CCE, PP for each cell
  const extCells = partialCells as (SimCell & { _hopDist: number; _cardinalDegree: number; _reachableEndpoints: number })[];

  for (let i = 0; i < extCells.length; i++) {
    const cell = extCells[i];
    const { solar, wind, thermal, movement } = simParams.weights;

    cell.resourceFlux = clamp(
      solar * cell.solarExposure +
        wind * cell.windAccessibility +
        thermal * cell.thermalDifferential +
        movement * cell.movementCoupledEvent
    );

    cell.conversionRealizability = computeConversionRealizability(
      cell.solarExposure,
      cell.windAccessibility,
      cell.thermalDifferential,
      cell.movementCoupledEvent,
      cell.conversionLayers
    );

    const traversableFraction = cell.isBuilding ? 0 : 1;
    cell.reachableEnergeticDifference = computeRED(
      cell.solarExposure,
      cell.windAccessibility,
      cell.thermalDifferential,
      cell.movementCoupledEvent,
      cell.windAccessibility,
      traversableFraction,
      cell.conversionLayers.length > 0
    );

    cell.systemicAvailability = computeSystemicAvailability(
      cell._hopDist,
      boundaryConditions.routingAccessibility
    );

    cell.broadcastReachRate = computeBroadcastReachRate(
      cell._hopDist,
      cell._cardinalDegree,
      cell._reachableEndpoints,
      effectiveStorageIndices.length
    );

    cell.conversionCouplingEfficiency = computeCCE(
      cell.solarExposure,
      cell.windAccessibility,
      cell.thermalDifferential,
      cell.movementCoupledEvent,
      cell.resourceFlux,
      cell.conversionLayers
    );

    cell.powerPotential = clamp(
      cell.resourceFlux *
        cell.reachableEnergeticDifference *
        cell.conversionRealizability *
        cell.systemicAvailability
    );

    // Mark new distinguishable states vs. baseline
    const basCell = baselineCellMap.get(cell.id) ?? null;
    cell.isNewState = isNewDistinguishableState(
      cell,
      basCell,
      simParams.stateThreshold
    );
  }

  // ---- IGR computation (requires isNewState to be set for all cells) ----
  const igrGlobal = computeIGR(
    partialCells as SimCell[],
    simParams.igrAlpha,
    simParams.igrBeta,
    simParams.stateThreshold
  );

  // ---- Assign IGR and compute PPGR ----
  const ppgrMinRaw: number[] = [];
  const ppgrCoupledRaw: number[] = [];

  for (const cell of extCells) {
    cell.informationGenerationRate = igrGlobal; // uniform per scenario step

    // PPGR Minimal
    const basCell = baselineCellMap.get(cell.id);
    const basePP = basCell?.powerPotential ?? null;
    const ppgrMin = computePPGRMinimal(
      cell.powerPotential,
      basePP,
      normalizedBcMagnitude
    );
    ppgrMinRaw.push(ppgrMin);

    // PPGR Coupled: BCUR × IGR × CCE × BRR
    const ppgrCoupled = clamp(
      bcur *
        igrGlobal *
        cell.conversionCouplingEfficiency *
        cell.broadcastReachRate
    );
    ppgrCoupledRaw.push(ppgrCoupled);
  }

  // Normalise PPGR Minimal to [0,1]
  const ppgrMinNorm = minMaxNormalize(ppgrMinRaw);
  const ppgrCoupledNorm = minMaxNormalize(ppgrCoupledRaw);

  for (let i = 0; i < extCells.length; i++) {
    extCells[i].ppgrMinimal = ppgrMinNorm[i];
    extCells[i].ppgrCoupled = ppgrCoupledNorm[i];
  }

  // ---- Clean up internal fields ----
  const finalCells: SimCell[] = extCells.map((c) => {
    const { _hopDist, _cardinalDegree, _reachableEndpoints, ...clean } = c as unknown as Record<string, unknown>;
    return clean as unknown as SimCell;
  });

  // ---- Hotspot ranking ----
  const hotspotCount = Math.min(10, finalCells.length);

  const hotspotsMinimal: Hotspot[] = [...finalCells]
    .filter((c) => !c.isBuilding)
    .sort((a, b) => b.ppgrMinimal - a.ppgrMinimal)
    .slice(0, hotspotCount)
    .map((c, i) => ({
      cellId: c.id,
      rank: i + 1,
      ppgr: c.ppgrMinimal,
      powerPotential: c.powerPotential,
      lng: c.lng,
      lat: c.lat,
    }));

  const hotspotsCoupled: Hotspot[] = [...finalCells]
    .filter((c) => !c.isBuilding)
    .sort((a, b) => b.ppgrCoupled - a.ppgrCoupled)
    .slice(0, hotspotCount)
    .map((c, i) => ({
      cellId: c.id,
      rank: i + 1,
      ppgr: c.ppgrCoupled,
      powerPotential: c.powerPotential,
      lng: c.lng,
      lat: c.lat,
    }));

  // ---- Summary statistics ----
  const activeCells = finalCells.filter((c) => !c.isBuilding);
  const mean = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const max = (arr: number[]) =>
    arr.length ? Math.max(...arr) : 0;
  const min = (arr: number[]) =>
    arr.length ? Math.min(...arr) : 0;

  const summary: RunSummary = {
    totalCells: finalCells.length,
    activeCells: activeCells.length,
    meanPowerPotential: mean(activeCells.map((c) => c.powerPotential)),
    maxPowerPotential: max(activeCells.map((c) => c.powerPotential)),
    minPowerPotential: min(activeCells.map((c) => c.powerPotential)),
    meanPPGRMinimal: mean(activeCells.map((c) => c.ppgrMinimal)),
    maxPPGRMinimal: max(activeCells.map((c) => c.ppgrMinimal)),
    meanPPGRCoupled: mean(activeCells.map((c) => c.ppgrCoupled)),
    maxPPGRCoupled: max(activeCells.map((c) => c.ppgrCoupled)),
    meanResourceFlux: mean(activeCells.map((c) => c.resourceFlux)),
    newStateCount: finalCells.filter((c) => c.isNewState).length,
    hotspotsMinimal,
    hotspotsCoupled,
  };

  // ---- Generate public run ID ----
  const runId = `RUN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  return {
    runId,
    scenarioId,
    cells: finalCells,
    summary,
    bcUpdateVector,
    bcUpdateMagnitude: normalizedBcMagnitude,
    durationMs: Date.now() - startMs,
  };
}
