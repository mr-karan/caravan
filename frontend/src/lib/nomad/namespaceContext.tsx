import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { listNamespaces } from './api/namespaces';
import { Namespace } from './types';
import { getCluster } from '../cluster';

export const ALL_NAMESPACES = '*';

interface NamespaceContextType {
  namespace: string;
  setNamespace: (ns: string) => void;
  namespaces: Namespace[];
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

const NamespaceContext = createContext<NamespaceContextType>({
  namespace: ALL_NAMESPACES,
  setNamespace: () => {},
  namespaces: [],
  loading: false,
  error: null,
  refresh: () => {},
});

export function useNamespace() {
  return useContext(NamespaceContext);
}

interface NamespaceProviderProps {
  children: React.ReactNode;
}

export function NamespaceProvider({ children }: NamespaceProviderProps) {
  // Use location to trigger re-renders when URL changes
  const location = useLocation();
  const cluster = getCluster(location.pathname);
  const storageKey = `nomad_namespace_${cluster || 'default'}`;

  const [namespace, setNamespaceState] = useState<string>(() => {
    return localStorage.getItem(storageKey) || ALL_NAMESPACES;
  });
  const [namespaces, setNamespaces] = useState<Namespace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchNamespaces = useCallback(async () => {
    // Don't fetch if no cluster is set
    if (!cluster) {
      setNamespaces([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await listNamespaces();
      setNamespaces(data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching namespaces:', err);
      setError(err as Error);
      // On error (e.g., namespaces not enabled), provide default namespace
      setNamespaces([{ Name: 'default', Description: 'Default namespace' } as Namespace]);
    } finally {
      setLoading(false);
    }
  }, [cluster]);

  useEffect(() => {
    fetchNamespaces();
  }, [fetchNamespaces]);

  // Reset namespace selection when cluster changes
  useEffect(() => {
    const savedNamespace = localStorage.getItem(storageKey);
    setNamespaceState(savedNamespace || ALL_NAMESPACES);
  }, [storageKey]);

  const setNamespace = useCallback((ns: string) => {
    setNamespaceState(ns);
    localStorage.setItem(storageKey, ns);
  }, [storageKey]);

  return (
    <NamespaceContext.Provider
      value={{
        namespace,
        setNamespace,
        namespaces,
        loading,
        error,
        refresh: fetchNamespaces,
      }}
    >
      {children}
    </NamespaceContext.Provider>
  );
}
