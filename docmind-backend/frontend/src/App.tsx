import { AlertCircle } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import ChatView from "./components/ChatView";
import ChunksView from "./components/ChunksView";
import Navbar from "./components/Navbar";
import SearchView from "./components/SearchView";
import Sidebar from "./components/Sidebar";
import UploadDialog from "./components/UploadDialog";
import { Toast } from "./components/Shared";
import { useWorkspace } from "./context/WorkspaceContext";
import { api } from "./services/api";
import type {
  ChatMessage,
  Citation,
  DocumentMetadata,
  Notice,
  SearchKind,
  SearchResult,
  UploadedDocument,
} from "./types";
import { displayName, getErrorMessage, makeId } from "./utils";

function App() {
  const {
    documents,
    loading: documentsLoading,
    connected: apiStatus,
    error: apiError,
    refreshDocuments,
  } = useWorkspace();
  const [scopeId, setScopeId] = useState("all");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationId] = useState(makeId);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [detailDocument, setDetailDocument] = useState<DocumentMetadata | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [documentSearch, setDocumentSearch] = useState("");
  const [documentChunks, setDocumentChunks] = useState<Citation[] | null>(null);
  const [documentSearchLoading, setDocumentSearchLoading] = useState(false);
  const [deletingDocument, setDeletingDocument] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchKind, setSearchKind] = useState<SearchKind>("all");
  const [searchScopeId, setSearchScopeId] = useState("all");
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [copyingMessage, setCopyingMessage] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const activeStreamRef = useRef<AbortController | null>(null);

  const showNotice = useCallback((nextNotice: Notice) => {
    setNotice(nextNotice);
  }, []);

  useEffect(() => {
    const onGlobalKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
        setSearchResults(null);
      }
    };
    window.addEventListener("keydown", onGlobalKeyDown);
    return () => window.removeEventListener("keydown", onGlobalKeyDown);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(
    () => () => {
      activeStreamRef.current?.abort();
    },
    [],
  );

  const scopedDocument = useMemo(
    () => (scopeId === "all" ? null : documents.find((document) => document.id === scopeId) ?? null),
    [documents, scopeId],
  );

  const submitMessage = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const question = draft.trim();
    if (!question || sending) return;

    const documentId = scopeId === "all" ? null : scopeId;
    const assistantId = makeId();
    setMessages((current) => [
      ...current,
      { id: makeId(), role: "user", content: question },
      { id: assistantId, role: "assistant", content: "" },
    ]);
    setDraft("");
    setSending(true);

    const payload = {
      question,
      documentId,
      topK: 5,
      minSimilarity: 0,
      conversationId,
    };

    try {
      const controller = new AbortController();
      activeStreamRef.current = controller;
      let streamedAnswer = "";
      await api.stream(
        payload,
        (token) => {
          streamedAnswer += token;
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? { ...message, content: message.content + token }
                : message,
            ),
          );
        },
        controller.signal,
      );
      activeStreamRef.current = null;

      if (!streamedAnswer.trim()) {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  content: "The stream ended without returning an answer. Please try again.",
                  error: true,
                }
              : message,
          ),
        );
      } else {
        try {
          const response = await api.search({
            query: question,
            documentId,
            topK: 5,
            similaritySearch: 0,
          });
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId ? { ...message, citations: response.matches } : message,
            ),
          );
        } catch (error) {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? { ...message, sourceError: getErrorMessage(error) }
                : message,
            ),
          );
        }
      }
    } catch (error) {
      const message = getErrorMessage(error);
      setMessages((current) =>
        current.map((chatMessage) =>
          chatMessage.id === assistantId
            ? { ...chatMessage, content: message, error: true }
            : chatMessage,
        ),
      );
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        showNotice({ kind: "error", message: `Could not send message: ${message}` });
      }
    } finally {
      activeStreamRef.current = null;
      setSending(false);
    }
  };

  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitMessage();
    }
  };

  const openDocument = (document: DocumentMetadata) => {
    setDetailDocument(document);
    setDocumentSearch("");
    setDocumentChunks(null);
    setDetailLoading(true);
    void api
      .getDocument(document.id)
      .then((freshDocument) => {
        setDetailDocument((current) =>
          current?.id === freshDocument.id ? freshDocument : current,
        );
      })
      .catch((error: unknown) => {
        showNotice({
          kind: "error",
          message: `Could not refresh document details: ${getErrorMessage(error)}`,
        });
      })
      .finally(() => setDetailLoading(false));
  };

  const searchDocumentChunks = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!detailDocument || !documentSearch.trim()) return;
    setDocumentSearchLoading(true);
    setDocumentChunks(null);
    try {
      setDocumentChunks(
        await api.searchDocumentChunks(documentSearch.trim(), detailDocument.id),
      );
    } catch (error) {
      showNotice({
        kind: "error",
        message: `Could not search this document: ${getErrorMessage(error)}`,
      });
    } finally {
      setDocumentSearchLoading(false);
    }
  };

  const deleteDocument = async () => {
    if (!detailDocument) return;
    const name = displayName(detailDocument);
    if (!window.confirm(`Delete "${name}" and its indexed vector chunks?`)) return;
    setDeletingDocument(true);
    try {
      await api.deleteDocument(detailDocument.id);
      if (scopeId === detailDocument.id) setScopeId("all");
      setDetailDocument(null);
      showNotice({ kind: "success", message: `${name} was deleted.` });
      void refreshDocuments();
    } catch (error) {
      showNotice({
        kind: "error",
        message: `Could not delete document: ${getErrorMessage(error)}`,
      });
    } finally {
      setDeletingDocument(false);
    }
  };

  const searchVectors = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    setSearchLoading(true);
    setSearchResults(null);
    const focusQuery: Record<SearchKind, string> = {
      all: query,
      clauses: `${query}. Focus on clauses, terms, obligations, and exceptions.`,
      concepts: `${query}. Focus on concepts, definitions, and explanations.`,
      facts: `${query}. Focus on factual statements, dates, names, and figures.`,
    };
    try {
      setSearchResults(
        await api.search({
          query: focusQuery[searchKind],
          documentId: searchScopeId === "all" ? null : searchScopeId,
          topK: 10,
          similaritySearch: 0,
        }),
      );
    } catch (error) {
      showNotice({
        kind: "error",
        message: `Vector search failed: ${getErrorMessage(error)}`,
      });
    } finally {
      setSearchLoading(false);
    }
  };

  const copyMessage = async (message: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopyingMessage(message.id);
      window.setTimeout(() => setCopyingMessage(null), 1500);
    } catch {
      showNotice({
        kind: "error",
        message: "Clipboard access is unavailable in this browser.",
      });
    }
  };

  const handleNewUploads = async (uploaded: UploadedDocument[]) => {
    const refreshed = await refreshDocuments();
    const completed = uploaded.filter((item) => item.status === "INDEXED").length;
    if (completed > 0) {
      showNotice({
        kind: refreshed ? "success" : "info",
        message: refreshed
          ? `${completed} ${completed === 1 ? "document" : "documents"} indexed and ready to chat.`
          : `${completed} ${completed === 1 ? "document" : "documents"} uploaded. The document list could not refresh.`,
      });
    }
  };

  const getTemplate = (prompt: string) => {
    setDraft(prompt);
    composerRef.current?.focus();
  };

  return (
    <div className="flex h-dvh min-h-[640px] flex-col overflow-hidden bg-[#f7f8f3] text-[#18352a]">
      <Navbar
        documents={documents}
        scopeId={scopeId}
        onScopeChange={setScopeId}
        onUpload={() => setUploadOpen(true)}
        onSearch={() => {
          setSearchOpen(true);
          setSearchResults(null);
        }}
      />
      <div className="flex min-h-0 flex-1">
        <Sidebar
          documents={documents}
          loading={documentsLoading}
          connected={apiStatus}
          onUpload={() => setUploadOpen(true)}
          onOpenDocument={openDocument}
          onScopeAll={() => setScopeId("all")}
        />
        <main className="flex min-w-0 flex-1 flex-col">
          {apiStatus === false && (
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#f0d6ce] bg-[#fff5f1] px-4 py-2 text-xs text-[#985745] sm:px-6">
              <span className="flex min-w-0 items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span className="truncate">Could not load documents from the backend. {apiError}</span>
              </span>
              <button type="button" onClick={() => void refreshDocuments()} className="shrink-0 font-semibold underline underline-offset-2">
                Retry
              </button>
            </div>
          )}
          <ChatView
            messages={messages}
            draft={draft}
            onDraftChange={setDraft}
            onSubmit={(event) => void submitMessage(event)}
            onKeyDown={onComposerKeyDown}
            sending={sending}
            scopedDocument={scopedDocument}
            onTemplate={getTemplate}
            composerRef={composerRef}
            copyingMessage={copyingMessage}
            onCopy={(message) => void copyMessage(message)}
          />
        </main>
      </div>

      {uploadOpen && (
        <UploadDialog
          onClose={() => setUploadOpen(false)}
          onComplete={(uploaded) => void handleNewUploads(uploaded)}
        />
      )}
      {searchOpen && (
        <SearchView
          documents={documents}
          query={searchQuery}
          onQueryChange={setSearchQuery}
          kind={searchKind}
          onKindChange={setSearchKind}
          scopeId={searchScopeId}
          onScopeChange={setSearchScopeId}
          results={searchResults}
          loading={searchLoading}
          onSearch={(event) => void searchVectors(event)}
          onClose={() => setSearchOpen(false)}
        />
      )}
      {detailDocument && (
        <ChunksView
          document={detailDocument}
          loading={detailLoading}
          query={documentSearch}
          onQueryChange={setDocumentSearch}
          chunks={documentChunks}
          searching={documentSearchLoading}
          deleting={deletingDocument}
          onSearch={(event) => void searchDocumentChunks(event)}
          onDelete={() => void deleteDocument()}
          onClose={() => setDetailDocument(null)}
          onChat={() => {
            setScopeId(detailDocument.id);
            setDetailDocument(null);
            composerRef.current?.focus();
          }}
        />
      )}
      {notice && <Toast notice={notice} onClose={() => setNotice(null)} />}
    </div>
  );
}

export default App;
