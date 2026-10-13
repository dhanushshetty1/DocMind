import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "../services/api";
import type { DocumentMetadata } from "../types";
import { getErrorMessage } from "../utils";

interface WorkspaceContextValue {
  documents: DocumentMetadata[];
  loading: boolean;
  connected: boolean | null;
  error: string;
  refreshDocuments: () => Promise<boolean>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  const refreshDocuments = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    try {
      const result = await api.listDocuments();
      setDocuments(result);
      setConnected(true);
      setError("");
      return true;
    } catch (requestError) {
      setConnected(false);
      setError(getErrorMessage(requestError));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshDocuments();
  }, [refreshDocuments]);

  const value = useMemo(
    () => ({ documents, loading, connected, error, refreshDocuments }),
    [documents, loading, connected, error, refreshDocuments],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider.");
  }
  return context;
}
