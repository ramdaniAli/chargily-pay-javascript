export interface ChargilyApiErrorBody {
  message: string;
  errors?: Record<string, string[]>;
}

export class ChargilyApiError extends Error {
  public readonly status: number;
  public readonly statusText: string;
  public readonly body: ChargilyApiErrorBody | null;

  constructor(status: number, statusText: string, body: ChargilyApiErrorBody | null) {
    const message = body?.message
      ? `Chargily API error ${status}: ${body.message}`
      : `Chargily API error ${status}: ${statusText}`;
    super(message);
    this.name = 'ChargilyApiError';
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

export class ChargilyNetworkError extends Error {
  public readonly cause?: Error;

  constructor(message: string, cause?: Error) {
    super(`Chargily network error: ${message}`);
    this.name = 'ChargilyNetworkError';
    this.cause = cause;
  }
}
