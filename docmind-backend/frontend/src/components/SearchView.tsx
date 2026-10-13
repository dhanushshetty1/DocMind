import { FileSearch, LoaderCircle, Search, Sparkles, X } from "lucide-react";
import type { FormEvent } from "react";
import type { DocumentMetadata, SearchKind, SearchResult } from "../types";
import { displayName } from "../utils";
import { ChunkCard, EmptyState, ModalShell } from "./Shared";

const kinds: { value: SearchKind; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "clauses", label: "Clauses" },
  { value: "concepts", label: "Concepts" },
  { value: "facts", label: "Facts" },
];

export default function SearchView({
  documents,
  query,
  onQueryChange,
  kind,
  onKindChange,
  scopeId,
  onScopeChange,
  results,
  loading,
  onSearch,
  onClose,
}: {
  documents: DocumentMetadata[];
  query: string;
  onQueryChange: (query: string) => void;
  kind: SearchKind;
  onKindChange: (kind: SearchKind) => void;
  scopeId: string;
  onScopeChange: (scopeId: string) => void;
  results: SearchResult | null;
  loading: boolean;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  return (
    <ModalShell onClose={onClose} labelledBy="search-title" wide>
      <div className="flex items-center justify-between border-b border-[#edf0eb] px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-[#e7f1e6] text-[#3d7951]">
            <Search size={17} />
          </span>
          <div>
            <h2 id="search-title" className="text-[15px] font-semibold text-[#2d4436]">Search indexed chunks</h2>
            <p className="mt-0.5 text-[11px] text-[#8a968d]">Find clauses, concepts, and facts across your documents.</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="flex size-8 items-center justify-center rounded-lg text-[#8d998f] transition hover:bg-[#f1f4ef] hover:text-[#3c5344]" aria-label="Close search">
          <X size={17} />
        </button>
      </div>
      <form onSubmit={onSearch} className="border-b border-[#edf0eb] px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative min-w-0 flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8b998e]" />
            <input
              autoFocus
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search concepts, clauses, or facts…"
              className="h-11 w-full rounded-xl border border-[#dce5dc] bg-[#fcfdfa] pl-10 pr-3 text-sm text-[#405548] outline-none placeholder:text-[#a1aaa2] focus:border-[#80a78a] focus:ring-2 focus:ring-[#e8f1e6]"
            />
          </label>
          <button type="submit" disabled={!query.trim() || loading} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#286746] px-5 text-xs font-semibold text-white transition hover:bg-[#20583a] disabled:cursor-not-allowed disabled:bg-[#dce5dc] disabled:text-[#8c998e]">
            {loading ? <LoaderCircle size={15} className="animate-spin" /> : <Search size={15} />}
            Search
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {kinds.map((item) => (
              <button type="button" key={item.value} onClick={() => onKindChange(item.value)} className={`rounded-full px-3 py-1.5 text-[10px] font-semibold transition ${
                kind === item.value ? "bg-[#e5f0e4] text-[#34734b]" : "bg-[#f3f5f1] text-[#87938a] hover:bg-[#edf2eb]"
              }`}>
                {item.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-[10px] text-[#87938a]">
            In
            <select value={scopeId} onChange={(event) => onScopeChange(event.target.value)} className="max-w-[190px] rounded-lg border border-[#e3e9e1] bg-white px-2 py-1.5 text-[10px] font-medium text-[#526558]">
              <option value="all">All documents</option>
              {documents.map((document) => <option key={document.id} value={document.id}>{displayName(document)}</option>)}
            </select>
          </label>
        </div>
      </form>
      <div className="scrollbar-subtle max-h-[min(58vh,520px)] min-h-[210px] overflow-y-auto p-5 sm:px-6">
        {loading ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center text-center">
            <LoaderCircle size={22} className="animate-spin text-[#548565]" />
            <p className="mt-3 text-xs font-medium text-[#718076]">Searching vector chunks…</p>
          </div>
        ) : results ? (
          results.matches.length ? (
            <div className="space-y-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold text-[#536659]">{results.totalMatches} matching chunks</p>
                <span className="text-[10px] text-[#9aa49b]">Ranked by semantic similarity</span>
              </div>
              {results.matches.map((match, index) => (
                <ChunkCard key={`${match.documentId}-${match.chunkIndex}-${index}`} citation={match} />
              ))}
            </div>
          ) : (
            <EmptyState icon={<FileSearch size={23} />} title="No matching chunks" message="Try a broader phrase or search across all documents." />
          )
        ) : (
          <EmptyState icon={<Sparkles size={23} />} title="Search your knowledge base" message="Enter a search term to inspect matching vector chunks." />
        )}
      </div>
    </ModalShell>
  );
}
