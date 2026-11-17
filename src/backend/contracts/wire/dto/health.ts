import { z } from "zod";

/** `GET /healthz` (liveness). */
export const LivenessResponseDto = z.object({ status: z.literal("ok") });
export type LivenessResponseDto = z.infer<typeof LivenessResponseDto>;

/** `GET /api/v1/health` (readiness): 200 when DB reachable and migrations applied, else 503 degraded. */
export const ReadinessResponseDto = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ok"), db: z.literal("ok"), version: z.string() }),
  z.object({ status: z.literal("degraded"), db: z.literal("down") }),
]);
export type ReadinessResponseDto = z.infer<typeof ReadinessResponseDto>;
