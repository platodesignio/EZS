"use client";

import React, { useState } from "react";
import clsx from "clsx";
import type {
  SimParams,
  BoundaryConditions,
  MapLayer,
  ConversionLayer,
} from "@/types/simulation";
import {
  DEFAULT_SIM_PARAMS,
  DEFAULT_BOUNDARY_CONDITIONS,
  LAYER_LABELS,
} from "@/types/simulation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScenarioItem {
  id: string;
  name: string;
  isBaseline: boolean;
  lastRun?: { runId: string; summary?: unknown };
}

interface LeftSidebarProps {
  projectName: string;
  scenarios: ScenarioItem[];
  activeScenarioId: string | null;
  baselineScenarioId: string | null;
  simParams: SimParams;
  boundaryConditions: BoundaryConditions;
  activeLayer: MapLayer;
  isSimulating: boolean;
  publicationMode: boolean;
  onSelectScenario: (id: string) => void;
  onCreateScenario: (name: string, isBaseline: boolean) => void;
  onDeleteScenario: (id: string) => void;
  onSimulate: () => void;
  onSimParamsChange: (params: Partial<SimParams>) => void;
  onBcChange: (bc: Partial<BoundaryConditions>) => void;
  onLayerChange: (layer: MapLayer) => void;
  onPublicationModeToggle: () => void;
}

type SidebarTab = "scenarios" | "intervention" | "parameters" | "layers";

// ---------------------------------------------------------------------------
// Tab header
// ---------------------------------------------------------------------------

