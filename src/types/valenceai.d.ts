declare module "valenceai" {
  export class ValenceSDKError extends Error {}

  export class AudioTooShortError extends ValenceSDKError {
    minDuration: number | null;
    actualDuration: number | null;
  }

  export class AudioTooLongError extends ValenceSDKError {
    maxDuration: number | null;
    actualDuration: number | null;
  }

  export class FileSizeLimitExceededError extends ValenceSDKError {
    maxSizeMb: number | null;
    actualSizeMb: number | null;
  }

  export class ValenceClient {
    constructor(options?: {
      apiKey?: string;
      baseUrl?: string;
      websocketUrl?: string;
      logLevel?: string;
      partSize?: number;
      maxRetries?: number;
      comprehensiveOutput?: boolean;
    });

    discrete: {
      emotions(
        filePath?: string | null,
        audioArray?: number[] | null,
        model?: "4emotions" | "7emotions",
      ): Promise<unknown>;
    };

    asynch: {
      upload(filePath: string): Promise<string>;
      emotions(
        requestId: string,
        maxAttempts?: number,
        intervalSeconds?: number,
      ): Promise<unknown>;
    };

    streaming: {
      connect(model?: "4emotions" | "7emotions"): unknown;
    };

    rateLimit: {
      getStatus(): Promise<unknown>;
    };
  }

  export function validateConfig(config?: unknown): void;
}
