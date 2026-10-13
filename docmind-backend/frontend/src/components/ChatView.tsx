import {
  Bot,
  Check,
  CheckCircle2,
  Copy,
  FileSearch,
  FileText,
  LoaderCircle,
  MessageCircle,
  Send,
  Sparkles,
} from "lucide-react";
import type { FormEvent, KeyboardEvent, RefObject } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage, DocumentMetadata } from "../types";
import { displayName } from "../utils";

const templates = [
  {
    title: "Summarize key points",
    description: "Get a concise overview and the most important takeaways.",
    prompt: "Summarize the key points and main takeaways.",
    icon: FileText,
    tint: "bg-[#e8f3e9] text-[#36724c]",
  },
  {
    title: "Find clauses",
    description: "Locate important terms, obligations, and exceptions.",
    prompt: "Find and summarize the key clauses, obligations, and exceptions.",
    icon: FileSearch,
    tint: "bg-[#f8eee0] text-[#a06425]",
  },
  {
    title: "Action items",
    description: "Surface tasks, deadlines, and responsibilities.",
    prompt: "List the action items, deadlines, and responsible parties.",
    icon: CheckCircle2,
    tint: "bg-[#e9eff8] text-[#4d6e9a]",
  },
  {
    title: "Explain concepts",
    description: "Make technical ideas and terminology easier to understand.",
    prompt: "Explain the main concepts in this document in simple terms.",
    icon: Sparkles,
    tint: "bg-[#f3eafb] text-[#81549a]",
  },
];

