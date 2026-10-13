import { Layers3, Plus, Search } from "lucide-react";
import type { DocumentMetadata } from "../types";
import { displayName } from "../utils";

export default function Navbar({
  documents,
  scopeId,
  onScopeChange,
  onSearch,
  onUpload,
}: {
  documents: DocumentMetadata[];
  scopeId: string;
  onScopeChange: (scopeId: string) => void;
  onSearch: () => void;
  onUpload: () => void;
}) {
  return (
    <header className="z-10 flex h-[68px] shrink-0 items-center justify-between border-b border-[#e5e9e2] bg-[#fbfcf8] px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-[14px] bg-[#235c42] text-white shadow-sm">
          <Layers3 size={20} strokeWidth={2.1} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[17px] font-semibold tracking-[-0.03em] text-[#173a2b]">
              DocMind
            </span>
            <span className="hidden rounded-full border border-[#d9e8dc] bg-[#f0f7f1] px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] text-[#467957] sm:inline-flex">
              AI WORKSPACE
            </span>
          </div>
          <p className="hidden text-[11px] text-[#839187] sm:block">
            A calmer way to work with documents
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <label className="hidden min-w-0 items-center gap-2 text-xs sm:flex">
          <span className="size-1.5 shrink-0 rounded-full bg-[#54a36d]" />
          <span className="text-[#87938a]">Context:</span>
          <select
            value={scopeId}
            onChange={(event) => onScopeChange(event.target.value)}
            className="max-w-[230px] truncate border-0 bg-transparent p-0 pr-5 text-xs font-semibold text-[#475c4e] outline-none"
            aria-label="Choose chat document context"
          >
            <option value="all">All uploaded documents</option>
            {documents.map((document) => (
              <option key={document.id} value={document.id}>
                {displayName(document)}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0 sm:hidden">
          <select
            value={scopeId}
            onChange={(event) => onScopeChange(event.target.value)}
            className="max-w-[105px] truncate rounded-lg border border-[#e2e8e1] bg-white px-2 py-2 text-[10px] font-medium text-[#526558]"
            aria-label="Choose chat document context"
          >
            <option value="all">All docs</option>
            {documents.map((document) => (
              <option key={document.id} value={document.id}>
                {displayName(document)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={onUpload}
          className="flex size-9 items-center justify-center rounded-xl border border-[#e2e8e1] bg-white text-[#4f6358] transition hover:border-[#bbd1c0] hover:bg-[#f8fbf8] md:hidden"
          aria-label="Add documents"
        >
          <Plus size={16} />
        </button>
        <button
          type="button"
          onClick={onSearch}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#e2e8e1] bg-white px-3 text-xs font-medium text-[#4f6358] shadow-[0_1px_2px_rgba(29,51,40,0.03)] transition hover:border-[#bbd1c0] hover:bg-[#f8fbf8]"
        >
          <Search size={15} />
          <span className="hidden sm:inline">Search chunks</span>
          <kbd className="hidden rounded-md border border-[#edf0eb] bg-[#f7f8f4] px-1.5 py-0.5 text-[10px] text-[#88948b] md:inline">
            ⌘ K
          </kbd>
        </button>
      </div>
    </header>
  );
}
