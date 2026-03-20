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
// Metric row component
// ---------------------------------------------------------------------------

function MetricRow({
  label,
  value,
  description,
  highlight,
}: {
  label: string;
  value: number | string;
  description?: string;
  highlight?: boolean;
}) {
  const numValue = typeof value === "number" ? value : null;
  const displayValue =
    numValue !== null ? numValue.toFixed(4) : String(value);

  // Colour the bar by value intensity
  const barWidth = numValue !== null ? `${(numValue * 100).toFixed(1)}%` : "0%";
  const barColor =
    numValue !== null
      ? numValue > 0.7
        ? "bg-accent-green"
        : numValue > 0.4
          ? "bg-accent-yellow"
          : "bg-accent-blue"
      : "bg-surface-4";

  return (
    <div
      className={clsx(
        "px-3 py-2 border-b border-border/50",
        highlight && "bg-surface-3"
      )}
    >
      <div className="flex justify-between items-baseline mb-0.5">
        <span className="text-2xs text-text-secondary leading-tight">{label}</span>
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
            className={clsx("h-full rounded transition-all", barColor)}
            style={{ width: barWidth }}
          />
        </div>
      )}
      {description && (
        <div className="text-2xs text-text-tertiary mt-0.5 leading-tight">
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
    <div className="px-3 py-1.5 bg-surface-2 border-b border-border">
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
        <div className="flex-1 flex items-center justify-center text-text-tertiary text-xs p-4 text-center">
          Click a cell on the map to inspect its metrics.
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
      <div className="panel-section sticky top-0 z-10">
        Cell Inspector — {c.id}
      </div>

      {/* Cell metadata */}
      <div className="px-3 py-2 border-b border-border bg-surface-2/50">
        <div className="grid grid-cols-2 gap-x-3 text-2xs">
          <div>
            <span className="text-text-tertiary">Grid: </span>
            <span className="font-mono text-text-secondary">
              r{c.row} c{c.col}
            </span>
          </div>
          <div>
            <span className="text-text-tertiary">Type: </span>
            <span className={clsx(
              "font-semibold",
              c.isBuilding ? "text-red-400" : "text-accent-teal"
            )}>
              {c.isBuilding ? "Building" : "Open"}
            </span>
          </div>
          <div className="col-span-2">
            <span className="text-text-tertiary">Coords: </span>
            <span className="font-mono text-text-secondary">
              {c.lng.toFixed(5)}, {c.lat.toFixed(5)}
            </span>
          </div>
          {c.buildingCount > 0 && (
            <div className="col-span-2">
              <span className="text-text-tertiary">Bldgs: </span>
              <span className="font-mono text-text-secondary">
                {c.buildingCount} (mean {c.meanBuildingHeight.toFixed(1)} m)
              </span>
            </div>
          )}
          {c.conversionLayers.length > 0 && (
            <div className="col-span-2">
              <span className="text-text-tertiary">Layers: </span>
              <span className="text-text-secondary">
                {c.conversionLayers.join(", ")}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Active layer highlight */}
      <div className="px-3 py-2 bg-surface-3 border-b border-accent-blue/30">
        <div className="text-2xs text-accent-blue font-semibold uppercase tracking-wider mb-1">
          Active Layer
        </div>
        <div className="text-2xs text-text-secondary mb-0.5">
          {LAYER_LABELS[activeLayer]}
        </div>
        <div className="text-xl font-mono font-bold text-accent-cyan">
          {(c[activeLayer as keyof SimCell] as number | undefined)?.toFixed(4) ?? "—"}
        </div>
      </div>

      {/* Power Potential */}
      <SectionHeader title="Power Potential" />
      <MetricRow
        label="Power Potential"
        value={c.powerPotential}
        description="RF × RED × CR × SA"
        highlight
      />
      <MetricRow
        label="PPGR — Minimal Mode"
        value={c.ppgrMinimal}
        description="ΔPP / |ΔBC|"
        highlight
      />
      <MetricRow
        label="PPGR — Coupled Mode"
        value={c.ppgrCoupled}
        description="BCUR × IGR × CCE × BRR"
        highlight
      />
      {c.isNewState && (
        <div className="mx-3 my-1 px-2 py-1 bg-accent-purple/20 border border-accent-purple/30 rounded text-2xs text-purple-300">
          ● New Distinguishable State
        </div>
      )}

      {/* Source proxies */}
      <SectionHeader title="Source-Term Proxies" />
      <MetricRow label="Solar Exposure Proxy" value={c.solarExposure} />
      <MetricRow label="Wind Accessibility Proxy" value={c.windAccessibility} />
      <MetricRow label="Thermal Differential Proxy" value={c.thermalDifferential} />
      <MetricRow label="Movement-Coupled Event Proxy" value={c.movementCoupledEvent} />
      <MetricRow label="Resource Flux" value={c.resourceFlux} description="Weighted composite" />

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

      <div className="px-3 py-2 text-2xs text-text-tertiary leading-relaxed">
        <strong className="text-text-secondary">Reduced-order model.</strong> All
        values are dimensionless proxies in [0, 1] computed from simplified
        geometric and network approximations. Not absolute physical quantities.
      </div>
    </aside>
  );
}
