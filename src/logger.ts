/**
 * Logger interface for ChargilyClient.
 * Implement this interface to receive debug logs from the SDK.
 * Compatible with console, winston, pino, etc.
 */
export interface ChargilyLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/**
 * A no-op logger that silently discards all messages.
 * Used as default when no logger is provided.
 */
export const noopLogger: ChargilyLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};
