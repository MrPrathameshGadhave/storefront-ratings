/**
 * Structured logging utility for consistent and traceable application logging.
 * Logs are formatted for easy parsing and analysis in production environments.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private isDevelopment = process.env.NODE_ENV !== "production";

  private formatLog(entry: LogEntry): string {
    return JSON.stringify(entry);
  }

  private log(level: LogLevel, message: string, context?: LogContext | Error): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };

    if (context instanceof Error) {
      entry.error = {
        name: context.name,
        message: context.message,
        stack: this.isDevelopment ? context.stack : undefined,
      };
    } else if (context) {
      entry.context = context;
    }

    const formatted = this.formatLog(entry);

    // In development, add some color to console output (basic ANSI codes)
    if (this.isDevelopment) {
      const levelColors: Record<LogLevel, string> = {
        debug: "\x1b[36m", // Cyan
        info: "\x1b[32m", // Green
        warn: "\x1b[33m", // Yellow
        error: "\x1b[31m", // Red
      };
      const reset = "\x1b[0m";
      console.log(`${levelColors[level]}[${level.toUpperCase()}]${reset} ${message}`, context);
    } else {
      // In production, output structured JSON logs
      console.log(formatted);
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log("debug", message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log("info", message, context);
  }

  warn(message: string, context?: LogContext | Error): void {
    this.log("warn", message, context);
  }

  error(message: string, context?: LogContext | Error): void {
    this.log("error", message, context);
  }
}

export const logger = new Logger();
