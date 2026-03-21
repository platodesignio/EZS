"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  Suspense,
} from "react";
import dynamic from "next/dynamic";
import clsx from "clsx";
import type { MapViewState } from "@deck.gl/core";
import type {
  SimCell,
  SimParams,
  BoundaryConditions,
  MapLayer,
  RankingMode,
  RunSummary,
  Hotspot,
  BuildingFeature,
} from "@/types/simulation";
import {
  DEFAULT_SIM_PARAMS,
  DEFAULT_BOUNDARY_CONDITIONS,
} from "@/types/simulation";
import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { RightInspector } from "@/components/layout/RightInspector";
import { BottomPanel } from "@/components/layout/BottomPanel";
import { FeedbackForm } from "@/components/feedback/FeedbackForm";

// DistrictMap is client-only (uses deck.gl / maplibre-gl)
const DistrictMap = dynamic(
  () =>
    import("@/components/visualization/DistrictMap").then(
      (m) => m.DistrictMap
    ),
  { ssr: false, loading: () => <MapLoadingPlaceholder /> }
);

function MapLoadingPlaceholder() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-surface-0 text-text-tertiary text-xs">
      <span className="animate-pulse">Loading map…</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScenarioItem {
  id: string;
  name: string;
  isBaseline: boolean;
  projectId: string;
  buildingsGeoJson?: unknown;
  envParams?: unknown;
  simParams?: unknown;
  boundaryConditions?: unknown;
  attractorNodes?: unknown;
  storageNodes?: unknown;
  lastRun?: { runId: string; summary?: unknown };
}

interface RunState {
  runId: string;
  runDbId: string;
  cells: SimCell[];
  summary: RunSummary;
}

// ---------------------------------------------------------------------------
// Utility: parse buildings from GeoJSON stored in scenario
// ---------------------------------------------------------------------------

function extractBuildings(geojson: unknown): BuildingFeature[] {
  if (!geojson || typeof geojson !== "object") return [];
  const g = geojson as { type?: string; features?: unknown[] };
  if (g.type !== "FeatureCollection" || !Array.isArray(g.features)) return [];

  const buildings: BuildingFeature[] = [];
  for (const f of g.features) {
    const feat = f as { type?: string; id?: unknown; geometry?: unknown; properties?: Record<string, unknown> };
    if (!feat.geometry) continue;
    const geom = feat.geometry as { type?: string; coordinates?: unknown };
    const props = feat.properties ?? {};
    const height =
      typeof props.height === "number"
        ? props.height
        : typeof props.floors === "number"
          ? (props.floors as number) * 3.5
          : 10;
    const id = feat.id != null ? String(feat.id) : `b${buildings.length}`;
    if (geom.type === "Polygon") {
      const coords = (geom.coordinates as [number, number][][])[0];
      if (coords?.length >= 3) {
        buildings.push({ id, footprint: coords, height });
      }
    }
  }
  return buildings;
}

// ---------------------------------------------------------------------------
// Initial view state (Tokyo approximate — matches demo district)
// ---------------------------------------------------------------------------

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: 139.6917,
  latitude: 35.6895,
  zoom: 15,
  pitch: 35,
  bearing: -15,
};

// ---------------------------------------------------------------------------
// Main application component
// ---------------------------------------------------------------------------

