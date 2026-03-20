// =============================================================================
// GENERATIVE POWER SPACE EXPLORER — Core Simulation Types
//
// Invariant conceptual definitions (must not be paraphrased or altered):
//
// Power Potential: the degree to which a space under a given boundary
//   configuration can organize physical asymmetries into reachable energetic
//   difference that can be converted into electrical form and made systemically
//   available.
//
// Boundary Conditions: the dynamically updateable spatiotemporal, material,
//   behavioral, and control constraints that determine how physical resource
//   flux becomes reachable energetic difference and whether that difference
//   can be converted and propagated into usable electrical availability.
//
// Information Generation Rate: the rate at which a spatial system opens new
//   distinguishable power-possible states per unit time under
//   boundary-condition updating.
//
// Power-Potential Gradient Rate: the rate at which power potential changes in
//   response to change in boundary conditions.
// =============================================================================

// ---------------------------------------------------------------------------
// Geometry and input types
// ---------------------------------------------------------------------------

/** A single building footprint with an extruded height. */
export interface BuildingFeature {
  /** Unique building identifier from source data or auto-generated */
  id: string;
  /** Polygon ring as [longitude, latitude] pairs (closed — first = last) */
  footprint: [number, number][];
  /** Building height in metres */
  height: number;
  /** Optional material class affecting thermal properties */
  materialClass?: "concrete" | "glass" | "brick" | "mixed";
}

/** Solar condition affecting the representative-day energy profile */
export type SolarConditionProfile = "clear" | "partly_cloudy" | "overcast";

/** Roof orientation class determining facade/roof exposure contribution */
export type RoofOrientationClass = "flat" | "pitched_ns" | "pitched_ew" | "mixed";

/** Surface exposure class affecting albedo and thermal absorption */
export type SurfaceExposureClass =
  | "standard"
  | "high_albedo"
  | "green_roof"
  | "pv_panel";

/** Abstract conversion surface types installable on a cell */
export type ConversionLayer =
  | "photovoltaic"
  | "piezoelectric"
  | "thermoelectric"
  | "hybrid";

// ---------------------------------------------------------------------------
// Boundary Conditions
// Represents the full BC vector for a scenario. Each field corresponds to one
// dimension of the 11-dimensional BC update vector used in PPGR computation.
// ---------------------------------------------------------------------------

export interface BoundaryConditions {
  /** Height multiplier applied to all buildings (0.5–2.0, baseline = 1.0) */
  buildingHeightMultiplier: number;
  /** Fraction of street corridor openness (0–1, baseline = 0.5) */
  streetCanyonOpenness: number;
  /** Dominant roof geometry class for the scenario */
  roofOrientationClass: RoofOrientationClass;
  /** Surface treatment class for the scenario */
  surfaceExposureClass: SurfaceExposureClass;
  /** Wind channel openness scalar (0–1, baseline = 0.5) */
  windChannelOpenness: number;
  /** Thermal exposure scalar (0–1, baseline = 0.5) */
  thermalExposure: number;
  /** Movement density scalar (0–1, baseline = 0.5) */
  movementDensity: number;
  /** Routing and storage accessibility scalar (0–1, baseline = 0.5) */
  routingAccessibility: number;
  /** Conversion surface types available for assignment in this scenario */
  conversionSurfaceAssignment: ConversionLayer[];
  /** Prevailing wind direction in degrees from North (0–360) */
  windDirection: number;
  /** Solar condition profile for the representative day */
  solarConditionProfile: SolarConditionProfile;
}

/** Default boundary conditions for the baseline scenario */
export const DEFAULT_BOUNDARY_CONDITIONS: BoundaryConditions = {
  buildingHeightMultiplier: 1.0,
  streetCanyonOpenness: 0.5,
  roofOrientationClass: "flat",
  surfaceExposureClass: "standard",
  windChannelOpenness: 0.5,
  thermalExposure: 0.5,
  movementDensity: 0.5,
  routingAccessibility: 0.5,
  conversionSurfaceAssignment: ["photovoltaic", "thermoelectric"],
  windDirection: 225,
  solarConditionProfile: "clear",
};

// ---------------------------------------------------------------------------
// Simulation Parameters
// ---------------------------------------------------------------------------

export interface SourceWeights {
  /** Weight of solar exposure in Resource Flux (default 0.40) */
  solar: number;
  /** Weight of wind accessibility in Resource Flux (default 0.20) */
  wind: number;
  /** Weight of thermal differential in Resource Flux (default 0.20) */
  thermal: number;
  /** Weight of movement-coupled events in Resource Flux (default 0.20) */
  movement: number;
}

export const DEFAULT_SOURCE_WEIGHTS: SourceWeights = {
  solar: 0.4,
  wind: 0.2,
  thermal: 0.2,
  movement: 0.2,
};

