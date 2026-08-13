import type { ZodIssue } from "zod";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly fields?: Record<string, string>;

  public constructor(
    statusCode: number,
    code: string,
    message: string,
    fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.fields = fields;
  }
}

export const zodIssuesToFields = (issues: ZodIssue[]): Record<string, string> =>
  issues.reduce<Record<string, string>>((fields, issue) => {
    const key = issue.path.join(".") || "form";
    if (!fields[key]) fields[key] = issue.message;
    return fields;
  }, {});
