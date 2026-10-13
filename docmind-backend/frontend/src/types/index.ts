export type DocumentStatus = "UPLOADING" | "PROCESSING" | "INDEXED" | "FAILED";
export type SearchKind = "all" | "clauses" | "concepts" | "facts";
export type NoticeKind = "error" | "success" | "info";

export interface Notice {
  kind: NoticeKind;
  message: string;
}

export interface DocumentMetadata {
  id: string;
  filename: string;
  contentType: string;
  fileSize: number;
  totalPages: number | null;
  totalChunks: number | null;
  status: DocumentStatus;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UploadedDocument {
  id: string;
  fileName: string;
  fileSize: number;
  status: DocumentStatus;
  chunksCreated: number;
  message: string;
}

export interface Citation {
  documentId: string | null;
  fileName: string;
  chunkIndex: number | null;
  pageNumber: number | null;
  snippet: string;
  similarityScore: number | null;
  metadata: Record<string, unknown> | null;
}

export interface ChatResponse {
  answer: string;
  conversationId: string;
  citations: Citation[];
  responseTimeMs: number;
}

export interface SearchResult {
  query: string;
  totalMatches: number;
  matches: Citation[];
}

export interface ApiEnvelope<T> {
  success: boolean;
  message: string | null;
  data: T;
  timestamp: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  responseTimeMs?: number;
  error?: boolean;
  sourceError?: string;
}