/** A sampled sun position for the solar exposure proxy */
export interface SunPosition {
  /** Solar hour (0–23) */
  hour: number;
  /** Solar elevation angle in degrees (0–90) */
  elevation: number;
  /** Solar azimuth in degrees from North (0–360) */
  azimuth: number;
}

export interface SimParams {
  /** Grid cell side length in metres (10–50, default 20) */
  cellSize: number;
  /** Source-term weights for Resource Flux */
  weights: SourceWeights;
  /** Representative day-of-year (1–365, default 172 = June 21) */
  dayOfYear: number;
  /** Site latitude for solar position computation (degrees) */
  latitude: number;
  /** IGR weighting: alpha for new-state rate (default 0.7) */
  igrAlpha: number;
  /** IGR weighting: beta for new-transition diversity rate (default 0.3) */
  igrBeta: number;
  /** Threshold for distinguishable-state detection (default 0.1) */
  stateThreshold: number;
}

export const DEFAULT_SIM_PARAMS: SimParams = {
  cellSize: 20,
  weights: DEFAULT_SOURCE_WEIGHTS,
  dayOfYear: 172,
  latitude: 40.7,
  igrAlpha: 0.7,
  igrBeta: 0.3,
  stateThreshold: 0.1,
};

// ---------------------------------------------------------------------------
// Environmental parameters
// ---------------------------------------------------------------------------

export interface EnvParams {
  /** Site latitude in decimal degrees */
  latitude: number;
  /** Site longitude in decimal degrees */
  longitude: number;
  /** Prevailing wind speed in m/s (informational; affects blockage weight) */
  windSpeed: number;
  /** Prevailing wind direction in degrees from North */
  windDirection: number;
  /** Ambient air temperature in °C (informational) */
  ambientTempC: number;
}

export const DEFAULT_ENV_PARAMS: EnvParams = {
  latitude: 35.68,
  longitude: 139.69,
  windSpeed: 3.5,
  windDirection: 225,
  ambientTempC: 15,
};

// ---------------------------------------------------------------------------
// Attractor and storage nodes
// ---------------------------------------------------------------------------

/** A movement attractor node (transit stop, commercial hub, etc.) */
export interface AttractorNode {
  id: string;
  /** Longitude of attractor */
  lng: number;
  /** Latitude of attractor */
  lat: number;
  /** Relative weight (0–1) */
  weight: number;
  label?: string;
}

/** A storage or load node in the electrical network graph */
export interface StorageNode {
  id: string;
  lng: number;
  lat: number;
  label?: string;
}

// ---------------------------------------------------------------------------
// Per-cell simulation result
// A spatial cell is the minimum spatiotemporal operational unit within which
// boundary conditions, resource flux, reachable energetic difference,
// conversion-coupling status, and local propagation state can be jointly
// measured and compared.
// ---------------------------------------------------------------------------

export interface SimCell {
  /** Unique cell identifier: "r{row}_c{col}" */
  id: string;
  /** Row index in the district grid */
  row: number;
  /** Column index in the district grid */
  col: number;
  /** Cell centre longitude (geographic) */
  lng: number;
  /** Cell centre latitude (geographic) */
  lat: number;
  /** Cell bounding box [minLng, minLat, maxLng, maxLat] */
  bounds: [number, number, number, number];
  /** Cell corner polygon for rendering: [[lng,lat], ...] */
  polygon: [number, number][];

  // --- Source-term proxies (0–1, reduced-order approximations) ---

  /** Solar Exposure Proxy: visible-sky-weighted incident exposure */
  solarExposure: number;
  /** Wind Accessibility Proxy: urban-canyon reduced-order estimate */
  windAccessibility: number;
  /** Thermal Differential Proxy: local contrast, not absolute temperature */
  thermalDifferential: number;
  /** Movement-Coupled Event Proxy: centrality + attractor proximity */
  movementCoupledEvent: number;

  // --- Resource Flux (0–1) ---
  /** Weighted composite of the four source-term proxies */
  resourceFlux: number;

  // --- Power Potential components (0–1) ---

  /** Reachable Energetic Difference: thresholded asymmetry × accessibility */
  reachableEnergeticDifference: number;
  /** Conversion Realizability: installed layer × source-type fit */
  conversionRealizability: number;
  /** Systemic Availability: graph-based reachability to storage/load nodes */
  systemicAvailability: number;

  // --- Boundary-condition dynamics (0–1) ---

  /** Boundary-Condition Updating Rate: normalized BC change magnitude */
  boundaryConditionUpdatingRate: number;
  /** Information Generation Rate: rate of new distinguishable-state emergence */
  informationGenerationRate: number;
  /** Conversion-Coupling Efficiency: source–layer match quality */
  conversionCouplingEfficiency: number;
  /** Broadcast Reach Rate: propagation quality to storage/load endpoints */
  broadcastReachRate: number;

