import { AlertCircle, CheckCircle2, CircleHelp, FileText, Layers3, X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import type { Citation, Notice } from "../types";

export function ModalShell({
  children,
  onClose,
  labelledBy,
  wide = false,
}: {
  children: ReactNode;
  onClose: () => void;
  labelledBy: string;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-[#1a2c20]/35 p-3 backdrop-blur-[3px] sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`modal-panel flex max-h-[min(92vh,900px)] w-full flex-col overflow-hidden rounded-2xl border border-[#e2e8e1] bg-white shadow-[0_24px_80px_rgba(24,45,31,0.2)] ${
          wide ? "max-w-[760px]" : "max-w-[570px]"
        }`}
      >
        {children}
      </section>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  message,
}: {
  icon: ReactNode;
  title: string;
  message: string;
}) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center px-4 text-center">
      <span className="text-[#bcc9bd]">{icon}</span>
      <p className="mt-3 text-xs font-semibold text-[#748278]">{title}</p>
      <p className="mt-1.5 max-w-[300px] text-[11px] leading-5 text-[#9aa49b]">{message}</p>
    </div>
  );
}

export function ChunkCard({ citation }: { citation: Citation }) {
  const similarity = citation.similarityScore;
  return (
    <article className="rounded-xl border border-[#e4eae2] bg-white px-3.5 py-3 shadow-[0_1px_4px_rgba(35,72,47,0.02)]">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold text-[#607365]">
          <Layers3 size={12} className="shrink-0 text-[#76907c]" />
          <span className="truncate">{citation.fileName || "Document chunk"}</span>
          {citation.chunkIndex !== null && <span>· Chunk #{citation.chunkIndex}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-2 text-[9px] text-[#99a39b]">
          {citation.pageNumber !== null && (
            <span className="inline-flex items-center gap-1">
              <FileText size={10} /> Page {citation.pageNumber}
            </span>
          )}
          {typeof similarity === "number" && (
            <span className="rounded-full bg-[#eff5ed] px-2 py-1 font-medium text-[#598065]">
              {Math.round(similarity * 100)}% match
            </span>
          )}
        </span>
      </div>
      <p className="whitespace-pre-wrap break-words text-[11px] leading-[1.75] text-[#67776c]">
        {citation.snippet}
      </p>
    </article>
  );
}

export function Toast({
  notice,
  onClose,
}: {
  notice: Notice;
  onClose: () => void;
}) {
  const styles = {
    success: "border-[#d7e8d8] bg-[#f2f8f1] text-[#3e7450]",
    error: "border-[#f0d8d0] bg-[#fff6f2] text-[#9b5142]",
    info: "border-[#dce6e9] bg-[#f2f7f8] text-[#4e707b]",
  };
  const Icon =
    notice.kind === "success"
      ? CheckCircle2
      : notice.kind === "error"
        ? AlertCircle
        : CircleHelp;
  return (
    <div
      role="status"
      className={`modal-panel fixed bottom-5 right-5 z-[60] flex max-w-[min(90vw,420px)] items-start gap-2.5 rounded-xl border px-4 py-3 text-xs shadow-lg ${styles[notice.kind]}`}
    >
      <Icon size={15} className="mt-0.5 shrink-0" />
      <p className="flex-1 leading-5">{notice.message}</p>
      <button
        type="button"
        onClick={onClose}
        className="opacity-60 hover:opacity-100"
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </div>
  );
}
