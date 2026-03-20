// =============================================================================
// Export utilities — CSV export for simulation runs
// =============================================================================

import type { SimCell, RunSummary } from "@/types/simulation";

/**
 * Convert simulation cell data to CSV string.
 * All numeric values are rounded to 4 decimal places for readability.
 */
export function cellsToCSV(cells: SimCell[], runId: string): string {
  const headers = [
    "run_id",
    "cell_id",
    "row",
    "col",
    "lng",
    "lat",
    "is_building",
    "building_count",
    "mean_building_height_m",
    "solar_exposure_proxy",
    "wind_accessibility_proxy",
    "thermal_differential_proxy",
    "movement_coupled_event_proxy",
    "resource_flux",
    "reachable_energetic_difference",
    "conversion_realizability",
    "systemic_availability",
    "boundary_condition_updating_rate",
    "information_generation_rate",
    "conversion_coupling_efficiency",
    "broadcast_reach_rate",
    "power_potential",
    "ppgr_minimal_mode",
    "ppgr_coupled_mode",
    "conversion_layers",
    "is_new_state",
  ];

  const rows = cells.map((c) =>
    [
      runId,
      c.id,
      c.row,
      c.col,
      c.lng.toFixed(6),
      c.lat.toFixed(6),
      c.isBuilding ? "1" : "0",
      c.buildingCount,
      round4(c.meanBuildingHeight),
      round4(c.solarExposure),
      round4(c.windAccessibility),
      round4(c.thermalDifferential),
      round4(c.movementCoupledEvent),
      round4(c.resourceFlux),
      round4(c.reachableEnergeticDifference),
      round4(c.conversionRealizability),
      round4(c.systemicAvailability),
      round4(c.boundaryConditionUpdatingRate),
      round4(c.informationGenerationRate),
      round4(c.conversionCouplingEfficiency),
      round4(c.broadcastReachRate),
      round4(c.powerPotential),
      round4(c.ppgrMinimal),
      round4(c.ppgrCoupled),
      `"${c.conversionLayers.join("|")}"`,
      c.isNewState ? "1" : "0",
    ].join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}

/**
 * Generate a summary CSV row for a simulation run.
 */
export function summaryToCSV(summary: RunSummary, runId: string): string {
  const headers = [
    "run_id",
    "total_cells",
    "active_cells",
    "mean_power_potential",
    "max_power_potential",
    "min_power_potential",
    "mean_ppgr_minimal",
    "max_ppgr_minimal",
    "mean_ppgr_coupled",
    "max_ppgr_coupled",
    "mean_resource_flux",
    "new_state_count",
  ];

  const row = [
    runId,
    summary.totalCells,
    summary.activeCells,
    round4(summary.meanPowerPotential),
    round4(summary.maxPowerPotential),
    round4(summary.minPowerPotential),
    round4(summary.meanPPGRMinimal),
    round4(summary.maxPPGRMinimal),
    round4(summary.meanPPGRCoupled),
    round4(summary.maxPPGRCoupled),
    round4(summary.meanResourceFlux),
    summary.newStateCount,
  ];

  return [headers.join(","), row.join(",")].join("\n");
}

function round4(n: number): string {
  return isFinite(n) ? n.toFixed(4) : "0.0000";
}