function Tab({
  id,
  label,
  active,
  onClick,
}: {
  id: SidebarTab;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={clsx(
        "flex-1 py-2 text-2xs font-semibold uppercase tracking-wider border-b-2 transition-colors",
        active
          ? "border-accent-blue text-accent-blue"
          : "border-transparent text-text-tertiary hover:text-text-secondary"
      )}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Slider row
// ---------------------------------------------------------------------------

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const display = format ? format(value) : value.toFixed(2);
  return (
    <div className="mb-2">
      <div className="flex justify-between items-center mb-1">
        <span className="text-2xs text-text-secondary">{label}</span>
        <span className="text-2xs font-mono text-accent-cyan">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Select row
// ---------------------------------------------------------------------------

function SelectRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="mb-2">
      <label className="text-2xs text-text-secondary block mb-1">{label}</label>
      <select
        className="gpse-input"
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conversion layer checkboxes
// ---------------------------------------------------------------------------

const CONVERSION_LAYER_OPTIONS: { value: ConversionLayer; label: string }[] = [
  { value: "photovoltaic", label: "Photovoltaic (PV)" },
  { value: "piezoelectric", label: "Piezoelectric" },
  { value: "thermoelectric", label: "Thermoelectric" },
  { value: "hybrid", label: "Hybrid" },
];

function ConversionLayerSelector({
  value,
  onChange,
}: {
  value: ConversionLayer[];
  onChange: (v: ConversionLayer[]) => void;
}) {
  const toggle = (layer: ConversionLayer) => {
    if (value.includes(layer)) {
      onChange(value.filter((l) => l !== layer));
    } else {
      onChange([...value, layer]);
    }
  };

  return (
    <div className="mb-2">
      <label className="text-2xs text-text-secondary block mb-1">
        Conversion Surface Assignment
      </label>
      <div className="space-y-1">
        {CONVERSION_LAYER_OPTIONS.map(({ value: v, label }) => (
          <label key={v} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={value.includes(v)}
              onChange={() => toggle(v)}
              className="accent-accent-blue"
            />
            <span className="text-xs text-text-secondary">{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function LeftSidebar({
  projectName,
  scenarios,
  activeScenarioId,
  baselineScenarioId,
  simParams,
  boundaryConditions,
  activeLayer,
  isSimulating,
  publicationMode,
  onSelectScenario,
  onCreateScenario,
  onDeleteScenario,
  onSimulate,
  onSimParamsChange,
  onBcChange,
  onLayerChange,
  onPublicationModeToggle,
}: LeftSidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>("scenarios");
  const [newScenarioName, setNewScenarioName] = useState("");
  const [newScenarioBaseline, setNewScenarioBaseline] = useState(false);

  const allLayers = Object.entries(LAYER_LABELS) as [MapLayer, string][];

  return (
    <aside
      className={clsx(
        "w-80 flex flex-col bg-surface-1 border-r border-border h-full overflow-hidden",
        publicationMode && "ui-overlay"
      )}
    >
      {/* Header */}
      <div className="px-3 py-3 border-b border-border">
        <div className="text-xs font-semibold text-text-primary truncate">
          {projectName}
        </div>
        <div className="text-2xs text-text-tertiary mt-0.5">
          Generative Power Space Explorer
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border bg-surface-1">
        <Tab id="scenarios" label="Scenarios" active={activeTab === "scenarios"} onClick={() => setActiveTab("scenarios")} />
        <Tab id="intervention" label="BC" active={activeTab === "intervention"} onClick={() => setActiveTab("intervention")} />
        <Tab id="parameters" label="Params" active={activeTab === "parameters"} onClick={() => setActiveTab("parameters")} />
        <Tab id="layers" label="Layers" active={activeTab === "layers"} onClick={() => setActiveTab("layers")} />
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {/* SCENARIOS TAB */}
        {activeTab === "scenarios" && (
          <div className="p-3 space-y-3">
            <div className="panel-section -mx-3 -mt-3 mb-3">Scenarios</div>

            {/* Scenario list */}
            <div className="space-y-1">
              {scenarios.map((s) => (
                <div
                  key={s.id}
                  className={clsx(
                    "flex items-center justify-between p-2 rounded cursor-pointer border transition-colors",
                    activeScenarioId === s.id
                      ? "bg-surface-3 border-accent-blue"
                      : "bg-surface-2 border-border hover:border-text-tertiary"
                  )}
                  onClick={() => onSelectScenario(s.id)}
                >
                  <div className="min-w-0">
                    <div className="text-xs text-text-primary truncate flex items-center gap-1">
                      {s.isBaseline && (
                        <span className="text-2xs bg-accent-teal/20 text-accent-teal border border-accent-teal/30 px-1 rounded">
                          BASE
                        </span>
                      )}
                      {s.name}
                    </div>
                    {s.lastRun && (
                      <div className="text-2xs text-text-tertiary font-mono">
                        {s.lastRun.runId}
                      </div>
                    )}
                  </div>
                  {!s.isBaseline && (
                    <button
                      className="text-text-tertiary hover:text-red-400 ml-2 transition-colors text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteScenario(s.id);
                      }}
                      title="Delete scenario"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* New scenario */}
            <div className="border border-border rounded p-2 space-y-2 bg-surface-2">
              <div className="text-2xs text-text-tertiary font-semibold uppercase tracking-wider">
                New Scenario
              </div>
              <input
                type="text"
                className="gpse-input"
                placeholder="Scenario name…"
                value={newScenarioName}
                onChange={(e) => setNewScenarioName(e.target.value)}
              />
              <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={newScenarioBaseline}
                  onChange={(e) => setNewScenarioBaseline(e.target.checked)}
                  className="accent-accent-teal"
                />
                Set as Baseline
              </label>
              <button
                className="btn-primary w-full"
                disabled={!newScenarioName.trim()}
                onClick={() => {
                  if (newScenarioName.trim()) {
                    onCreateScenario(newScenarioName.trim(), newScenarioBaseline);
                    setNewScenarioName("");
                    setNewScenarioBaseline(false);
                  }
                }}
              >
                + Create Scenario
              </button>
            </div>

            {/* Run simulation */}
            <button
              className="btn-primary w-full"
              disabled={!activeScenarioId || isSimulating}
              onClick={onSimulate}
            >
              {isSimulating ? (
                <>
                  <span className="animate-spin mr-1">⟳</span> Simulating…
                </>
              ) : (
                "▶ Run Simulation"
              )}
            </button>

            {/* Publication mode */}
            <button
              className={clsx(
                "btn-secondary w-full",
                publicationMode && "border-accent-purple text-accent-purple"
              )}
              onClick={onPublicationModeToggle}
            >
              {publicationMode ? "✓ Publication Mode" : "Publication Mode"}
            </button>
          </div>
        )}

        {/* BOUNDARY CONDITIONS TAB */}
        {activeTab === "intervention" && (
          <div className="p-3">
            <div className="panel-section -mx-3 -mt-3 mb-3">
              Boundary-Condition Update
            </div>
            <div className="text-2xs text-text-tertiary mb-3 leading-relaxed">
              Boundary Conditions are spatiotemporal, material, behavioral, and
              control constraints determining how resource flux becomes reachable
              energetic difference.
            </div>

            <SliderRow
              label="Building Height Multiplier"
              value={boundaryConditions.buildingHeightMultiplier}
              min={0.5} max={2.0} step={0.05}
              format={(v) => `${v.toFixed(2)}×`}
              onChange={(v) => onBcChange({ buildingHeightMultiplier: v })}
            />
            <SliderRow
              label="Street Canyon Openness"
              value={boundaryConditions.streetCanyonOpenness}
              min={0} max={1} step={0.05}
              onChange={(v) => onBcChange({ streetCanyonOpenness: v })}
            />
            <SliderRow
              label="Wind Channel Openness"
              value={boundaryConditions.windChannelOpenness}
              min={0} max={1} step={0.05}
              onChange={(v) => onBcChange({ windChannelOpenness: v })}
            />
            <SliderRow
              label="Thermal Exposure"
              value={boundaryConditions.thermalExposure}
              min={0} max={1} step={0.05}
              onChange={(v) => onBcChange({ thermalExposure: v })}
            />
            <SliderRow
              label="Movement Density"
              value={boundaryConditions.movementDensity}
              min={0} max={1} step={0.05}
              onChange={(v) => onBcChange({ movementDensity: v })}
            />
            <SliderRow
              label="Routing Accessibility"
              value={boundaryConditions.routingAccessibility}
              min={0} max={1} step={0.05}
              onChange={(v) => onBcChange({ routingAccessibility: v })}
            />
            <SliderRow
              label="Prevailing Wind Direction (°N)"
              value={boundaryConditions.windDirection}
              min={0} max={359} step={5}
              format={(v) => `${v}°`}
              onChange={(v) => onBcChange({ windDirection: v })}
            />

            <SelectRow
              label="Roof Orientation Class"
              value={boundaryConditions.roofOrientationClass}
              options={[
                { value: "flat", label: "Flat" },
                { value: "pitched_ns", label: "Pitched N–S" },
                { value: "pitched_ew", label: "Pitched E–W" },
                { value: "mixed", label: "Mixed" },
              ]}
              onChange={(v) => onBcChange({ roofOrientationClass: v })}
            />
            <SelectRow
              label="Surface Exposure Class"
              value={boundaryConditions.surfaceExposureClass}
              options={[
                { value: "standard", label: "Standard" },
                { value: "high_albedo", label: "High Albedo" },
                { value: "green_roof", label: "Green Roof" },
                { value: "pv_panel", label: "PV Panel" },
              ]}
              onChange={(v) => onBcChange({ surfaceExposureClass: v })}
            />
            <SelectRow
              label="Solar Condition Profile"
              value={boundaryConditions.solarConditionProfile}
              options={[
                { value: "clear", label: "Clear" },
                { value: "partly_cloudy", label: "Partly Cloudy" },
                { value: "overcast", label: "Overcast" },
              ]}
              onChange={(v) => onBcChange({ solarConditionProfile: v })}
            />

            <ConversionLayerSelector
              value={boundaryConditions.conversionSurfaceAssignment}
              onChange={(v) => onBcChange({ conversionSurfaceAssignment: v })}
            />

            <button
              className="btn-secondary w-full mt-2"
              onClick={() => onBcChange({ ...DEFAULT_BOUNDARY_CONDITIONS })}
            >
              Reset to Defaults
            </button>
          </div>
        )}

        {/* SIMULATION PARAMETERS TAB */}
        {activeTab === "parameters" && (
          <div className="p-3">
            <div className="panel-section -mx-3 -mt-3 mb-3">
              Simulation Parameters
            </div>
            <div className="text-2xs text-text-tertiary mb-3 leading-relaxed">
              Reduced-order approximation parameters. Cell size affects
              computational grid resolution.
            </div>

            <SliderRow
              label="Cell Size (m)"
              value={simParams.cellSize}
              min={10} max={50} step={5}
              format={(v) => `${v}m`}
              onChange={(v) => onSimParamsChange({ cellSize: v })}
            />
            <SliderRow
              label="Day of Year"
              value={simParams.dayOfYear}
              min={1} max={365} step={1}
              format={(v) => `Day ${v}`}
              onChange={(v) => onSimParamsChange({ dayOfYear: v })}
            />
            <SliderRow
              label="Site Latitude (°)"
              value={simParams.latitude}
              min={-60} max={70} step={0.5}
              format={(v) => `${v.toFixed(1)}°`}
              onChange={(v) => onSimParamsChange({ latitude: v })}
            />

            <div className="mt-3 mb-2 text-2xs font-semibold text-text-tertiary uppercase tracking-wider">
              Resource Flux Weights
            </div>
            <SliderRow
              label="Solar Weight"
              value={simParams.weights.solar}
              min={0} max={1} step={0.05}
              onChange={(v) =>
                onSimParamsChange({ weights: { ...simParams.weights, solar: v } })
              }
            />
            <SliderRow
              label="Wind Weight"
              value={simParams.weights.wind}
              min={0} max={1} step={0.05}
              onChange={(v) =>
                onSimParamsChange({ weights: { ...simParams.weights, wind: v } })
              }
            />
            <SliderRow
              label="Thermal Weight"
              value={simParams.weights.thermal}
              min={0} max={1} step={0.05}
              onChange={(v) =>
                onSimParamsChange({ weights: { ...simParams.weights, thermal: v } })
              }
            />
            <SliderRow
              label="Movement Weight"
              value={simParams.weights.movement}
              min={0} max={1} step={0.05}
              onChange={(v) =>
                onSimParamsChange({ weights: { ...simParams.weights, movement: v } })
              }
            />

            <div className="mt-3 mb-2 text-2xs font-semibold text-text-tertiary uppercase tracking-wider">
              Advanced — IGR
            </div>
            <SliderRow
              label="α (New State Rate)"
              value={simParams.igrAlpha}
              min={0} max={1} step={0.05}
              onChange={(v) => onSimParamsChange({ igrAlpha: v })}
            />
            <SliderRow
              label="β (New Transition Rate)"
              value={simParams.igrBeta}
              min={0} max={1} step={0.05}
              onChange={(v) => onSimParamsChange({ igrBeta: v })}
            />
            <SliderRow
              label="State Change Threshold"
              value={simParams.stateThreshold}
              min={0.01} max={0.5} step={0.01}
              onChange={(v) => onSimParamsChange({ stateThreshold: v })}
            />

            <button
              className="btn-secondary w-full mt-2"
              onClick={() => onSimParamsChange({ ...DEFAULT_SIM_PARAMS })}
            >
              Reset to Defaults
            </button>
          </div>
        )}

        {/* LAYERS TAB */}
        {activeTab === "layers" && (
          <div className="p-3">
            <div className="panel-section -mx-3 -mt-3 mb-3">
              Visualization Layer
            </div>
            <div className="space-y-1">
              {allLayers.map(([key, label]) => (
                <button
                  key={key}
                  className={clsx(
                    "w-full text-left px-2 py-1.5 rounded border text-xs transition-colors",
                    activeLayer === key
                      ? "bg-surface-3 border-accent-cyan text-accent-cyan"
                      : "bg-surface-2 border-border text-text-secondary hover:border-text-tertiary hover:text-text-primary"
                  )}
                  onClick={() => onLayerChange(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