export default function ChatView({
  messages,
  draft,
  onDraftChange,
  onSubmit,
  onKeyDown,
  sending,
  scopedDocument,
  onTemplate,
  composerRef,
  copyingMessage,
  onCopy,
}: {
  messages: ChatMessage[];
  draft: string;
  onDraftChange: (draft: string) => void;
  onSubmit: (event?: FormEvent<HTMLFormElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  sending: boolean;
  scopedDocument: DocumentMetadata | null;
  onTemplate: (prompt: string) => void;
  composerRef: RefObject<HTMLTextAreaElement | null>;
  copyingMessage: string | null;
  onCopy: (message: ChatMessage) => void;
}) {
  return (
    <>
      <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto bg-[#f7f8f3] px-4 sm:px-8">
        {messages.length === 0 ? (
          <Welcome scopedDocument={scopedDocument} onTemplate={onTemplate} />
        ) : (
          <div className="mx-auto flex w-full max-w-[850px] flex-col gap-6 py-8 sm:py-10">
            {messages.map((message) => (
              <ChatBubble
                key={message.id}
                message={message}
                copied={copyingMessage === message.id}
                onCopy={() => onCopy(message)}
                isStreaming={sending && message.role === "assistant" && !message.content}
              />
            ))}
          </div>
        )}
      </div>
      <div className="shrink-0 border-t border-[#e5e9e2] bg-[#fbfcf8] px-4 pb-3 pt-3 sm:px-8 sm:pb-4 sm:pt-4">
        <form onSubmit={onSubmit} className="mx-auto max-w-[850px]">
          <div className="flex items-end gap-2 rounded-2xl border border-[#dfe6dd] bg-white p-2 pl-4 shadow-[0_3px_12px_rgba(35,72,47,0.04)] transition focus-within:border-[#9bb9a0] focus-within:shadow-[0_0_0_3px_rgba(66,131,83,0.08)]">
            <textarea
              ref={composerRef}
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder={
                scopedDocument
                  ? `Ask about ${displayName(scopedDocument)}…`
                  : "Ask a question across your documents…"
              }
              aria-label="Ask a question"
              className="max-h-32 min-h-10 flex-1 resize-none border-0 bg-transparent py-2.5 text-[13px] leading-5 text-[#344b3c] outline-none placeholder:text-[#9ba69d]"
            />
            <button
              type="submit"
              disabled={!draft.trim() || sending}
              className="mb-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#286746] text-white transition hover:bg-[#20583a] disabled:cursor-not-allowed disabled:bg-[#dce5dc] disabled:text-[#9aa79c]"
              aria-label="Send message"
            >
              {sending ? <LoaderCircle size={17} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between px-1">
            <p className="text-[10px] text-[#98a198]">
              <kbd className="rounded border border-[#e5e9e3] bg-white px-1 py-0.5 text-[9px]">Enter</kbd>
              {" "}to send ·{" "}
              <kbd className="rounded border border-[#e5e9e3] bg-white px-1 py-0.5 text-[9px]">Shift + Enter</kbd>
              {" "}for a new line
            </p>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#558363]">
              <Sparkles size={11} />
              Grounded in your documents
            </span>
          </div>
        </form>
      </div>
    </>
  );
}

function Welcome({
  scopedDocument,
  onTemplate,
}: {
  scopedDocument: DocumentMetadata | null;
  onTemplate: (prompt: string) => void;
}) {
  return (
    <div className="flex min-h-full items-center justify-center py-10">
      <div className="mx-auto w-full max-w-[760px] text-center">
        <div className="mx-auto flex size-[58px] items-center justify-center rounded-[20px] bg-[#e6f1e5] text-[#34734b] ring-1 ring-[#d4e5d4]">
          <Sparkles size={26} strokeWidth={1.8} />
        </div>
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6c8b73]">
          Your document assistant
        </p>
        <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.04em] text-[#203b2d] sm:text-[32px]">
          Make sense of your documents.
        </h1>
        <p className="mx-auto mt-3 max-w-[510px] text-[13px] leading-6 text-[#7d8b80] sm:text-sm">
          Ask questions, find details, and get clear answers grounded in the documents you have indexed.
        </p>
        {scopedDocument && (
          <p className="mx-auto mt-3 inline-flex max-w-[90%] items-center gap-1.5 rounded-full border border-[#dce9db] bg-white px-3 py-1.5 text-[11px] text-[#587460]">
            <FileText size={12} className="shrink-0" />
            <span className="truncate">Focused on {displayName(scopedDocument)}</span>
          </p>
        )}
        <div className="mx-auto mt-9 grid max-w-[680px] grid-cols-1 gap-2.5 text-left sm:grid-cols-2">
          {templates.map((template) => {
            const Icon = template.icon;
            return (
              <button
                type="button"
                key={template.title}
                onClick={() => onTemplate(template.prompt)}
                className="group flex min-h-[84px] items-start gap-3 rounded-2xl border border-[#e5eae2] bg-white p-4 text-left shadow-[0_2px_9px_rgba(35,72,47,0.025)] transition hover:-translate-y-0.5 hover:border-[#c6d9c8] hover:shadow-[0_8px_18px_rgba(35,72,47,0.06)]"
              >
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${template.tint}`}>
                  <Icon size={16} />
                </span>
                <span>
                  <span className="block text-xs font-semibold text-[#40564a] group-hover:text-[#2d6a44]">
                    {template.title}
                  </span>
                  <span className="mt-1 block text-[11px] leading-[18px] text-[#87938a]">
                    {template.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ChatBubble({
  message,
  onCopy,
  copied,
  isStreaming,
}: {
  message: ChatMessage;
  onCopy: () => void;
  copied: boolean;
  isStreaming: boolean;
}) {
  const isUser = message.role === "user";
  return (
    <div className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl ${
        isUser ? "bg-[#e9eee7] text-[#758478]" : "bg-[#e5f0e5] text-[#39754d]"
      }`}>
        {isUser ? <MessageCircle size={16} /> : <Bot size={17} />}
      </span>
      <div className={`min-w-0 max-w-[min(760px,88%)] ${isUser ? "text-right" : "text-left"}`}>
        <div className={`inline-block rounded-2xl px-4 py-3 text-left text-[13px] leading-[1.7] ${
          isUser
            ? "rounded-tr-md bg-[#286746] text-white"
            : message.error
              ? "rounded-tl-md border border-[#f0d4cb] bg-[#fff6f2] text-[#9a4d3e]"
              : "rounded-tl-md border border-[#e5eae3] bg-white text-[#405247] shadow-[0_2px_8px_rgba(35,72,47,0.025)]"
        }`}>
          {isStreaming ? (
            <span className="inline-flex items-center gap-2 text-[#839187]">
              <LoaderCircle size={14} className="animate-spin" />
              Thinking through your documents…
            </span>
          ) : isUser ? (
            <p className="chat-user-text">{message.content}</p>
          ) : (
            <div className="chat-markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            </div>
          )}
          {!isUser && !message.error && message.content && (
            <div className="mt-3 flex items-center justify-between gap-4 border-t border-[#edf0eb] pt-2">
              <span className="text-[10px] text-[#9aa49b]">
                {message.responseTimeMs
                  ? `Answered in ${(message.responseTimeMs / 1000).toFixed(1)}s`
                  : message.citations
                    ? `${message.citations.length} source${message.citations.length === 1 ? "" : "s"}`
                    : ""}
              </span>
              <button
                type="button"
                onClick={onCopy}
                className="inline-flex items-center gap-1 text-[10px] font-medium text-[#829087] transition hover:text-[#326b46]"
                aria-label="Copy answer"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          )}
        </div>
        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.citations.slice(0, 5).map((citation, index) => (
              <span
                key={`${citation.documentId ?? citation.fileName}-${citation.chunkIndex ?? index}-${index}`}
                title={citation.snippet}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#e1e9df] bg-[#f5f8f3] px-2 py-1 text-[10px] text-[#688071]"
              >
                <FileText size={10} className="shrink-0" />
                <span className="max-w-[190px] truncate">
                  {citation.fileName}
                  {citation.pageNumber ? ` · p. ${citation.pageNumber}` : ""}
                  {citation.chunkIndex !== null ? ` · chunk ${citation.chunkIndex}` : ""}
                </span>
              </span>
            ))}
          </div>
        )}
        {!isUser && message.sourceError && (
          <p className="mt-2 text-[10px] text-[#a06b38]">
            The answer streamed, but source lookup failed: {message.sourceError}
          </p>
        )}
      </div>
    </div>
  );
}
