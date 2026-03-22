"use client";

import React, { useState, useMemo } from "react";
import clsx from "clsx";
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

// ---------------------------------------------------------------------------
// SummaryCard
// ---------------------------------------------------------------------------

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
  const arrow =
    delta !== undefined
      ? delta > 0.00005
        ? "▲"
        : delta < -0.00005
          ? "▼"
          : "—"
      : null;
  return (
    <div className="bg-surface-3 border border-border rounded p-2 hover:border-text-tertiary transition-colors">
      <div className="metric-label mb-1">{label}</div>
      <div className="metric-value text-sm">{value.toFixed(4)}</div>
      {delta !== undefined && arrow && (
        <div
          className={clsx(
            "text-2xs font-mono mt-0.5 flex items-center gap-0.5",
            delta > 0.00005
              ? "text-accent-green"
              : delta < -0.00005
                ? "text-red-400"
                : "text-text-tertiary"
          )}
        >
          <span>{arrow}</span>
          <span>
            {sign}
            {Math.abs(delta).toFixed(4)}
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MiniBarChart — pure SVG, no recharts
// ---------------------------------------------------------------------------

interface BarItem {
  name: string;
  ppgr: number;
  pp: number;
}

function MiniBarChart({ data, label }: { data: BarItem[]; label: string }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const W = 100;
  const H = 80;
  const PAD = { top: 8, right: 4, bottom: 14, left: 26 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const maxVal = Math.max(...data.map((d) => d.ppgr), 0.001);
  const scale = maxVal * 1.25; // leave headroom above max bar
  const barW = chartW / data.length - 1.2;

  const yTickValues = [0, 0.25, 0.5, 0.75, 1.0].filter((t) => t <= scale + 0.05);

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="text-2xs text-text-tertiary mb-1 uppercase tracking-wider">
        {label}
      </div>
      <div className="flex-1 relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-full"
          style={{ maxHeight: 152 }}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="bgc" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="1" />
              <stop offset="100%" stopColor="#0891b2" stopOpacity="0.45" />
            </linearGradient>
            <linearGradient id="bgch" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="1" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.65" />
            </linearGradient>
          </defs>

          {/* Gridlines + Y-axis ticks */}
          {yTickValues.map((t) => {
            const y = PAD.top + chartH - (t / scale) * chartH;
            return (
              <g key={t}>
                <line
                  x1={PAD.left}
                  y1={y}
                  x2={W - PAD.right}
                  y2={y}
                  stroke="#2a3040"
                  strokeWidth="0.4"
                  strokeDasharray={t === 0 ? "none" : "2,2"}
                />
                <text
                  x={PAD.left - 2}
                  y={y + 1.5}
                  textAnchor="end"
                  fontSize="4.5"
                  fill="#64748b"
                >
                  {t.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* X-axis baseline */}
          <line
            x1={PAD.left}
            y1={PAD.top + chartH}
            x2={W - PAD.right}
            y2={PAD.top + chartH}
            stroke="#2a3040"
            strokeWidth="0.5"
          />

          {/* Bars */}
          {data.map((d, i) => {
            const barH = Math.max((d.ppgr / scale) * chartH, 1);
            const x = PAD.left + i * (chartW / data.length) + 0.6;
            const y = PAD.top + chartH - barH;
            const isHov = hovered === i;
            return (
              <g
                key={d.name}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              >
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={barH}
                  fill={isHov ? "url(#bgch)" : "url(#bgc)"}
                  rx="1"
                />
                {isHov && (
                  <text
                    x={x + barW / 2}
                    y={y - 2}
                    textAnchor="middle"
                    fontSize="4"
                    fill="#e2e8f0"
                  >
                    {d.ppgr.toFixed(3)}
                  </text>
                )}
              </g>
            );
          })}

          {/* X label */}
          <text
            x={PAD.left + chartW / 2}
            y={H - 1}
            textAnchor="middle"
            fontSize="4"
            fill="#475569"
          >
            Top {data.length} hotspot cells
          </text>
        </svg>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MiniRadarChart — pure SVG, no recharts
// ---------------------------------------------------------------------------

interface RadarItem {
  metric: string;
  baseline: number;
  active: number;
}

function MiniRadarChart({ data, label }: { data: RadarItem[]; label: string }) {
  const CX = 50;
  const CY = 43;
  const R = 33;
  const n = data.length;
  const levels = [0.25, 0.5, 0.75, 1.0];

  function polar(angle: number, r: number) {
    return {
      x: CX + r * Math.sin(angle),
      y: CY - r * Math.cos(angle),
    };
  }

  function polygonPoints(values: number[]) {
    return values
      .map((v, i) => {
        const a = (2 * Math.PI * i) / n;
        const p = polar(a, Math.min(Math.max(v, 0), 1) * R);
        return `${p.x},${p.y}`;
      })
      .join(" ");
  }

  const axes = Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    return {
      tip: polar(a, R),
      lbl: polar(a, R + 9),
      metric: data[i].metric,
    };
  });

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="text-2xs text-text-tertiary mb-1 uppercase tracking-wider">
        {label}
      </div>
      <div className="flex-1 relative">
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full"
          style={{ maxHeight: 152 }}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="radarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.25" />
            </linearGradient>
          </defs>

          {/* Level rings */}
          {levels.map((l) => (
            <polygon
              key={l}
              points={polygonPoints(Array(n).fill(l))}
              fill="none"
              stroke="#2a3040"
              strokeWidth={l === 1.0 ? "0.7" : "0.4"}
            />
          ))}

          {/* Axis spokes */}
          {axes.map((ax, i) => (
            <line
              key={i}
              x1={CX}
              y1={CY}
              x2={ax.tip.x}
              y2={ax.tip.y}
              stroke="#2a3040"
              strokeWidth="0.5"
            />
          ))}

          {/* Baseline polygon */}
          {data.some((d) => d.baseline > 0) && (
            <polygon
              points={polygonPoints(data.map((d) => d.baseline))}
              fill="#14b8a6"
              fillOpacity="0.12"
              stroke="#14b8a6"
              strokeWidth="0.9"
              strokeLinejoin="round"
            />
          )}

          {/* Active polygon */}
          <polygon
            points={polygonPoints(data.map((d) => d.active))}
            fill="url(#radarGrad)"
            stroke="#3b82f6"
            strokeWidth="0.9"
            strokeLinejoin="round"
          />

          {/* Axis labels */}
          {axes.map((ax, i) => (
            <text
              key={i}
              x={ax.lbl.x}
              y={ax.lbl.y + 1.5}
              textAnchor="middle"
              fontSize="4"
              fill="#94a3b8"
            >
              {data[i].metric}
            </text>
          ))}

          {/* Legend */}
          <rect x="2" y="94" width="5" height="2.5" fill="#14b8a6" fillOpacity="0.6" rx="0.5" />
          <text x="9" y="96.5" fontSize="3.5" fill="#94a3b8">Baseline</text>
          <rect x="34" y="94" width="5" height="2.5" fill="#3b82f6" fillOpacity="0.7" rx="0.5" />
          <text x="41" y="96.5" fontSize="3.5" fill="#94a3b8">Active</text>
        </svg>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main BottomPanel component
// ---------------------------------------------------------------------------

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

  const hotspots = useMemo(
    () =>
      activeRun?.summary
        ? rankingMode === "minimal"
          ? activeRun.summary.hotspotsMinimal
          : activeRun.summary.hotspotsCoupled
        : [],
    [activeRun, rankingMode]
  );

  const radarData = useMemo<RadarItem[]>(
    () =>
      activeRun?.summary
        ? [
            {
              metric: "Pwr Pot.",
              baseline: baselineRun?.summary.meanPowerPotential ?? 0,
              active: activeRun.summary.meanPowerPotential,
            },
            {
              metric: "Res Flux",
              baseline: baselineRun?.summary.meanResourceFlux ?? 0,
              active: activeRun.summary.meanResourceFlux,
            },
            {
              metric: "PPGR Min",
              baseline: baselineRun?.summary.meanPPGRMinimal ?? 0,
              active: activeRun.summary.meanPPGRMinimal,
            },
            {
              metric: "PPGR Cpl",
              baseline: baselineRun?.summary.meanPPGRCoupled ?? 0,
              active: activeRun.summary.meanPPGRCoupled,
            },
          ]
        : [],
    [activeRun, baselineRun]
  );

  const barData = useMemo<BarItem[]>(
    () =>
      hotspots
        .slice(0, 10)
        .map((h) => ({ name: h.cellId, ppgr: h.ppgr, pp: h.powerPotential })),
    [hotspots]
  );

  return (
    <div
      className={clsx(
        "h-64 bg-surface-1 border-t border-border flex flex-col",
        publicationMode && "publication-mode"
      )}
    >
      {/* Tab bar */}
      <div className="flex items-center border-b border-border bg-surface-2 px-3 gap-4 shrink-0">
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
          <span className="text-2xs text-text-tertiary">Rank:</span>
          {(["minimal", "coupled"] as RankingMode[]).map((mode) => (
            <button
              key={mode}
              className={clsx(
                "text-2xs px-2 py-0.5 rounded border transition-colors capitalize",
                rankingMode === mode
                  ? mode === "minimal"
                    ? "border-accent-cyan text-accent-cyan bg-surface-3"
                    : "border-accent-orange text-accent-orange bg-surface-3"
                  : "border-border text-text-tertiary hover:border-text-tertiary"
              )}
              onClick={() => onRankingModeChange(mode)}
            >
              {mode}
            </button>
          ))}
          <button
            className="btn-secondary text-2xs px-2 py-0.5"
            onClick={onExportCSV}
            disabled={!activeRun}
          >
            ↓ CSV
          </button>
        </div>
      </div>

      {/* Content area */}
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
                  <tr className="border-b border-border bg-surface-2 text-text-tertiary text-2xs sticky top-0">
                    <th className="px-3 py-1.5 text-left font-semibold">Rank</th>
                    <th className="px-3 py-1.5 text-left font-semibold">Cell ID</th>
                    <th className="px-3 py-1.5 text-right font-semibold">
                      PPGR ({rankingMode === "minimal" ? "Min" : "Cpl"})
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
          <div className="h-full flex gap-4 p-3">
            {barData.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-text-tertiary text-xs">
                No chart data. Run a simulation first.
              </div>
            ) : (
              <>
                <MiniBarChart
                  data={barData}
                  label={`Top Hotspot PPGR — ${rankingMode} mode`}
                />
                {radarData.length > 0 && baselineRun && (
                  <MiniRadarChart
                    data={radarData}
                    label="Scenario Comparison"
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
