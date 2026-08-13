import { getRecord, getString, isRecord } from "../types";

export class ApiError extends Error {
  readonly status: number;
  readonly fields: Record<string, string>;

  constructor(status: number, message: string, fields: Record<string, string> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fields = fields;
  }
}

function getFieldErrors(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<Record<string, string>>((fields, [key, item]) => {
    if (typeof item === "string") {
      fields[key] = item;
    } else if (Array.isArray(item) && typeof item[0] === "string") {
      fields[key] = item[0];
    }
    return fields;
  }, {});
}

function extractError(
  payload: unknown,
  fallback: string,
): { message: string; fields: Record<string, string> } {
  const error = getRecord(payload, "error") ?? (isRecord(payload) ? payload : undefined);
  if (!error) {
    return { message: fallback, fields: {} };
  }

  const details = getRecord(error, "details") ?? getRecord(error, "fields");
  return {
    message: getString(error.message, fallback),
    fields: getFieldErrors(details),
  };
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return response.ok
      ? { data: text }
      : { error: { message: "The service returned an unexpected response." } };
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers,
      credentials: "include",
    });
  } catch {
    throw new ApiError(0, "We could not reach the service. Check your connection and try again.");
  }

  const payload = await readBody(response);
  if (!response.ok) {
    const error = extractError(payload, "Something went wrong. Please try again.");
    throw new ApiError(response.status, error.message, error.fields);
  }

  if (isRecord(payload) && "data" in payload) {
    return payload.data as T;
  }

  return payload as T;
}

export function apiMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function apiFieldErrors(error: unknown): Record<string, string> {
  return error instanceof ApiError ? error.fields : {};
}

export function queryString(values: Record<string, string | number | undefined>): string {
  const parameters = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      parameters.set(key, String(value));
    }
  });

  const query = parameters.toString();
  return query ? `?${query}` : "";
}
