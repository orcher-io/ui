/**
 * The API key the standalone dashboard signs in with.
 *
 * An engine running without authentication never asks for one. One that
 * requires a credential answers 401, and the dashboard asks for a key, keeps it
 * in this browser's storage, and sends it as a Bearer token on every request.
 */

const STORAGE_KEY = 'orcher.apiKey';

type Listener = () => void;
const listeners = new Set<Listener>();

export function storedApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function signIn(apiKey: string): void {
  localStorage.setItem(STORAGE_KEY, apiKey);
}

export function signOut(): void {
  localStorage.removeItem(STORAGE_KEY);
  notifySignInRequired();
}

/** The engine refused a request as unauthenticated: the key is missing, wrong, or revoked. */
export function notifySignInRequired(): void {
  for (const listener of listeners) listener();
}

export function onSignInRequired(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
