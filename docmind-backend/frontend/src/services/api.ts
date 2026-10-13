import type {
  ApiEnvelope,
  ChatResponse,
  Citation,
  DocumentMetadata,
  SearchResult,
  UploadedDocument,
} from "../types";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export interface ChatPayload {
  question: string;
  documentId: string | null;
  topK: number;
  minSimilarity: number;
  conversationId: string;
}

export interface SearchPayload {
  query: string;
  documentId: string | null;
  topK: number;
  similaritySearch: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function responseError(response: Response): Promise<ApiError> {
  let message = `Request failed (${response.status})`;
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null) {
      const record = body as Record<string, unknown>;
      const candidate = record.message ?? record.error ?? record.detail;
      if (typeof candidate === "string" && candidate.trim()) {
        message = candidate;
      }
    }
  } catch {
    // Keep the HTTP status message when the server does not return JSON.
  }
  return new ApiError(message, response.status);
}

async function getData<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw await responseError(response);
  }

  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (envelope.success === false) {
    throw new ApiError(envelope.message || "The server could not complete the request.");
  }
  if (envelope.data === undefined) {
    throw new ApiError("The server returned an unexpected response.");
  }
  return envelope.data;
}

export const api = {
  baseUrl: API_BASE_URL,

  async listDocuments(): Promise<DocumentMetadata[]> {
    return getData(
      await fetch(`${API_BASE_URL}/api/v1/documents`, {
        headers: { Accept: "application/json" },
      }),
    );
  },

  async getDocument(id: string): Promise<DocumentMetadata> {
    return getData(
      await fetch(`${API_BASE_URL}/api/v1/documents/${encodeURIComponent(id)}`),
    );
  },

  async deleteDocument(id: string): Promise<void> {
    await getData<null>(
      await fetch(`${API_BASE_URL}/api/v1/documents/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    );
  },

  uploadFiles(
    files: File[],
    onProgress: (progress: number) => void,
  ): Promise<UploadedDocument[]> {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      const formData = new FormData();
      const multiple = files.length > 1;

      for (const file of files) {
        formData.append(multiple ? "files" : "file", file);
      }

      request.open(
        "POST",
        `${API_BASE_URL}/api/v1/documents/${multiple ? "upload-multiple" : "upload"}`,
      );
      request.setRequestHeader("Accept", "application/json");
      request.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
        }
      });
      request.addEventListener("error", () => {
        reject(new ApiError("Could not reach the server. Check that the backend is running."));
      });
      request.addEventListener("abort", () => {
        reject(new ApiError("The upload was cancelled."));
      });
      request.addEventListener("load", () => {
        if (request.status < 200 || request.status >= 300) {
          let message = `Upload failed (${request.status})`;
          try {
            const body: unknown = JSON.parse(request.responseText);
            if (typeof body === "object" && body !== null) {
              const record = body as Record<string, unknown>;
              const candidate = record.message ?? record.error ?? record.detail;
              if (typeof candidate === "string" && candidate.trim()) {
                message = candidate;
              }
            }
          } catch {
            // Keep the HTTP status message when the server does not return JSON.
          }
          reject(new ApiError(message, request.status));
          return;
        }

        try {
          const envelope = JSON.parse(request.responseText) as ApiEnvelope<
            UploadedDocument | UploadedDocument[]
          >;
          if (envelope.success === false || envelope.data === undefined) {
            reject(new ApiError(envelope.message || "The server returned an unexpected response."));
            return;
          }
          resolve(Array.isArray(envelope.data) ? envelope.data : [envelope.data]);
        } catch {
          reject(new ApiError("The server returned an unreadable upload response."));
        }
      });
      request.send(formData);
    });
  },

  async ask(payload: ChatPayload): Promise<ChatResponse> {
    return getData(
      await fetch(`${API_BASE_URL}/api/v1/chat/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      }),
    );
  },

  async stream(
    payload: ChatPayload,
    onToken: (token: string) => void,
    signal: AbortSignal,
  ): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/v1/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(payload),
      signal,
    });
    if (!response.ok) {
      throw await responseError(response);
    }
    if (!response.body) {
      throw new ApiError("The browser could not read the streaming response.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let completed = false;
    const processFrame = (frame: string): void => {
      const data = frame
        .replace(/\r/g, "")
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).replace(/^ /, ""))
        .join("\n");
      if (!data) {
        return;
      }
      if (data === "[DONE]") {
        completed = true;
        return;
      }
      onToken(data);
    };

    while (!completed) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let boundary = buffer.search(/\r?\n\r?\n/);
      while (boundary >= 0) {
        const frame = buffer.slice(0, boundary);
        const separator = buffer.slice(boundary).match(/^\r?\n\r?\n/)?.[0] ?? "\n\n";
        buffer = buffer.slice(boundary + separator.length);
        processFrame(frame);
        if (completed) {
          break;
        }
        boundary = buffer.search(/\r?\n\r?\n/);
      }
      if (done) {
        if (buffer.trim()) {
          processFrame(buffer);
        }
        break;
      }
    }
    await reader.cancel();
  },

  async search(payload: SearchPayload): Promise<SearchResult> {
    return getData(
      await fetch(`${API_BASE_URL}/api/v1/chat/search/similarity`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      }),
    );
  },

  async searchDocumentChunks(
    query: string,
    documentId: string,
  ): Promise<Citation[]> {
    const result = await this.search({
      query,
      documentId,
      topK: 10,
      similaritySearch: 0,
    });
    return result.matches;
  },
};

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "—";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}