export default function HomePage() {
  // ---- Project state ----
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("Demo District");

  // ---- Scenario state ----
  const [scenarios, setScenarios] = useState<ScenarioItem[]>([]);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [baselineScenarioId, setBaselineScenarioId] = useState<string | null>(null);

  // ---- Simulation params (local UI state, persisted to DB on simulate) ----
  const [simParams, setSimParams] = useState<SimParams>({ ...DEFAULT_SIM_PARAMS });
  const [boundaryConditions, setBoundaryConditions] = useState<BoundaryConditions>({
    ...DEFAULT_BOUNDARY_CONDITIONS,
  });

  // ---- Run state ----
  const [activeRun, setActiveRun] = useState<RunState | null>(null);
  const [baselineRun, setBaselineRun] = useState<RunState | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);

  // ---- Map state ----
  const [viewState, setViewState] = useState<MapViewState>(INITIAL_VIEW_STATE);
  const [activeLayer, setActiveLayer] = useState<MapLayer>("powerPotential");
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
  const [showBuildings, setShowBuildings] = useState(true);
  const [showHotspots, setShowHotspots] = useState(true);
  const [rankingMode, setRankingMode] = useState<RankingMode>("minimal");
  const [publicationMode, setPublicationMode] = useState(false);

  // ---- UI state ----
  const [showFeedback, setShowFeedback] = useState(false);
  const [buildings, setBuildings] = useState<BuildingFeature[]>([]);

  // ---------------------------------------------------------------------------
  // Boot: load or create demo project
  // ---------------------------------------------------------------------------

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/projects");
        const data = await res.json();
        if (data.ok && data.data.length > 0) {
          const proj = data.data[0];
          setProjectId(proj.id);
          setProjectName(proj.name);
          await loadScenarios(proj.id);
        } else {
          await createDemoProject();
        }
      } catch (err) {
        console.error("Boot error:", err);
        await createDemoProject();
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function createDemoProject() {
    try {
      const projRes = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Demo District — Tokyo Grid" }),
      });
      const projData = await projRes.json();
      if (!projData.ok) return;
      const proj = projData.data;
      setProjectId(proj.id);
      setProjectName(proj.name);

      // Fetch demo GeoJSON
      const geoRes = await fetch("/demo/district.geojson");
      const geojson = await geoRes.json();

      // Create baseline scenario
      const baseRes = await fetch("/api/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: proj.id,
          name: "Baseline",
          isBaseline: true,
          buildingsGeoJson: geojson,
          envParams: {
            latitude: 35.6895,
            longitude: 139.6917,
            windSpeed: 3.5,
            windDirection: 225,
            ambientTempC: 15,
          },
          simParams: DEFAULT_SIM_PARAMS,
          boundaryConditions: DEFAULT_BOUNDARY_CONDITIONS,
          attractorNodes: [
            { id: "a1", lng: 139.692, lat: 35.6905, weight: 1.0, label: "Transit Hub" },
            { id: "a2", lng: 139.690, lat: 35.688, weight: 0.7, label: "Commercial Center" },
          ],
          storageNodes: [
            { id: "s1", lng: 139.693, lat: 35.691, label: "Grid Storage A" },
            { id: "s2", lng: 139.690, lat: 35.688, label: "Grid Storage B" },
          ],
        }),
      });
      const baseData = await baseRes.json();
      if (baseData.ok) {
        setScenarios([baseData.data]);
        setActiveScenarioId(baseData.data.id);
        setBaselineScenarioId(baseData.data.id);
        setBuildings(extractBuildings(geojson));
      }
    } catch (err) {
      console.error("Failed to create demo project:", err);
    }
  }

  async function loadScenarios(pid: string) {
    const res = await fetch(`/api/scenarios?projectId=${pid}`);
    const data = await res.json();
    if (data.ok) {
      setScenarios(data.data);
      const baseline = data.data.find((s: ScenarioItem) => s.isBaseline);
      if (baseline) {
        setBaselineScenarioId(baseline.id);
        setActiveScenarioId(baseline.id);
        setBuildings(extractBuildings(baseline.buildingsGeoJson));
        if (baseline.simParams) setSimParams(baseline.simParams as unknown as SimParams);
        if (baseline.boundaryConditions) {
          setBoundaryConditions(baseline.boundaryConditions as unknown as BoundaryConditions);
        }
      } else if (data.data.length > 0) {
        setActiveScenarioId(data.data[0].id);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Scenario actions
  // ---------------------------------------------------------------------------

  const handleSelectScenario = useCallback(
    (id: string) => {
      setActiveScenarioId(id);
      const s = scenarios.find((sc) => sc.id === id);
      if (!s) return;
      setBuildings(extractBuildings(s.buildingsGeoJson));
      if (s.simParams) setSimParams(s.simParams as unknown as SimParams);
      if (s.boundaryConditions) {
        setBoundaryConditions(s.boundaryConditions as unknown as BoundaryConditions);
      }
      setSelectedCellId(null);
    },
    [scenarios]
  );

  const handleCreateScenario = useCallback(
    async (name: string, isBaseline: boolean) => {
      if (!projectId) return;

      // Copy GeoJSON from baseline or first available scenario
      const sourceScenario =
        scenarios.find((s) => s.isBaseline) ?? scenarios[0];
      const buildingsGeoJson = sourceScenario?.buildingsGeoJson ?? null;

      const res = await fetch("/api/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          name,
          isBaseline,
          buildingsGeoJson,
          envParams: sourceScenario?.envParams ?? null,
          simParams,
          boundaryConditions,
          attractorNodes: sourceScenario?.attractorNodes ?? [],
          storageNodes: sourceScenario?.storageNodes ?? [],
        }),
      });
      const data = await res.json();
      if (data.ok) {
        const newScenarios = [...scenarios, data.data];
        if (isBaseline) {
          // Update previous baseline
          const updatedScenarios = newScenarios.map((s) => ({
            ...s,
            isBaseline: s.id === data.data.id,
          }));
          setScenarios(updatedScenarios);
          setBaselineScenarioId(data.data.id);
        } else {
          setScenarios(newScenarios);
        }
        setActiveScenarioId(data.data.id);
      }
    },
    [projectId, scenarios, simParams, boundaryConditions]
  );

  const handleDeleteScenario = useCallback(
    async (id: string) => {
      if (id === baselineScenarioId) return; // protect baseline
      await fetch(`/api/scenarios/${id}`, { method: "DELETE" });
      const remaining = scenarios.filter((s) => s.id !== id);
      setScenarios(remaining);
      if (activeScenarioId === id) {
        const next = remaining[0];
        if (next) handleSelectScenario(next.id);
        else setActiveScenarioId(null);
      }
    },
    [scenarios, activeScenarioId, baselineScenarioId, handleSelectScenario]
  );

  // ---------------------------------------------------------------------------
  // Simulation
  // ---------------------------------------------------------------------------

  const handleSimulate = useCallback(async () => {
    if (!activeScenarioId) return;

    setIsSimulating(true);
    setSimError(null);

    // Persist current params to scenario before simulating
    await fetch(`/api/scenarios/${activeScenarioId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ simParams, boundaryConditions }),
    });

    try {
      // Find the baseline run DB id if this is an intervention scenario
      const isBaseline = activeScenarioId === baselineScenarioId;
      const baselineRunDbId =
        !isBaseline && baselineRun ? baselineRun.runDbId : null;

      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioId: activeScenarioId,
          baselineRunId: baselineRunDbId,
        }),
      });
      const data = await res.json();

      if (!data.ok) {
        setSimError(data.error ?? "Simulation failed.");
        return;
      }

      // Fetch full cell data
      const runRes = await fetch(`/api/runs/${data.data.runDbId}`);
      const runData = await runRes.json();

      if (runData.ok) {
        const run: RunState = {
          runId: data.data.runId,
          runDbId: data.data.runDbId,
          cells: runData.data.cells as SimCell[],
          summary: runData.data.summary as RunSummary,
        };

        if (isBaseline || !baselineRun) {
          setBaselineRun(run);
        }
        setActiveRun(run);

        // Update scenario with last run info
        setScenarios((prev) =>
          prev.map((s) =>
            s.id === activeScenarioId
              ? { ...s, lastRun: { runId: data.data.runId, summary: data.data.summary } }
              : s
          )
        );
      }
    } catch (err) {
      setSimError("Network error. Check console.");
      console.error("Simulate error:", err);
    } finally {
      setIsSimulating(false);
    }
  }, [
    activeScenarioId,
    baselineScenarioId,
    simParams,
    boundaryConditions,
    baselineRun,
  ]);

  // ---------------------------------------------------------------------------
  // Cell selection
  // ---------------------------------------------------------------------------

  const selectedCell = React.useMemo(() => {
    if (!selectedCellId || !activeRun) return null;
    return activeRun.cells.find((c) => c.id === selectedCellId) ?? null;
  }, [selectedCellId, activeRun]);

  // ---------------------------------------------------------------------------
  // CSV export
  // ---------------------------------------------------------------------------

  const handleExportCSV = useCallback(async () => {
    if (!activeRun) return;
    const url = `/api/runs/${activeRun.runDbId}/export`;
    const link = document.createElement("a");
    link.href = url;
    link.download = `gpse_${activeRun.runId}.csv`;
    link.click();
  }, [activeRun]);

  // ---------------------------------------------------------------------------
  // PNG export (publication mode)
  // ---------------------------------------------------------------------------

  const handleExportPNG = useCallback(async () => {
    try {
      const { toPng } = await import("html-to-image");
      const mapEl = document.querySelector(".deckgl-canvas") as HTMLCanvasElement | null;
      if (!mapEl) return;
      const dataUrl = await toPng(mapEl);
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `gpse_map_${activeLayer}.png`;
      link.click();
    } catch (err) {
      console.error("PNG export failed:", err);
    }
  }, [activeLayer]);

  // ---------------------------------------------------------------------------
  // Hotspots for current ranking mode
  // ---------------------------------------------------------------------------

  const hotspots: Hotspot[] = activeRun?.summary
    ? rankingMode === "minimal"
      ? activeRun.summary.hotspotsMinimal
      : activeRun.summary.hotspotsCoupled
    : [];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      className={clsx(
        "flex flex-col h-screen overflow-hidden bg-surface-0",
        publicationMode && "publication-mode"
      )}
    >
      {/* Top bar */}
      <header
        className={clsx(
          "flex items-center justify-between px-4 h-9 border-b border-border bg-surface-1 shrink-0 ui-overlay",
          publicationMode && "hidden"
        )}
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-text-primary tracking-tight">
            GPSE
          </span>
          <span className="text-text-tertiary text-2xs">|</span>
          <span className="text-2xs text-text-tertiary">
            Generative Power Space Explorer
          </span>
          <span className="text-2xs text-amber-400 border border-amber-700/40 bg-amber-900/20 px-1.5 py-0.5 rounded">
            Reduced-Order Model
          </span>
        </div>

        <div className="flex items-center gap-2">
          {simError && (
            <span className="text-2xs text-red-400 max-w-xs truncate">
              ⚠ {simError}
            </span>
          )}
          {activeRun && (
            <span className="text-2xs font-mono text-text-tertiary">
              {activeRun.runId}
            </span>
          )}
          <button
            className="btn-secondary text-2xs px-2 py-0.5"
            onClick={handleExportPNG}
            disabled={!activeRun}
            title="Export map as PNG"
          >
            ↓ PNG
          </button>
          <button
            className="btn-secondary text-2xs px-2 py-0.5"
            onClick={() => setShowFeedback(true)}
            title="Submit feedback for this run"
          >
            Feedback
          </button>
          <button
            className={clsx(
              "text-2xs px-2 py-0.5 rounded border transition-colors",
              showBuildings
                ? "border-accent-blue/60 text-accent-blue bg-surface-3"
                : "btn-secondary"
            )}
            onClick={() => setShowBuildings((v) => !v)}
            title="Toggle building extrusions"
          >
            Buildings
          </button>
          <button
            className={clsx(
              "text-2xs px-2 py-0.5 rounded border transition-colors",
              showHotspots
                ? "border-accent-yellow/60 text-accent-yellow bg-surface-3"
                : "btn-secondary"
            )}
            onClick={() => setShowHotspots((v) => !v)}
            title="Toggle hotspot markers"
          >
            Hotspots
          </button>
        </div>
      </header>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <LeftSidebar
          projectName={projectName}
          scenarios={scenarios}
          activeScenarioId={activeScenarioId}
          baselineScenarioId={baselineScenarioId}
          simParams={simParams}
          boundaryConditions={boundaryConditions}
          activeLayer={activeLayer}
          isSimulating={isSimulating}
          publicationMode={publicationMode}
          onSelectScenario={handleSelectScenario}
          onCreateScenario={handleCreateScenario}
          onDeleteScenario={handleDeleteScenario}
          onSimulate={handleSimulate}
          onSimParamsChange={(p) => setSimParams((prev) => ({ ...prev, ...p }))}
          onBcChange={(bc) =>
            setBoundaryConditions((prev) => ({ ...prev, ...bc }))
          }
          onLayerChange={setActiveLayer}
          onPublicationModeToggle={() => setPublicationMode((v) => !v)}
        />

        {/* Center map */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 relative">
            <DistrictMap
              viewState={viewState}
              cells={activeRun?.cells ?? []}
              buildings={buildings}
              activeLayer={activeLayer}
              selectedCellId={selectedCellId}
              hotspots={hotspots}
              showBuildings={showBuildings}
              showHotspots={showHotspots}
              publicationMode={publicationMode}
              onViewStateChange={setViewState}
              onCellClick={(cell) => setSelectedCellId(cell.id)}
            />
          </div>

          {/* Bottom panel */}
          <BottomPanel
            baselineRun={baselineRun}
            activeRun={activeRun}
            rankingMode={rankingMode}
            publicationMode={publicationMode}
            onRankingModeChange={setRankingMode}
            onCellSelect={(cellId) => {
              setSelectedCellId(cellId);
              const cell = activeRun?.cells.find((c) => c.id === cellId);
              if (cell) {
                setViewState((vs) => ({
                  ...vs,
                  longitude: cell.lng,
                  latitude: cell.lat,
                  zoom: Math.max(vs.zoom, 16),
                  transitionDuration: 800,
                }));
              }
            }}
            onExportCSV={handleExportCSV}
          />
        </main>

        {/* Right inspector */}
        <RightInspector
          selectedCell={selectedCell}
          activeLayer={activeLayer}
          publicationMode={publicationMode}
        />
      </div>

      {/* Feedback modal */}
      {showFeedback && (
        <FeedbackForm
          runId={activeRun?.runId ?? null}
          onClose={() => setShowFeedback(false)}
        />
      )}
    </div>
  );
}

