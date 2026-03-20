"use client";

import React, { useState } from "react";
import clsx from "clsx";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  Legend,
} from "recharts";
import type { SimCell, RunSummary, RankingMode } from "@/types/simulation";

interface BottomPanelProps {
  baselineRun: { cells: SimCell[]; summary: RunSummary; runId: string } | null;
  activeRun: { cells: SimCell[]; summary: RunSummary; runId: string } | null;
  rankingMode: RankingMode;
  publicationMode: boolean;
  onRankingModeChange: (mode: RankingMode) => void;
  onCellSelect: (cellId: string) => void;
  onExportCSV: () => void;
}

type PanelTab = "comparison" | "hotspots" | "charts";

function SummaryCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: number;
  delta?: number;
}) {
  const sign = delta !== undefined ? (delta >= 0 ? "+" : "") : "";
  return (
    <div className="bg-surface-3 border border-border rounded p-2">
      <div className="metric-label mb-1">{label}</div>
      <div className="metric-value">{value.toFixed(4)}</div>
      {delta !== undefined && (
        <div
          className={clsx(
            "text-2xs font-mono mt-0.5",
            delta > 0 ? "text-accent-green" : delta < 0 ? "text-red-400" : "text-text-tertiary"
          )}
        >
          {sign}{delta.toFixed(4)}
        </div>
      )}
    </div>
  );
}

