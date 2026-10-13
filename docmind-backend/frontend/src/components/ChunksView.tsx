import { CalendarDays, FileSearch, FileText, Layers3, LoaderCircle, MessageCircle, Search, Trash2, X } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import type { Citation, DocumentMetadata } from "../types";
import { displayName, getStatusClasses } from "../utils";
import { formatBytes, formatDate } from "../services/api";
import { ChunkCard, EmptyState, ModalShell } from "./Shared";

export default function ChunksView({
  document,
  loading,
  query,
  onQueryChange,
  chunks,
  searching,
  deleting,
  onSearch,
  onDelete,
  onClose,
  onChat,
}: {
  document: DocumentMetadata;
  loading: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  chunks: Citation[] | null;
  searching: boolean;
  deleting: boolean;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: () => void;
  onClose: () => void;
  onChat: () => void;
}) {
  return (
    <ModalShell onClose={onClose} labelledBy="document-title" wide>
      <div className="flex items-start justify-between gap-4 border-b border-[#edf0eb] px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#e7f1e6] text-[#3e7951]">
            <FileText size={19} />
          </span>
          <div className="min-w-0">
            <h2 id="document-title" className="truncate text-[15px] font-semibold text-[#2d4436]">{displayName(document)}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[#8a968d]">
              <span className="max-w-[180px] truncate sm:max-w-[280px]">{document.id}</span>
              <span className="size-1 rounded-full bg-[#cbd3ca]" />
              <span className={`rounded-full px-2 py-0.5 font-semibold ${getStatusClasses(document.status)}`}>{document.status}</span>
            </p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[#8d998f] transition hover:bg-[#f1f4ef] hover:text-[#3c5344]" aria-label="Close document details">
          <X size={17} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2.5 border-b border-[#edf0eb] bg-[#fcfdfa] px-5 py-4 sm:grid-cols-4 sm:px-6">
        <StatCard label="File size" value={formatBytes(document.fileSize)} icon={<FileText size={13} />} />
        <StatCard label="Vector chunks" value={`${document.totalChunks ?? 0} chunks`} icon={<Layers3 size={14} />} />
        <StatCard label="Total pages" value={`${document.totalPages ?? "—"} pages`} icon={<FileText size={13} />} />
        <StatCard label="Uploaded" value={formatDate(document.createdAt)} icon={<CalendarDays size={13} />} />
      </div>
      <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5 sm:px-6">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#738278]">Inspect vector chunks</h3>
          <p className="mt-1 text-[10px] text-[#99a39b]">Search to preview the most relevant indexed chunks.</p>
        </div>
        {loading && <LoaderCircle size={15} className="animate-spin text-[#74887a]" />}
      </div>
      <form onSubmit={onSearch} className="flex gap-2 px-5 pb-4 sm:px-6">
        <label className="relative min-w-0 flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#96a198]" />
          <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search within this document's chunks…" className="h-10 w-full rounded-xl border border-[#e0e7df] bg-white pl-9 pr-3 text-xs text-[#41574a] outline-none placeholder:text-[#a1aaa2] focus:border-[#8dae94]" />
        </label>
        <button type="submit" disabled={!query.trim() || searching} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-[#dce5dc] bg-white px-3 text-[11px] font-semibold text-[#4d6855] transition hover:bg-[#f4f8f2] disabled:opacity-50">
          {searching ? <LoaderCircle size={13} className="animate-spin" /> : <Search size={13} />}
          Search
        </button>
      </form>
      <div className="scrollbar-subtle max-h-[min(42vh,390px)] min-h-[150px] space-y-2.5 overflow-y-auto border-t border-[#edf0eb] bg-[#fafbf8] px-5 py-4 sm:px-6">
        {searching ? (
          <div className="flex min-h-[145px] flex-col items-center justify-center text-center">
            <LoaderCircle size={19} className="animate-spin text-[#548565]" />
            <p className="mt-2 text-[11px] text-[#87938a]">Finding relevant chunks…</p>
          </div>
        ) : chunks ? (
          chunks.length ? chunks.map((chunk, index) => (
            <ChunkCard key={`${chunk.documentId}-${chunk.chunkIndex}-${index}`} citation={chunk} />
          )) : <EmptyState icon={<FileSearch size={21} />} title="No matching chunks" message="Try another phrase from the document." />
        ) : (
          <EmptyState icon={<Layers3 size={22} />} title={`${document.totalChunks ?? 0} chunks indexed`} message="Search this document to preview the most relevant indexed chunks." />
        )}
      </div>
      <div className="flex flex-col-reverse justify-between gap-3 border-t border-[#edf0eb] px-5 py-4 sm:flex-row sm:items-center sm:px-6">
        <button type="button" onClick={onDelete} disabled={deleting} className="inline-flex items-center gap-1.5 self-start px-1 py-2 text-xs font-semibold text-[#b45545] transition hover:text-[#943c30] disabled:opacity-50">
          {deleting ? <LoaderCircle size={14} className="animate-spin" /> : <Trash2 size={14} />}
          Delete document
        </button>
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-[#e1e7df] bg-white px-4 py-2.5 text-xs font-semibold text-[#647469] transition hover:bg-[#f7f9f6]">Close</button>
          <button type="button" onClick={onChat} className="inline-flex items-center gap-1.5 rounded-xl bg-[#286746] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#20583a]">
            <MessageCircle size={14} />
            Chat with document
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-xl border border-[#e7ece5] bg-white px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[10px] text-[#87938a]">{icon}{label}</p>
      <p className="mt-1 truncate text-[11px] font-semibold text-[#46594c]">{value}</p>
    </div>
  );
}
