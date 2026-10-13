import { Check, FileText, Layers3, LoaderCircle, Search, UploadCloud } from "lucide-react";
import { useMemo, useState } from "react";
import { formatBytes } from "../services/api";
import type { DocumentMetadata } from "../types";
import { displayName, getStatusClasses } from "../utils";

export default function Sidebar({
  documents,
  loading,
  connected,
  onUpload,
  onOpenDocument,
  onScopeAll,
}: {
  documents: DocumentMetadata[];
  loading: boolean;
  connected: boolean | null;
  onUpload: () => void;
  onOpenDocument: (document: DocumentMetadata) => void;
  onScopeAll: () => void;
}) {
  const [filter, setFilter] = useState("");
  const filteredDocuments = useMemo(() => {
    const query = filter.trim().toLowerCase();
    return query
      ? documents.filter((document) => displayName(document).toLowerCase().includes(query))
      : documents;
  }, [documents, filter]);

  return (
    <aside className="hidden w-[294px] shrink-0 flex-col border-r border-[#e5e9e2] bg-[#fbfcf8] md:flex">
      <div className="border-b border-[#edf0eb] px-4 pb-4 pt-5">
        <h2 className="text-[13px] font-semibold text-[#344a3d]">Knowledge base</h2>
        <p className="mt-0.5 mb-3 text-[11px] text-[#8c988f]">Your indexed documents</p>
        <button
          type="button"
          onClick={onUpload}
          className="group flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-[#b8c9bb] bg-[#f5f8f3] px-4 py-4 text-center transition hover:border-[#669675] hover:bg-[#eff5ed]"
        >
          <span className="mb-2 flex size-9 items-center justify-center rounded-xl bg-[#e4f0e5] text-[#34724a] transition group-hover:bg-[#d9eadb]">
            <UploadCloud size={19} />
          </span>
          <span className="text-xs font-semibold text-[#356b48]">Add documents</span>
          <span className="mt-1 text-[10px] text-[#87948a]">PDF, Word, Markdown, TXT, CSV</span>
        </button>
      </div>

      <div className="px-3 pt-3">
        <button
          type="button"
          onClick={onScopeAll}
          className="flex w-full items-center justify-between rounded-xl border border-[#cadccb] bg-[#edf5ec] px-3 py-2.5 text-left text-[#2f6744]"
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-lg bg-white/80">
              <Layers3 size={15} />
            </span>
            <span>
              <span className="block text-xs font-semibold">All documents</span>
              <span className="mt-0.5 block text-[10px] text-[#8a988d]">
                Search across your library
              </span>
            </span>
          </span>
          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-[#65756a]">
            {documents.length}
          </span>
        </button>
      </div>

      <div className="px-3 pb-2 pt-3">
        <label className="relative block">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#99a39b]" />
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter documents…"
            className="h-9 w-full rounded-lg border border-[#e7ebe5] bg-white pl-9 pr-3 text-xs text-[#31483b] outline-none placeholder:text-[#a1aaa2] focus:border-[#92b59a]"
          />
        </label>
      </div>

      <div className="flex items-center justify-between px-4 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#929e94]">
        <span>Documents</span>
        <span>Status</span>
      </div>
      <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {loading && documents.length === 0 ? (
          <div className="flex items-center justify-center gap-2 px-3 py-8 text-xs text-[#8a968d]">
            <LoaderCircle size={15} className="animate-spin" />
            Loading documents
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <FileText size={20} className="mx-auto text-[#b1bcb2]" />
            <p className="mt-2 text-xs font-medium text-[#718076]">
              {documents.length ? "No matching documents" : "No documents yet"}
            </p>
            <p className="mt-1 text-[10px] leading-4 text-[#9aa49b]">
              {documents.length ? "Try a different name." : "Upload files to build your knowledge base."}
            </p>
          </div>
        ) : (
          filteredDocuments.map((document) => (
            <button
              type="button"
              key={document.id}
              onClick={() => onOpenDocument(document)}
              className="group mb-1 flex w-full items-start gap-2.5 rounded-xl border border-transparent px-2.5 py-2.5 text-left transition hover:border-[#e7ece5] hover:bg-white"
            >
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#f0f3ee] text-[#738378]">
                <FileText size={14} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-semibold text-[#435448]">
                  {displayName(document)}
                </span>
                <span className="mt-1 flex items-center gap-1.5 text-[10px] text-[#909b91]">
                  <span>{formatBytes(document.fileSize)}</span>
                  <span className="size-0.5 rounded-full bg-[#bbc4bb]" />
                  <span>{document.totalPages ?? "—"} pages</span>
                </span>
                <span className="mt-2 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 text-[10px] text-[#89968b]">
                    <Layers3 size={11} />
                    {document.totalChunks ?? 0} chunks
                  </span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${getStatusClasses(document.status)}`}>
                    {document.status === "INDEXED" ? (
                      <span className="flex items-center gap-1"><Check size={10} /> Indexed</span>
                    ) : document.status.toLowerCase()}
                  </span>
                </span>
                {document.status === "FAILED" && document.errorMessage && (
                  <span className="mt-1 block text-[10px] leading-4 text-[#ac5948]">
                    {document.errorMessage}
                  </span>
                )}
              </span>
            </button>
          ))
        )}
      </div>
      <div className="border-t border-[#edf0eb] px-4 py-3 text-[10px] text-[#9aa49b]">
        <span className="inline-flex items-center gap-1.5">
          <span className={`size-1.5 rounded-full ${connected === null ? "bg-[#d2a44e]" : connected ? "bg-[#52a36b]" : "bg-[#c76c55]"}`} />
          {connected === null ? "Connecting to backend" : connected ? "Connected to your workspace" : "Backend connection unavailable"}
        </span>
      </div>
    </aside>
  );
}