export function BottomPanel({
  baselineRun,
  activeRun,
  rankingMode,
  publicationMode,
  onRankingModeChange,
  onCellSelect,
  onExportCSV,
}: BottomPanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>("comparison");

  const hotspots =
    activeRun?.summary
      ? rankingMode === "minimal"
        ? activeRun.summary.hotspotsMinimal
        : activeRun.summary.hotspotsCoupled
      : [];

  // Build comparison radar data
  const radarData = activeRun?.summary
    ? [
        {
          metric: "Power Pot.",
          baseline: baselineRun?.summary.meanPowerPotential ?? 0,
          active: activeRun.summary.meanPowerPotential,
        },
        {
          metric: "Resource Flux",
          baseline: baselineRun?.summary.meanResourceFlux ?? 0,
          active: activeRun.summary.meanResourceFlux,
        },
        {
          metric: "PPGR Min.",
          baseline: baselineRun?.summary.meanPPGRMinimal ?? 0,
          active: activeRun.summary.meanPPGRMinimal,
        },
        {
          metric: "PPGR Coupled",
          baseline: baselineRun?.summary.meanPPGRCoupled ?? 0,
          active: activeRun.summary.meanPPGRCoupled,
        },
      ]
    : [];

  // Bar chart: top 10 hotspot PPGRs
  const barData = hotspots.slice(0, 10).map((h) => ({
    name: h.cellId,
    ppgr: h.ppgr,
    pp: h.powerPotential,
  }));

  return (
    <div
      className={clsx(
        "h-64 bg-surface-1 border-t border-border flex flex-col",
        publicationMode && "publication-mode"
      )}
    >
      {/* Tabs */}
      <div className="flex items-center border-b border-border bg-surface-2 px-3 gap-4">
        {(["comparison", "hotspots", "charts"] as PanelTab[]).map((t) => (
          <button
            key={t}
            className={clsx(
              "py-2 text-2xs font-semibold uppercase tracking-wider border-b-2 transition-colors",
              activeTab === t
                ? "border-accent-cyan text-accent-cyan"
                : "border-transparent text-text-tertiary hover:text-text-secondary"
            )}
            onClick={() => setActiveTab(t)}
          >
            {t === "comparison"
              ? "Baseline vs. Intervention"
              : t === "hotspots"
                ? "Hotspot Ranking"
                : "Charts"}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-2xs text-text-tertiary">Rank by:</span>
          <button
            className={clsx(
              "text-2xs px-2 py-0.5 rounded border transition-colors",
              rankingMode === "minimal"
                ? "border-accent-cyan text-accent-cyan bg-surface-3"
                : "border-border text-text-tertiary hover:border-text-tertiary"
            )}
            onClick={() => onRankingModeChange("minimal")}
          >
            Minimal
          </button>
          <button
            className={clsx(
              "text-2xs px-2 py-0.5 rounded border transition-colors",
              rankingMode === "coupled"
                ? "border-accent-orange text-accent-orange bg-surface-3"
                : "border-border text-text-tertiary hover:border-text-tertiary"
            )}
            onClick={() => onRankingModeChange("coupled")}
          >
            Coupled
          </button>
          <button
            className="btn-secondary text-2xs px-2 py-0.5"
            onClick={onExportCSV}
            disabled={!activeRun}
          >
            ↓ CSV
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {/* COMPARISON TAB */}
        {activeTab === "comparison" && (
          <div className="h-full p-3 overflow-y-auto">
            {!activeRun ? (
              <div className="flex items-center justify-center h-full text-text-tertiary text-xs">
                Run a simulation to see comparison data.
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                <SummaryCard
                  label="Mean Power Potential"
                  value={activeRun.summary.meanPowerPotential}
                  delta={
                    baselineRun
                      ? activeRun.summary.meanPowerPotential -
                        baselineRun.summary.meanPowerPotential
                      : undefined
                  }
                />
                <SummaryCard
                  label="Max Power Potential"
                  value={activeRun.summary.maxPowerPotential}
                  delta={
                    baselineRun
                      ? activeRun.summary.maxPowerPotential -
                        baselineRun.summary.maxPowerPotential
                      : undefined
                  }
                />
                <SummaryCard
                  label="Mean PPGR (Minimal)"
                  value={activeRun.summary.meanPPGRMinimal}
                  delta={
                    baselineRun
                      ? activeRun.summary.meanPPGRMinimal -
                        baselineRun.summary.meanPPGRMinimal
                      : undefined
                  }
                />
                <SummaryCard
                  label="Mean PPGR (Coupled)"
                  value={activeRun.summary.meanPPGRCoupled}
                  delta={
                    baselineRun
                      ? activeRun.summary.meanPPGRCoupled -
                        baselineRun.summary.meanPPGRCoupled
                      : undefined
                  }
                />
                <SummaryCard
                  label="Mean Resource Flux"
                  value={activeRun.summary.meanResourceFlux}
                  delta={
                    baselineRun
                      ? activeRun.summary.meanResourceFlux -
                        baselineRun.summary.meanResourceFlux
                      : undefined
                  }
                />
                <SummaryCard
                  label="New Distinguishable States"
                  value={activeRun.summary.newStateCount}
                />
                <SummaryCard
                  label="Active Cells"
                  value={activeRun.summary.activeCells}
                />
                <SummaryCard
                  label="Total Cells"
                  value={activeRun.summary.totalCells}
                />
              </div>
            )}
          </div>
        )}

        {/* HOTSPOTS TAB */}
        {activeTab === "hotspots" && (
          <div className="h-full overflow-y-auto">
            {hotspots.length === 0 ? (
              <div className="flex items-center justify-center h-full text-text-tertiary text-xs">
                No hotspot data. Run a simulation first.
              </div>
            ) : (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface-2 text-text-tertiary text-2xs">
                    <th className="px-3 py-1.5 text-left font-semibold">Rank</th>
                    <th className="px-3 py-1.5 text-left font-semibold">Cell ID</th>
                    <th className="px-3 py-1.5 text-right font-semibold">
                      PPGR ({rankingMode === "minimal" ? "Min" : "Coupled"})
                    </th>
                    <th className="px-3 py-1.5 text-right font-semibold">
                      Power Potential
                    </th>
                    <th className="px-3 py-1.5 text-right font-semibold">Lng</th>
                    <th className="px-3 py-1.5 text-right font-semibold">Lat</th>
                  </tr>
                </thead>
                <tbody>
                  {hotspots.map((h) => (
                    <tr
                      key={h.cellId}
                      className="border-b border-border/50 hover:bg-surface-2 cursor-pointer transition-colors"
                      onClick={() => onCellSelect(h.cellId)}
                    >
                      <td className="px-3 py-1 font-mono text-accent-yellow">
                        #{h.rank}
                      </td>
                      <td className="px-3 py-1 font-mono text-text-secondary">
                        {h.cellId}
                      </td>
                      <td className="px-3 py-1 font-mono text-right text-accent-cyan">
                        {h.ppgr.toFixed(4)}
                      </td>
                      <td className="px-3 py-1 font-mono text-right text-text-primary">
                        {h.powerPotential.toFixed(4)}
                      </td>
                      <td className="px-3 py-1 font-mono text-right text-text-tertiary">
                        {h.lng.toFixed(5)}
                      </td>
                      <td className="px-3 py-1 font-mono text-right text-text-tertiary">
                        {h.lat.toFixed(5)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* CHARTS TAB */}
        {activeTab === "charts" && (
          <div className="h-full flex gap-2 p-2">
            {barData.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-text-tertiary text-xs">
                No chart data. Run a simulation first.
              </div>
            ) : (
              <>
                {/* Bar chart: PPGR by hotspot */}
                <div className="flex-1">
                  <div className="text-2xs text-text-tertiary mb-1 uppercase tracking-wider">
                    Top Hotspot PPGR ({rankingMode})
                  </div>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={barData} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
                      <XAxis dataKey="name" tick={false} />
                      <YAxis tick={{ fontSize: 9, fill: "#64748b" }} domain={[0, 1]} />
                      <Tooltip
                        contentStyle={{
                          background: "#181c22",
                          border: "1px solid #2a3040",
                          borderRadius: 4,
                          fontSize: 11,
                          color: "#f1f5f9",
                        }}
                        formatter={(v: number) => v.toFixed(4)}
                      />
                      <Bar dataKey="ppgr" fill="#06b6d4" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Radar: baseline vs. active */}
                {radarData.length > 0 && baselineRun && (
                  <div className="flex-1">
                    <div className="text-2xs text-text-tertiary mb-1 uppercase tracking-wider">
                      Scenario Comparison
                    </div>
                    <ResponsiveContainer width="100%" height={160}>
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="#2a3040" />
                        <PolarAngleAxis
                          dataKey="metric"
                          tick={{ fontSize: 9, fill: "#64748b" }}
                        />
                        <Radar
                          name="Baseline"
                          dataKey="baseline"
                          stroke="#14b8a6"
                          fill="#14b8a6"
                          fillOpacity={0.15}
                        />
                        <Radar
                          name="Active"
                          dataKey="active"
                          stroke="#3b82f6"
                          fill="#3b82f6"
                          fillOpacity={0.25}
                        />
                        <Legend wrapperStyle={{ fontSize: 9, color: "#94a3b8" }} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
