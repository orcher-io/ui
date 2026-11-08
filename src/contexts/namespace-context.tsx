'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { getSetting } from '../hooks/use-settings';

const STORAGE_KEY = 'orcher-global-namespace';

interface NamespaceContextValue {
  globalNamespace: string;
  setGlobalNamespace: (ns: string) => void;
}

const NamespaceContext = createContext<NamespaceContextValue>({
  globalNamespace: 'all',
  setGlobalNamespace: () => {},
});

export function NamespaceProvider({ children }: { children: ReactNode }) {
  const [globalNamespace, setGlobalNamespaceState] = useState('all');

  // Load from localStorage on mount, falling back to the default namespace setting
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setGlobalNamespaceState(stored);
    } else {
      const defaultNs = getSetting('connection.defaultNamespace', '');
      if (defaultNs) setGlobalNamespaceState(defaultNs);
    }
  }, []);

  const setGlobalNamespace = useCallback((ns: string) => {
    setGlobalNamespaceState(ns);
    if (ns === 'all') {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, ns);
    }
  }, []);

  return (
    <NamespaceContext.Provider value={{ globalNamespace, setGlobalNamespace }}>
      {children}
    </NamespaceContext.Provider>
  );
}

export function useGlobalNamespace() {
  return useContext(NamespaceContext);
}
