import type { DocumentMetadata } from "../types";

export function displayName(document: DocumentMetadata): string {
  return document.filename || "Untitled document";
}

export function getStatusClasses(status: DocumentMetadata["status"]): string {
  if (status === "INDEXED") {
    return "bg-[#e7f5e9] text-[#33794d]";
  }
  if (status === "FAILED") {
    return "bg-[#fff0ed] text-[#b34e3d]";
  }
  return "bg-[#fff4dd] text-[#a36a18]";
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function makeId(): string {
  return crypto.randomUUID();
}
