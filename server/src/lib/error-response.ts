/**
 * Enhanced error response utilities with field-level validation details.
 * Provides consistent error formatting and user-friendly validation messages.
 */

import { ZodError } from "zod";

/**
 * Detailed error response format
 */
export interface DetailedErrorResponse {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
    details?: {
      timestamp: string;
      path?: string;
      traceId?: string;
    };
  };
}

/**
 * Maps Zod validation errors to field-level error messages.
 * Converts ZodError format to user-friendly field error dictionary.
 *
 * @param error - ZodError from schema validation
 * @returns Record of field names to error messages
 *
 * @example
 * try {
 *   schema.parse(data);
 * } catch (error) {
 *   if (error instanceof ZodError) {
 *     const fieldErrors = mapZodErrors(error);
 *     // { email: "Invalid email format", password: "Password too short" }
 *   }
 * }
 */
export function mapZodErrors(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const issue of error.issues) {
    const path = issue.path.join(".");
    const message = getFriendlyValidationMessage(issue);
    fields[path] = message;
  }

  return fields;
}

/**
 * Converts Zod error codes to friendly, user-facing messages.
 * Hides technical details and provides actionable feedback.
 *
 * @param issue - Individual Zod validation issue
 * @returns User-friendly error message
 */
function getFriendlyValidationMessage(issue: unknown): string {
  const zodIssue = issue as {
    code: string;
    message: string;
    path: unknown[];
    [key: string]: unknown;
  };

  switch (zodIssue.code) {
    case "invalid_type":
      return `Expected ${(zodIssue as unknown as Record<string, unknown>).expected}, received ${(zodIssue as unknown as Record<string, unknown>).received}`;
    case "too_small":
      return `Must be at least ${(zodIssue as unknown as Record<string, unknown>).minimum} characters`;
    case "too_big":
      return `Must not exceed ${(zodIssue as unknown as Record<string, unknown>).maximum} characters`;
    case "invalid_string":
      return `Invalid ${(zodIssue as unknown as Record<string, unknown>).validation} format`;
    case "invalid_enum_value":
      return `Must be one of: ${((zodIssue as unknown as Record<string, unknown>).options as string[]).join(", ")}`;
    case "unrecognized_keys":
      return `Unexpected field(s): ${((zodIssue as unknown as Record<string, unknown>).keys as string[]).join(", ")}`;
    case "invalid_literal":
      return `Must be exactly ${(zodIssue as unknown as Record<string, unknown>).expected}`;
    default:
      return zodIssue.message || "Invalid value";
  }
}

/**
 * Creates a standardized error response with field-level details.
 * Use this for validation errors that need to be sent to the client.
 *
 * @param code - Error code (e.g., "VALIDATION_ERROR")
 * @param message - User-friendly error message
 * @param fields - Optional field-level error details
 * @returns Standardized error response
 *
 * @example
 * res.status(400).json(createDetailedErrorResponse(
 *   "VALIDATION_ERROR",
 *   "Please fix the following validation errors",
 *   { email: "Invalid email format" }
 * ));
 */
export function createDetailedErrorResponse(
  code: string,
  message: string,
  fields?: Record<string, string>,
  path?: string,
): DetailedErrorResponse {
  return {
    error: {
      code,
      message,
      ...(fields && Object.keys(fields).length > 0 ? { fields } : {}),
      details: {
        timestamp: new Date().toISOString(),
        ...(path ? { path } : {}),
      },
    },
  };
}

/**
 * Validates an object against a Zod schema and returns detailed errors if validation fails.
 * Throws an AppError with field details on validation failure.
 *
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Validated and typed data
 *
 * @throws AppError with field-level details if validation fails
 *
 * @example
 * const validatedData = validateWithDetails(userSchema, userData);
 */
export function validateWithDetails<T>(schema: { parse: (data: unknown) => T }, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      const fields = mapZodErrors(error);
      const fieldList = Object.entries(fields)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ");

      const err = new Error(`Validation failed: ${fieldList}`);
      (err as unknown as Record<string, unknown>).fields = fields;
      (err as unknown as Record<string, unknown>).code = "VALIDATION_ERROR";
      throw err;
    }
    throw error;
  }
}

/**
 * Formats an error object with context for logging and debugging.
 * Includes stack trace and metadata without exposing sensitive details.
 *
 * @param error - Error to format
 * @param context - Additional context (e.g., endpoint, userId)
 * @returns Formatted error object safe for logging
 *
 * @example
 * try {
 *   // operation
 * } catch (error) {
 *   logger.error("Operation failed", formatErrorForLogging(error, { endpoint: "/api/users", userId: "123" }));
 * }
 */
export function formatErrorForLogging(
  error: unknown,
  context?: Record<string, unknown>,
): Record<string, unknown> {
  const isError = error instanceof Error;

  return {
    name: isError ? error.name : typeof error,
    message: isError ? error.message : String(error),
    stack: isError && process.env.NODE_ENV !== "production" ? error.stack : undefined,
    ...context,
  };
}

/**
 * Creates a safe error message for sending to clients.
 * Removes sensitive details like file paths and stack traces.
 *
 * @param error - Error to sanitize
 * @param defaultMessage - Message to use if error details can't be determined
 * @returns Safe message for client display
 *
 * @example
 * const safeMessage = sanitizeErrorForClient(error, "Something went wrong");
 */
export function sanitizeErrorForClient(
  error: unknown,
  defaultMessage = "An error occurred",
): string {
  if (error instanceof Error) {
    // Remove file paths and other sensitive details from error message
    const message = error.message
      .replace(/\/[\w/]*(?:server|app|config)[\w/]*/gi, "[internal]")
      .replace(/at [\w.]+/g, "")
      .trim();

    return message.length > 0 ? message : defaultMessage;
  }

  return defaultMessage;
}
