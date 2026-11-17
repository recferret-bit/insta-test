import {
  ERROR_HTTP_STATUS,
  type ErrorCode,
  type ErrorResponseDto,
  type ValidationIssueDto,
} from "@insta/contracts";
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { hasZodFastifySchemaValidationErrors, isResponseSerializationError } from "fastify-type-provider-zod";
import { ZodError } from "zod";

import { isDomainError } from "../domain/shared/errors.js";

/**
 * Central error mapping (`F-CORE-05`, specs/02-architecture-and-patterns.md#error-handling):
 * DomainError → its code; ZodError / schema validation → 400; unknown route → 404;
 * Fastify client errors → closest catalog code; anything else → 500 with a generic message.
 */

const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_FAILED: "Request validation failed",
  UNAUTHENTICATED: "Authentication required",
  INVALID_CREDENTIALS: "Invalid credentials",
  FORBIDDEN: "Forbidden",
  NOT_FOUND: "Not found",
  USERNAME_TAKEN: "Username is already taken",
  EMAIL_TAKEN: "Email is already registered",
  PAYLOAD_TOO_LARGE: "Payload too large",
  UNSUPPORTED_MEDIA_TYPE: "Unsupported media type",
  MEDIA_INVALID: "Media is invalid",
  CANNOT_FOLLOW_SELF: "You cannot follow yourself",
  RATE_LIMITED: "Too many requests",
  INTERNAL: "Internal server error",
};

const STATUS_TO_CODE: Record<number, ErrorCode> = {
  400: "VALIDATION_FAILED",
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  413: "PAYLOAD_TOO_LARGE",
  415: "UNSUPPORTED_MEDIA_TYPE",
  429: "RATE_LIMITED",
};

export function buildErrorBody(
  request: FastifyRequest,
  code: ErrorCode,
  message: string = DEFAULT_MESSAGES[code],
  details?: ValidationIssueDto[],
): ErrorResponseDto {
  return {
    error: {
      code,
      message,
      ...(code === "VALIDATION_FAILED" && details && details.length > 0 ? { details } : {}),
      request_id: request.id,
    },
  };
}

function zodPath(path: (string | number)[]): string {
  return path.map(String).join(".");
}

function isIssueList(value: unknown): value is ValidationIssueDto[] {
  return (
    Array.isArray(value) &&
    value.every(
      (d) =>
        typeof d === "object" &&
        d !== null &&
        typeof (d as ValidationIssueDto).path === "string" &&
        typeof (d as ValidationIssueDto).message === "string",
    )
  );
}

function sendError(
  reply: FastifyReply,
  request: FastifyRequest,
  code: ErrorCode,
  message?: string,
  details?: ValidationIssueDto[],
): FastifyReply {
  return reply
    .code(ERROR_HTTP_STATUS[code])
    .type("application/json; charset=utf-8")
    .send(buildErrorBody(request, code, message, details));
}

export function errorHandler(
  this: FastifyInstance,
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
): FastifyReply {
  if (isDomainError(error)) {
    if (error.code === "INTERNAL") {
      request.log.error({ err: error }, "internal domain error");
      return sendError(reply, request, "INTERNAL");
    }
    return sendError(
      reply,
      request,
      error.code,
      error.message,
      isIssueList(error.details) ? error.details : undefined,
    );
  }

  if (hasZodFastifySchemaValidationErrors(error)) {
    const details = error.validation.map((v) => ({
      path: zodPath(v.params.issue.path),
      message: v.params.issue.message,
    }));
    return sendError(reply, request, "VALIDATION_FAILED", undefined, details);
  }

  if (error instanceof ZodError) {
    const details = error.issues.map((i) => ({ path: zodPath(i.path), message: i.message }));
    return sendError(reply, request, "VALIDATION_FAILED", undefined, details);
  }

  if (isResponseSerializationError(error)) {
    request.log.error({ err: error }, "response failed contract validation");
    return sendError(reply, request, "INTERNAL");
  }

  const status = (error as FastifyError).statusCode;
  if (typeof status === "number" && status >= 400 && status < 500) {
    const code = STATUS_TO_CODE[status] ?? "VALIDATION_FAILED";
    // Fastify's own client-error messages are safe (no internals); keep catalog defaults for clarity.
    const message = code === "VALIDATION_FAILED" ? error.message || undefined : undefined;
    return sendError(reply, request, code, message);
  }

  request.log.error({ err: error }, "unhandled error");
  return sendError(reply, request, "INTERNAL");
}

export function notFoundHandler(request: FastifyRequest, reply: FastifyReply): FastifyReply {
  return sendError(reply, request, "NOT_FOUND", "Route not found");
}
