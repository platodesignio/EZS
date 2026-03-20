// =============================================================================
// API request / response types with Zod schemas for runtime validation
// =============================================================================

import { z } from "zod";

// ---------------------------------------------------------------------------
// Project endpoints
// ---------------------------------------------------------------------------

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

// ---------------------------------------------------------------------------
// Scenario endpoints
// ---------------------------------------------------------------------------

export const CreateScenarioSchema = z.object({
  projectId: z.string().cuid(),
  name: z.string().min(1).max(200),
  isBaseline: z.boolean().default(false),
  buildingsGeoJson: z.any().optional(),
  envParams: z.any().optional(),
  simParams: z.any().optional(),
  boundaryConditions: z.any().optional(),
  attractorNodes: z.array(z.any()).optional(),
  storageNodes: z.array(z.any()).optional(),
});
export type CreateScenarioInput = z.infer<typeof CreateScenarioSchema>;

export const UpdateScenarioSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  isBaseline: z.boolean().optional(),
  buildingsGeoJson: z.any().optional(),
  envParams: z.any().optional(),
  simParams: z.any().optional(),
  boundaryConditions: z.any().optional(),
  attractorNodes: z.array(z.any()).optional(),
  storageNodes: z.array(z.any()).optional(),
});
export type UpdateScenarioInput = z.infer<typeof UpdateScenarioSchema>;

// ---------------------------------------------------------------------------
// Simulate endpoint
// ---------------------------------------------------------------------------

export const SimulateRequestSchema = z.object({
  scenarioId: z.string().cuid(),
  /** ID of the baseline run to compare against (for PPGR computation) */
  baselineRunId: z.string().nullable().optional(),
});
export type SimulateRequest = z.infer<typeof SimulateRequestSchema>;

// ---------------------------------------------------------------------------
// Feedback endpoint
// ---------------------------------------------------------------------------

export const FeedbackSchema = z.object({
  /** Public run ID (the runId string, not database id) */
  runId: z.string().min(1),
  comment: z.string().min(1).max(5000),
  rating: z.number().int().min(1).max(5).optional(),
});
export type FeedbackInput = z.infer<typeof FeedbackSchema>;

// ---------------------------------------------------------------------------
// Generic API response envelope
// ---------------------------------------------------------------------------

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: string;
  details?: unknown;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
