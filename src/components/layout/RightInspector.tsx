"use client";

import React from "react";
import clsx from "clsx";
import type { SimCell, MapLayer } from "@/types/simulation";
import { LAYER_LABELS } from "@/types/simulation";

interface RightInspectorProps {
  selectedCell: SimCell | null;
  activeLayer: MapLayer;
  publicationMode: boolean;
}

// ---------------------------------------------------------------------------
// MetricRow — single metric with gradient progress bar
// ---------------------------------------------------------------------------

function MetricRow({
  label,
  value,
  description,
  highlight,
  color,
}: {
  label: string;
  value: number | string;
  description?: string;
  highlight?: boolean;
  color?: "cyan" | "green" | "yellow" | "blue" | "orange";
}) {
  const numValue = typeof value === "number" ? value : null;
  const displayValue =
    numValue !== null ? numValue.toFixed(4) : String(value);

  const barWidth =
    numValue !== null ? `${Math.min(numValue * 100, 100).toFixed(1)}%` : "0%";

  const barGradient: Record<string, string> = {
    cyan: "from-cyan-500/70 to-cyan-400/40",
    green: "from-green-500/70 to-green-400/40",
    yellow: "from-yellow-500/70 to-yellow-400/40",
    blue: "from-blue-500/70 to-blue-400/40",
    orange: "from-orange-500/70 to-orange-400/40",
  };

  const barClass =
    numValue !== null
      ? color
        ? barGradient[color]
        : numValue > 0.7
          ? barGradient.green
          : numValue > 0.4
            ? barGradient.yellow
            : barGradient.blue
      : "from-surface-4 to-surface-4";

  return (
    <div
      className={clsx(
        "px-3 py-2 border-b border-border/50",
        highlight && "bg-surface-3/60"
      )}
    >
      <div className="flex justify-between items-baseline mb-0.5">
        <span className="text-2xs text-text-secondary leading-tight">
          {label}
        </span>
        <span
          className={clsx(
            "text-xs font-mono font-semibold tabular-nums",
            highlight ? "text-accent-cyan" : "text-text-primary"
          )}
        >
          {displayValue}
        </span>
      </div>
      {numValue !== null && (
        <div className="h-0.5 bg-surface-4 rounded overflow-hidden mt-1">
          <div
            className={clsx("h-full rounded bg-gradient-to-r transition-all", barClass)}
            style={{ width: barWidth }}
          />
        </div>
      )}
      {description && (
        <div className="text-2xs text-text-tertiary mt-0.5 leading-tight font-mono">
          {description}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="px-3 py-1.5 bg-surface-2 border-b border-border sticky top-0 z-10">
      <span className="text-2xs font-semibold uppercase tracking-widest text-text-tertiary">
        {title}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function RightInspector({
  selectedCell,
  activeLayer,
  publicationMode,
}: RightInspectorProps) {
  if (!selectedCell) {
    return (
      <aside
        className={clsx(
          "w-72 flex flex-col bg-surface-1 border-l border-border h-full",
          publicationMode && "ui-overlay"
        )}
      >
        <div className="panel-section">Cell Inspector</div>
        <div className="flex-1 flex flex-col items-center justify-center text-text-tertiary text-xs p-6 text-center gap-2">
          <svg
            width="32"
            height="32"
            viewBox="0 0 32 32"
            fill="none"
            className="opacity-30"
          >
            <rect
              x="4"
              y="4"
              width="24"
              height="24"
              rx="2"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M4 12h24M12 4v24"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
          <span>Click a cell on the map to inspect its metrics.</span>
        </div>
      </aside>
    );
  }

  const c = selectedCell;

  return (
    <aside
      className={clsx(
        "w-72 flex flex-col bg-surface-1 border-l border-border h-full overflow-y-auto",
        publicationMode && "ui-overlay"
      )}
    >
      {/* Header */}
      <div className="panel-section sticky top-0 z-20 flex items-center justify-between">
        <span>Cell Inspector</span>
        <span className="font-mono text-text-secondary normal-case tracking-normal">
          {c.id}
        </span>
      </div>

      {/* Cell metadata */}
      <div className="px-3 py-2 border-b border-border bg-surface-2/40 animate-fade-in">
        <div className="grid grid-cols-2 gap-x-3 text-2xs">
          <div>
            <span className="text-text-tertiary">Grid: </span>
            <span className="font-mono text-text-secondary">
              r{c.row} c{c.col}
            </span>
          </div>
          <div>
            <span className="text-text-tertiary">Type: </span>
            <span
              className={clsx(
                "font-semibold",
                c.isBuilding ? "text-red-400" : "text-accent-teal"
              )}
            >
              {c.isBuilding ? "Building" : "Open"}
            </span>
          </div>
          <div className="col-span-2 mt-0.5">
            <span className="text-text-tertiary">Coords: </span>
            <span className="font-mono text-text-secondary">
              {c.lng.toFixed(5)}, {c.lat.toFixed(5)}
            </span>
          </div>
          {c.buildingCount > 0 && (
            <div className="col-span-2 mt-0.5">
              <span className="text-text-tertiary">Bldgs: </span>
              <span className="font-mono text-text-secondary">
                {c.buildingCount} (mean {c.meanBuildingHeight.toFixed(1)} m)
              </span>
            </div>
          )}
          {c.conversionLayers.length > 0 && (
            <div className="col-span-2 mt-0.5">
              <span className="text-text-tertiary">Layers: </span>
              <span className="text-text-secondary">
                {c.conversionLayers.join(", ")}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Active layer highlight */}
      <div className="px-3 py-2.5 bg-surface-3/80 border-b border-accent-blue/25 animate-fade-in">
        <div className="text-2xs text-accent-blue/80 font-semibold uppercase tracking-wider mb-1">
          {LAYER_LABELS[activeLayer]}
        </div>
        <div className="text-2xl font-mono font-bold text-accent-cyan tabular-nums">
          {(
            c[activeLayer as keyof SimCell] as number | undefined
          )?.toFixed(4) ?? "—"}
        </div>
        {/* Gradient bar for active layer value */}
        {typeof c[activeLayer as keyof SimCell] === "number" && (
          <div className="h-1 bg-surface-4 rounded overflow-hidden mt-2">
            <div
              className="h-full rounded bg-gradient-to-r from-accent-cyan to-blue-400 transition-all"
              style={{
                width: `${Math.min(
                  ((c[activeLayer as keyof SimCell] as number) ?? 0) * 100,
                  100
                ).toFixed(1)}%`,
              }}
            />
          </div>
        )}
      </div>

      {/* Power Potential */}
      <SectionHeader title="Power Potential" />
      <MetricRow
        label="Power Potential"
        value={c.powerPotential}
        description="RF × RED × CR × SA"
        highlight
        color="cyan"
      />
      <MetricRow
        label="PPGR — Minimal Mode"
        value={c.ppgrMinimal}
        description="ΔPP / |ΔBC|"
        highlight
        color="blue"
      />
      <MetricRow
        label="PPGR — Coupled Mode"
        value={c.ppgrCoupled}
        description="BCUR × IGR × CCE × BRR"
        highlight
        color="orange"
      />
      {c.isNewState && (
        <div className="mx-3 my-1.5 px-2 py-1 bg-accent-purple/15 border border-accent-purple/30 rounded text-2xs text-purple-300 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse-glow" />
          New Distinguishable State
        </div>
      )}

      {/* Source proxies */}
      <SectionHeader title="Source-Term Proxies" />
      <MetricRow label="Solar Exposure Proxy" value={c.solarExposure} color="yellow" />
      <MetricRow label="Wind Accessibility Proxy" value={c.windAccessibility} color="cyan" />
      <MetricRow label="Thermal Differential Proxy" value={c.thermalDifferential} color="orange" />
      <MetricRow label="Movement-Coupled Event Proxy" value={c.movementCoupledEvent} color="green" />
      <MetricRow
        label="Resource Flux"
        value={c.resourceFlux}
        description="Weighted composite"
        color="blue"
      />

      {/* Power components */}
      <SectionHeader title="Power Components" />
      <MetricRow
        label="Reachable Energetic Difference"
        value={c.reachableEnergeticDifference}
        description="sigmoid(contrast × accessibility)"
      />
      <MetricRow
        label="Conversion Realizability"
        value={c.conversionRealizability}
        description="Layer × source-type fit"
      />
      <MetricRow
        label="Systemic Availability"
        value={c.systemicAvailability}
        description="Graph reach to storage"
      />

      {/* BC dynamics */}
      <SectionHeader title="Boundary-Condition Dynamics" />
      <MetricRow
        label="BC Updating Rate"
        value={c.boundaryConditionUpdatingRate}
        description="|ΔBC vector| normalised"
      />
      <MetricRow
        label="Information Generation Rate"
        value={c.informationGenerationRate}
        description="α·new_states + β·new_transitions"
      />
      <MetricRow
        label="Conversion-Coupling Efficiency"
        value={c.conversionCouplingEfficiency}
        description="Source–layer match quality"
      />
      <MetricRow
        label="Broadcast Reach Rate"
        value={c.broadcastReachRate}
        description="Propagation quality to endpoints"
      />

      {/* Footnote */}
      <div className="px-3 py-3 text-2xs text-text-tertiary leading-relaxed border-t border-border mt-1">
        <strong className="text-text-secondary">Reduced-order model.</strong>{" "}
        All values are dimensionless proxies in [0, 1] computed from simplified
        geometric and network approximations.
      </div>
    </aside>
  );
}
