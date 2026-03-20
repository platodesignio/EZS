// =============================================================================
// Prisma seed script — creates demo project and scenarios
// Run: pnpm db:seed
// =============================================================================

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Inlined defaults from @/types/simulation
// ---------------------------------------------------------------------------

const DEFAULT_SIM_PARAMS = {
  cellSize: 20,
  dayOfYear: 172,
  latitude: 35.68,
  igrAlpha: 0.7,
  igrBeta: 0.3,
  stateThreshold: 0.1,
  weights: {
    solar: 0.4,
    wind: 0.2,
    thermal: 0.2,
    movement: 0.2,
  },
};

const DEFAULT_BOUNDARY_CONDITIONS = {
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
// Main seed function
// ---------------------------------------------------------------------------

async function main() {
  console.log("Seeding database…");

  try {
  // Read GeoJSON from disk (path relative to process.cwd() = project root)
  const geojsonPath = path.join(
    process.cwd(),
    "public",
    "demo",
    "district.geojson"
  );
  const geojsonRaw = fs.readFileSync(geojsonPath, "utf-8");
  const buildingsGeoJson = JSON.parse(geojsonRaw);

  // ------------------------------------------------------------------
  // 1. Create the demo project
  // ------------------------------------------------------------------
  const project = await prisma.project.create({
    data: {
      name: "Demo District — Tokyo Grid",
      description:
        "A demonstration mixed-use urban district in central Tokyo used to showcase the Generative Power Space Explorer simulation pipeline.",
      siteExtent: {
        minLng: 139.688,
        minLat: 35.687,
        maxLng: 139.6946,
        maxLat: 35.7003,
      },
      centroid: {
        lng: 139.6913,
        lat: 35.6937,
      },
    },
  });

  console.log(`Created project: ${project.id} — "${project.name}"`);

  // ------------------------------------------------------------------
  // 2. Baseline scenario
  // ------------------------------------------------------------------
  const baselineScenario = await prisma.scenario.create({
    data: {
      projectId: project.id,
      name: "Baseline",
      isBaseline: true,
      buildingsGeoJson,
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
        {
          id: "a1",
          lng: 139.692,
          lat: 35.6905,
          weight: 1.0,
          label: "Transit Hub",
        },
        {
          id: "a2",
          lng: 139.690,
          lat: 35.688,
          weight: 0.7,
          label: "Commercial Center",
        },
      ],
      storageNodes: [
        {
          id: "s1",
          lng: 139.693,
          lat: 35.691,
          label: "Grid Storage A",
        },
        {
          id: "s2",
          lng: 139.690,
          lat: 35.688,
          label: "Grid Storage B",
        },
      ],
    },
  });

  console.log(
    `Created baseline scenario: ${baselineScenario.id} — "${baselineScenario.name}"`
  );

  // ------------------------------------------------------------------
  // 3. Intervention scenario — Solar Optimized
  // ------------------------------------------------------------------
  const solarOptimizedBCs = {
    ...DEFAULT_BOUNDARY_CONDITIONS,
    windChannelOpenness: 0.8,
    solarConditionProfile: "clear",
    conversionSurfaceAssignment: [
      "photovoltaic",
      "thermoelectric",
      "hybrid",
    ],
  };

  const interventionScenario = await prisma.scenario.create({
    data: {
      projectId: project.id,
      name: "Solar Optimized Intervention",
      isBaseline: false,
      buildingsGeoJson,
      envParams: {
        latitude: 35.6895,
        longitude: 139.6917,
        windSpeed: 3.5,
        windDirection: 225,
        ambientTempC: 15,
      },
      simParams: DEFAULT_SIM_PARAMS,
      boundaryConditions: solarOptimizedBCs,
      attractorNodes: [
        {
          id: "a1",
          lng: 139.692,
          lat: 35.6905,
          weight: 1.0,
          label: "Transit Hub",
        },
        {
          id: "a2",
          lng: 139.690,
          lat: 35.688,
          weight: 0.7,
          label: "Commercial Center",
        },
      ],
      storageNodes: [
        {
          id: "s1",
          lng: 139.693,
          lat: 35.691,
          label: "Grid Storage A",
        },
        {
          id: "s2",
          lng: 139.690,
          lat: 35.688,
          label: "Grid Storage B",
        },
      ],
    },
  });

  console.log(
    `Created intervention scenario: ${interventionScenario.id} — "${interventionScenario.name}"`
  );

  console.log("Seeding complete.");
  } catch (err) {
    console.error("Seed failed:", err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
