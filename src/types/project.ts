// =============================================================================
// Project and scenario data-transfer types
// These mirror the Prisma models but are typed for use in application logic.
// =============================================================================

import type {
  BoundaryConditions,
  SimParams,
  EnvParams,
  AttractorNode,
  StorageNode,
  BuildingFeature,
} from "./simulation";

export interface ProjectRecord {
  id: string;
  name: string;
  description: string | null;
  siteExtent: SiteExtent | null;
  centroid: { lng: number; lat: number } | null;
  createdAt: string;
  updatedAt: string;
}

export interface SiteExtent {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export interface ScenarioRecord {
  id: string;
  projectId: string;
  name: string;
  isBaseline: boolean;
  buildingsGeoJson: GeoJsonFeatureCollection | null;
  envParams: EnvParams | null;
  simParams: SimParams | null;
  boundaryConditions: BoundaryConditions | null;
  attractorNodes: AttractorNode[] | null;
  storageNodes: StorageNode[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface SimulationRunRecord {
  id: string;
  runId: string;
  scenarioId: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  cells: unknown | null;
  summary: unknown | null;
  bcUpdateVector: unknown | null;
  bcUpdateMagnitude: number | null;
  durationMs: number | null;
  createdAt: string;
  completedAt: string | null;
}

// GeoJSON types (subset of the spec needed for building footprints)
export interface GeoJsonFeatureCollection {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
}

export interface GeoJsonFeature {
  type: "Feature";
  id?: string | number;
  geometry: GeoJsonPolygon | GeoJsonMultiPolygon;
  properties: Record<string, unknown> & {
    height?: number;
    /** Floor count as alternative to height (height = floors × 3.5 m) */
    floors?: number;
    /** Building ID / name */
    name?: string;
  };
}

export interface GeoJsonPolygon {
  type: "Polygon";
  coordinates: [number, number][][];
}

export interface GeoJsonMultiPolygon {
  type: "MultiPolygon";
  coordinates: [number, number][][][];
}

/** Parsed GeoJSON converted into flat BuildingFeature array */
export function parseBuildingsFromGeoJson(
  geojson: GeoJsonFeatureCollection
): BuildingFeature[] {
  const buildings: BuildingFeature[] = [];

  for (const feature of geojson.features) {
    const props = feature.properties ?? {};
    const rawHeight =
      typeof props.height === "number"
        ? props.height
        : typeof props.floors === "number"
          ? props.floors * 3.5
          : 10; // default 10 m if no height info

    const height = Math.max(1, rawHeight);

    const id =
      feature.id != null
        ? String(feature.id)
        : `bld_${buildings.length}`;

    if (feature.geometry.type === "Polygon") {
      buildings.push({
        id,
        footprint: feature.geometry.coordinates[0] as [number, number][],
        height,
      });
    } else if (feature.geometry.type === "MultiPolygon") {
      feature.geometry.coordinates.forEach((poly, i) => {
        buildings.push({
          id: `${id}_${i}`,
          footprint: poly[0] as [number, number][],
          height,
        });
      });
    }
  }

  return buildings;
}
