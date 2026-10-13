import { AlertCircle, CheckCircle2, FileText, LoaderCircle, UploadCloud, X } from "lucide-react";
import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { api, formatBytes } from "../services/api";
import type { UploadedDocument } from "../types";
import { getStatusClasses } from "../utils";
import { ModalShell } from "./Shared";

const acceptedExtensions = [".pdf", ".doc", ".docx", ".txt", ".md", ".csv"];
const maxFileSize = 25 * 1024 * 1024;
const maxRequestSize = 50 * 1024 * 1024 - 64 * 1024;

export default function UploadDialog({
  onClose,
  onComplete,
}: {
  onClose: () => void;
  onComplete: (uploaded: UploadedDocument[]) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<UploadedDocument[] | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (selected: File[]) => {
    const errors: string[] = [];
    const accepted: File[] = [];
    for (const file of selected) {
      const dot = file.name.lastIndexOf(".");
      const extension = dot >= 0 ? file.name.slice(dot).toLowerCase() : "";
      if (!acceptedExtensions.includes(extension)) {
        errors.push(`${file.name}: unsupported file type.`);
      } else if (file.size > maxFileSize) {
        errors.push(`${file.name}: exceeds the 25 MB per-file limit.`);
      } else if (!files.some((existing) => existing.name === file.name && existing.size === file.size)) {
        accepted.push(file);
      }
    }
    const totalSize = [...files, ...accepted].reduce((total, file) => total + file.size, 0);
    if (totalSize > maxRequestSize) {
      errors.push("The combined upload cannot exceed 50 MB.");
      setFileErrors(errors);
      return;
    }
    setFiles((current) => [...current, ...accepted]);
    setFileErrors(errors);
    setResults(null);
  };

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  };

  const onDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragging(false);
    addFiles(Array.from(event.dataTransfer.files));
  };

  const upload = async () => {
    if (files.length === 0 || uploading) return;
    setUploading(true);
    setProgress(0);
    try {
      const uploaded = await api.uploadFiles(files, setProgress);
      setProgress(100);
      setResults(uploaded);
      onComplete(uploaded);
    } catch (error) {
      setFileErrors([error instanceof Error ? error.message : "Upload failed."]);
    } finally {
      setUploading(false);
    }
  };

  const allIndexed = results?.length
    ? results.every((result) => result.status === "INDEXED")
    : false;

  return (
    <ModalShell onClose={uploading ? () => undefined : onClose} labelledBy="upload-title">
      <div className="flex items-center justify-between border-b border-[#edf0eb] px-5 py-4 sm:px-6">
        <div>
          <h2 id="upload-title" className="text-[15px] font-semibold text-[#2d4436]">Add documents</h2>
          <p className="mt-1 text-[11px] text-[#8a968d]">
            Files are indexed so you can chat and search their contents.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={uploading}
          className="flex size-8 items-center justify-center rounded-lg text-[#8d998f] transition hover:bg-[#f1f4ef] hover:text-[#3c5344] disabled:opacity-40"
          aria-label="Close upload dialog"
        >
          <X size={17} />
        </button>
      </div>
      <div className="p-5 sm:p-6">
        {results ? (
          <div>
            <div className={`rounded-2xl border p-4 ${allIndexed ? "border-[#d7e8d8] bg-[#f2f8f1]" : "border-[#f0dfbe] bg-[#fff9ed]"}`}>
              <div className="flex items-center gap-2">
                {allIndexed ? <CheckCircle2 size={18} className="text-[#398153]" /> : <AlertCircle size={18} className="text-[#a87626]" />}
                <p className="text-sm font-semibold text-[#405548]">
                  {allIndexed ? "Upload complete" : "Upload finished with issues"}
                </p>
              </div>
              <p className="mt-1 pl-[26px] text-xs text-[#78857a]">
                {results.length} {results.length === 1 ? "document was" : "documents were"} processed.
              </p>
            </div>
            <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
              {results.map((result) => (
                <div key={result.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#e9ede7] px-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium text-[#4a5d50]">{result.fileName}</span>
                    <span className="mt-0.5 block text-[10px] text-[#8d998f]">
                      {formatBytes(result.fileSize)} · {result.chunksCreated} chunks
                    </span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-semibold ${getStatusClasses(result.status)}`}>
                    {result.status}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={onClose} className="rounded-xl bg-[#286746] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#20583a]">
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`flex min-h-[185px] w-full flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-6 text-center transition ${
                dragging ? "border-[#4f9664] bg-[#edf6ec]" : "border-[#cbd9cb] bg-[#f8faf6] hover:border-[#8eae94] hover:bg-[#f4f8f2]"
              }`}
            >
              <span className="flex size-11 items-center justify-center rounded-2xl bg-[#e6f1e5] text-[#39774e]">
                <UploadCloud size={21} />
              </span>
              <span className="mt-3 text-sm font-semibold text-[#415749]">
                Drop files here or <span className="text-[#3b8054] underline underline-offset-2">browse</span>
              </span>
              <span className="mt-1.5 text-[11px] text-[#89958b]">
                PDF, DOCX, DOC, Markdown, TXT, CSV · up to 25 MB each
              </span>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.md,.txt,.csv"
                onChange={onInputChange}
                className="sr-only"
                tabIndex={-1}
              />
            </button>
            {files.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-[#526357]">Selected files ({files.length})</span>
                  <button type="button" onClick={() => setFiles([])} disabled={uploading} className="text-[#829087] underline underline-offset-2 hover:text-[#3b6747] disabled:opacity-50">
                    Remove all
                  </button>
                </div>
                <div className="scrollbar-subtle max-h-32 space-y-1.5 overflow-y-auto">
                  {files.map((file, index) => (
                    <div key={`${file.name}-${file.size}-${index}`} className="flex items-center gap-2 rounded-lg bg-[#f5f7f3] px-3 py-2">
                      <FileText size={14} className="shrink-0 text-[#799080]" />
                      <span className="min-w-0 flex-1 truncate text-[11px] text-[#536559]">{file.name}</span>
                      <span className="shrink-0 text-[10px] text-[#94a096]">{formatBytes(file.size)}</span>
                      {!uploading && (
                        <button type="button" onClick={() => setFiles((current) => current.filter((_, i) => i !== index))} className="ml-1 flex size-5 items-center justify-center text-[#9ba69c] hover:text-[#a94d3d]" aria-label={`Remove ${file.name}`}>
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {uploading && (
              <div className="mt-4">
                <div className="mb-1.5 flex justify-between text-[10px] text-[#738278]">
                  <span>{progress >= 100 ? "Waiting for indexing" : "Sending files"}</span>
                  <span>{progress}%</span>
                </div>
                <div role="progressbar" aria-label="Upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="h-2 overflow-hidden rounded-full bg-[#e8ede6]">
                  <div className="h-full rounded-full bg-[#3d8657] transition-[width] duration-150" style={{ width: `${progress}%` }} />
                </div>
                <p className="mt-1.5 text-[10px] text-[#8c988e]">
                  {progress >= 100 ? "Files transferred. Waiting for the server to finish indexing." : "The server indexes files after transfer completes."}
                </p>
              </div>
            )}
            {fileErrors.length > 0 && (
              <div className="mt-3 space-y-1 rounded-xl border border-[#f0d8d0] bg-[#fff6f2] px-3 py-2.5 text-[11px] text-[#9d5545]">
                {fileErrors.map((error) => <p key={error}>{error}</p>)}
              </div>
            )}
            <div className="mt-5 flex items-center justify-between gap-3">
              <span className="text-[10px] text-[#909b92]">Combined files must stay under 50 MB</span>
              <button type="button" disabled={files.length === 0 || uploading} onClick={() => void upload()} className="inline-flex items-center gap-2 rounded-xl bg-[#286746] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#20583a] disabled:cursor-not-allowed disabled:bg-[#dce5dc] disabled:text-[#8c998e]">
                {uploading ? <><LoaderCircle size={14} className="animate-spin" /> Uploading…</> : <><UploadCloud size={14} /> Upload {files.length > 1 ? `${files.length} files` : "document"}</>}
              </button>
            </div>
          </>
        )}
      </div>
    </ModalShell>
  );
}