  // --- Power Potential outputs ---

  /**
   * Power Potential (Minimal Mode):
   * PP = Resource Flux × Reachable Energetic Difference
   *       × Conversion Realizability × Systemic Availability
   */
  powerPotential: number;

  /**
   * Power-Potential Gradient Rate (Minimal Mode):
   * PPGR_min = ΔPP / |ΔBC_vector|
   * Zero for baseline runs.
   */
  ppgrMinimal: number;

  /**
   * Power-Potential Gradient Rate (Coupled Mode):
   * PPGR_coupled = BC_Updating_Rate × IGR × CCE × Broadcast_Reach_Rate
   */
  ppgrCoupled: number;

  // --- Supporting metadata ---

  /** Conversion layers installed on this cell */
  conversionLayers: ConversionLayer[];
  /** Number of buildings overlapping this cell */
  buildingCount: number;
  /** Area-weighted mean building height of overlapping buildings */
  meanBuildingHeight: number;
  /** Whether this cell is interior to a building footprint (non-traversable) */
  isBuilding: boolean;

  // --- Distinguishable state marker ---

  /** True if this cell has entered a new distinguishable state vs. baseline */
  isNewState: boolean;
}

// ---------------------------------------------------------------------------
// Simulation run result
// ---------------------------------------------------------------------------

export interface RunSummary {
  totalCells: number;
  activeCells: number;
  meanPowerPotential: number;
  maxPowerPotential: number;
  minPowerPotential: number;
  meanPPGRMinimal: number;
  maxPPGRMinimal: number;
  meanPPGRCoupled: number;
  maxPPGRCoupled: number;
  meanResourceFlux: number;
  newStateCount: number;
  /** Top N hotspot cells by PPGR (Minimal Mode) */
  hotspotsMinimal: Hotspot[];
  /** Top N hotspot cells by PPGR (Coupled Mode) */
  hotspotsCoupled: Hotspot[];
}

export interface Hotspot {
  cellId: string;
  rank: number;
  ppgr: number;
  powerPotential: number;
  lng: number;
  lat: number;
}

export interface SimulationResult {
  runId: string;
  scenarioId: string;
  cells: SimCell[];
  summary: RunSummary;
  /** BC update vector components (null for baseline) */
  bcUpdateVector: BcUpdateVector | null;
  bcUpdateMagnitude: number;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Boundary-Condition Update Vector
// 11-dimensional vector representing the normalised per-dimension change
// between a baseline and an intervention boundary configuration.
// ---------------------------------------------------------------------------

export interface BcUpdateVector {
  /** Δ building height multiplier (normalised 0–1) */
  buildingHeight: number;
  /** Δ street canyon openness */
  streetCanyonOpenness: number;
  /** Δ roof orientation class (0 = same, 1 = maximally different) */
  roofOrientationClass: number;
  /** Δ surface exposure class */
  surfaceExposureClass: number;
  /** Δ wind channel openness */
  windChannelOpenness: number;
  /** Δ thermal exposure */
  thermalExposure: number;
  /** Δ movement density */
  movementDensity: number;
  /** Δ routing accessibility */
  routingAccessibility: number;
  /** Δ conversion surface assignment (Jaccard distance) */
  conversionSurfaceAssignment: number;
  /** Δ wind direction (normalised 0–1 over 180°) */
  windDirection: number;
  /** Δ solar condition profile (0 = same, 1 = maximally different) */
  solarConditionProfile: number;
}

// ---------------------------------------------------------------------------
// Layer and display types
// ---------------------------------------------------------------------------

export type MapLayer =
  | "powerPotential"
  | "ppgrMinimal"
  | "ppgrCoupled"
  | "resourceFlux"
  | "solarExposure"
  | "windAccessibility"
  | "thermalDifferential"
  | "movementCoupledEvent"
  | "reachableEnergeticDifference"
  | "conversionRealizability"
  | "systemicAvailability"
  | "informationGenerationRate"
  | "broadcastReachRate";

export const LAYER_LABELS: Record<MapLayer, string> = {
  powerPotential: "Power Potential",
  ppgrMinimal: "Power-Potential Gradient Rate (Minimal)",
  ppgrCoupled: "Power-Potential Gradient Rate (Coupled)",
  resourceFlux: "Resource Flux",
  solarExposure: "Solar Exposure Proxy",
  windAccessibility: "Wind Accessibility Proxy",
  thermalDifferential: "Thermal Differential Proxy",
  movementCoupledEvent: "Movement-Coupled Event Proxy",
  reachableEnergeticDifference: "Reachable Energetic Difference",
  conversionRealizability: "Conversion Realizability",
  systemicAvailability: "Systemic Availability",
  informationGenerationRate: "Information Generation Rate",
  broadcastReachRate: "Broadcast Reach Rate",
};

export type RankingMode = "minimal" | "coupled";
