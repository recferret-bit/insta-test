import { z } from "zod";
import { ERROR_CODES } from "./error-codes.ts";

export { ERROR_CODES, ERROR_HTTP_STATUS, type ErrorCode } from "./error-codes.ts";

export const ErrorCodeSchema = z.enum(ERROR_CODES);

export const ErrorDetailDto = z.object({
  path: z.string(),
  message: z.string(),
});
export type ErrorDetailDto = z.infer<typeof ErrorDetailDto>;

/** Error envelope returned by every failing `/api/v1` request. `details` only for VALIDATION_FAILED. */
export const ErrorResponseDto = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    details: z.array(ErrorDetailDto).optional(),
    request_id: z.string(),
  }),
});
export type ErrorResponseDto = z.infer<typeof ErrorResponseDto>;
