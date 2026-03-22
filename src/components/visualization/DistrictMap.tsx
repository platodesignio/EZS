"use client";

import React, { useCallback, useMemo } from "react";
import DeckGL from "@deck.gl/react";
import { Map } from "react-map-gl/maplibre";
import {
  PolygonLayer,
  ScatterplotLayer,
  TextLayer,
} from "@deck.gl/layers";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import type { MapViewState } from "@deck.gl/core";
import { AmbientLight, DirectionalLight, LightingEffect } from "@deck.gl/core";
import type { SimCell, MapLayer, BuildingFeature, Hotspot } from "@/types/simulation";
import { LAYER_LABELS } from "@/types/simulation";
import { clamp } from "@/lib/simulation/normalize";

// ---------------------------------------------------------------------------
// Color interpolation for heatmap layers
// ---------------------------------------------------------------------------

type RGB = [number, number, number, number];

/**
 * Map a value in [0, 1] to an RGBA colour using a scientific diverging palette.
 * Deep blue (0) → cyan → green → yellow → red (1)
 */
function valueToColor(v: number, alpha = 200): RGB {
  const t = clamp(v);
  // 5-stop colour ramp
  const stops: RGB[] = [
    [30, 27, 75, alpha],    // 0.0: deep indigo
    [37, 99, 235, alpha],   // 0.25: blue
    [6, 182, 212, alpha],   // 0.5: cyan
    [234, 179, 8, alpha],   // 0.75: yellow
    [220, 38, 38, alpha],   // 1.0: red
  ];

  const segments = stops.length - 1;
  const seg = Math.min(Math.floor(t * segments), segments - 1);
  const frac = t * segments - seg;

  const a = stops[seg];
  const b = stops[seg + 1];
  return [
    Math.round(a[0] + (b[0] - a[0]) * frac),
    Math.round(a[1] + (b[1] - a[1]) * frac),
    Math.round(a[2] + (b[2] - a[2]) * frac),
    alpha,
  ];
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DistrictMapProps {
  viewState: MapViewState;
  cells: SimCell[];
  buildings: BuildingFeature[];
  activeLayer: MapLayer;
  selectedCellId: string | null;
  hotspots: Hotspot[];
  showBuildings: boolean;
  showHotspots: boolean;
  publicationMode: boolean;
  onViewStateChange: (vs: MapViewState) => void;
  onCellClick: (cell: SimCell) => void;
}

// ---------------------------------------------------------------------------
// Map style — CartoDB Dark Matter (free, no token required)
// ---------------------------------------------------------------------------

const MAP_STYLE =
  process.env.NEXT_PUBLIC_MAP_STYLE ??
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

// ---------------------------------------------------------------------------
// Lighting — enhances 3-D building extrusions
// ---------------------------------------------------------------------------

const ambientLight = new AmbientLight({ color: [255, 255, 255], intensity: 0.8 });
const sunLight = new DirectionalLight({
  color: [255, 240, 220],
  intensity: 2.5,
  direction: [-3, -9, -1],
});
const LIGHTING_EFFECT = new LightingEffect({ ambientLight, sunLight });

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DistrictMap({
  viewState,
  cells,
  buildings,
  activeLayer,
  selectedCellId,
  hotspots,
  showBuildings,
  showHotspots,
  publicationMode,
  onViewStateChange,
  onCellClick,
}: DistrictMapProps) {
  // Extract per-cell value for the active layer
  const getCellValue = useCallback(
    (cell: SimCell): number => {
      const v = cell[activeLayer as keyof SimCell];
      return typeof v === "number" ? v : 0;
    },
    [activeLayer]
  );

  // --------------------------------------------------------------------------
  // Layers
  // --------------------------------------------------------------------------

  const layers = useMemo(() => {
    const layerList = [];

    // 1. Cell heatmap fill layer
    if (cells.length > 0) {
      layerList.push(
        new PolygonLayer({
          id: "cell-fill",
          data: cells,
          getPolygon: (d: SimCell) => d.polygon,
          getFillColor: (d: SimCell) => {
            if (d.isBuilding) return [30, 30, 40, 80];
            const v = getCellValue(d);
            return valueToColor(v, 180);
          },
          getLineColor: (d: SimCell) => {
            if (d.id === selectedCellId) return [250, 250, 255, 255];
            return [42, 48, 64, 60];
          },
          getLineWidth: (d: SimCell) =>
            d.id === selectedCellId ? 2 : 0.5,
          lineWidthUnits: "pixels",
          pickable: true,
          onClick: (info: { object?: SimCell }) => {
            if (info.object) onCellClick(info.object);
          },
          updateTriggers: {
            getFillColor: [activeLayer, selectedCellId],
            getLineColor: [selectedCellId],
            getLineWidth: [selectedCellId],
          },
        })
      );
    }

    // 2. Building extrusion overlay (3D)
    if (showBuildings && buildings.length > 0) {
      layerList.push(
        new PolygonLayer({
          id: "buildings-extrusion",
          data: buildings,
          extruded: true,
          getPolygon: (d: BuildingFeature) => d.footprint,
          getElevation: (d: BuildingFeature) => d.height,
          getFillColor: [45, 55, 80, 210],
          getLineColor: [80, 100, 140, 90],
          getLineWidth: 0.5,
          lineWidthUnits: "pixels",
          material: {
            ambient: 0.4,
            diffuse: 0.7,
            shininess: 48,
            specularColor: [80, 90, 120],
          },
          pickable: false,
        })
      );
    }

    // 3. Hotspot markers
    if (showHotspots && hotspots.length > 0) {
      layerList.push(
        new ScatterplotLayer({
          id: "hotspot-rings",
          data: hotspots,
          getPosition: (d: Hotspot) => [d.lng, d.lat, 20],
          getRadius: 12,
          radiusUnits: "pixels",
          getFillColor: [234, 179, 8, 60],
          getLineColor: [234, 179, 8, 220],
          lineWidthMinPixels: 2,
          stroked: true,
          filled: true,
          pickable: false,
        })
      );

      layerList.push(
        new TextLayer({
          id: "hotspot-labels",
          data: hotspots,
          getPosition: (d: Hotspot) => [d.lng, d.lat, 25],
          getText: (d: Hotspot) => `#${d.rank}`,
          getSize: 10,
          getColor: [234, 179, 8, 255],
          getTextAnchor: "middle",
          getAlignmentBaseline: "center",
          pickable: false,
        })
      );
    }

    return layerList;
  }, [
    cells,
    buildings,
    activeLayer,
    selectedCellId,
    hotspots,
    showBuildings,
    showHotspots,
    getCellValue,
    onCellClick,
  ]);

  // --------------------------------------------------------------------------
  // Legend gradient
  // --------------------------------------------------------------------------

  const legendStops = Array.from({ length: 5 }, (_, i) => {
    const v = i / 4;
    const [r, g, b] = valueToColor(v, 255);
    return { v, color: `rgb(${r},${g},${b})` };
  });

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div className="relative w-full h-full bg-surface-0">
      <DeckGL
        viewState={viewState}
        controller={{ dragRotate: true, scrollZoom: true }}
        onViewStateChange={({ viewState: vs }) =>
          onViewStateChange(vs as MapViewState)
        }
        layers={layers}
        effects={[LIGHTING_EFFECT]}
        getCursor={({ isDragging }) => (isDragging ? "grabbing" : "crosshair")}
      >
        <Map
          mapStyle={MAP_STYLE}
          attributionControl={true}
          reuseMaps
        />
      </DeckGL>

      {/* Layer label overlay */}
      {!publicationMode && (
        <div className="ui-overlay absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-surface-1/90 border border-border rounded-full text-2xs text-text-secondary font-semibold backdrop-blur-sm pointer-events-none">
          {LAYER_LABELS[activeLayer]}
        </div>
      )}

      {/* Colour scale legend */}
      <div
        className={`map-legend absolute bottom-8 right-3 bg-surface-1/90 border border-border rounded p-2 min-w-[120px] backdrop-blur-sm`}
      >
        <div className="text-2xs text-text-tertiary mb-1 uppercase tracking-wider">
          {publicationMode ? LAYER_LABELS[activeLayer] : "Scale"}
        </div>
        <div
          className="h-2 rounded mb-1"
          style={{
            background: `linear-gradient(to right, ${legendStops
              .map((s) => s.color)
              .join(", ")})`,
          }}
        />
        <div className="flex justify-between text-2xs font-mono text-text-tertiary">
          <span>0.00</span>
          <span>0.50</span>
          <span>1.00</span>
        </div>
        {publicationMode && (
          <div className="text-2xs text-text-tertiary mt-1 leading-tight">
            Reduced-order proxy [0–1].
            <br />
            Not absolute physical quantity.
          </div>
        )}
      </div>

      {/* No data message */}
      {cells.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-surface-1/90 border border-border rounded-lg px-6 py-4 text-center backdrop-blur-sm">
            <div className="text-text-secondary text-sm font-semibold mb-1">
              No simulation data
            </div>
            <div className="text-text-tertiary text-xs">
              Select a scenario and click{" "}
              <span className="text-accent-blue">Run Simulation</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
