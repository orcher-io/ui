/**
 * The decryption keys the dashboard has been given.
 *
 * They are kept in this tab's session storage at most: closing the tab drops
 * them, and so does signing out. They are never sent to the engine or anywhere
 * else; `payload-seal.ts` uses them in the page to open what the engine returns.
 */
import { payloadKeyProblem, type PayloadKey } from './payload-seal';

const STORAGE_KEY = 'orcher.payloadKeys';

type Listener = () => void;
const listeners = new Set<Listener>();

const NO_KEYS: PayloadKey[] = [];
let cached: PayloadKey[] | null = null;

function read(): PayloadKey[] {
  if (typeof window === 'undefined') return NO_KEYS;
  try {
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(stored)) return NO_KEYS;
    const keys = stored
      .filter((entry) => typeof entry?.key === 'string' && payloadKeyProblem(entry.key) === null)
      .map((entry) => ({
        key: entry.key as string,
        ...(typeof entry.id === 'string' && entry.id ? { id: entry.id as string } : {}),
      }));
    return keys.length > 0 ? keys : NO_KEYS;
  } catch {
    return NO_KEYS;
  }
}

function write(keys: PayloadKey[]): void {
  cached = keys.length > 0 ? keys : NO_KEYS;
  try {
    if (keys.length > 0) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage is unavailable: the keys last as long as the page does
  }
  for (const listener of listeners) listener();
}

/** The keys that are set. The same array until they change. */
export function payloadKeys(): PayloadKey[] {
  if (cached === null) cached = read();
  return cached;
}

/** What the server render sees: no keys. */
export function noPayloadKeys(): PayloadKey[] {
  return NO_KEYS;
}

/**
 * Add a key. Returns why it was refused, or null when it was added. The
 * message never repeats the key.
 */
export function addPayloadKey(key: string, id?: string): string | null {
  const problem = payloadKeyProblem(key);
  if (problem) return problem;
  const entry: PayloadKey = { key: key.trim().replace(/\s+/g, ''), ...(id?.trim() ? { id: id.trim() } : {}) };
  const keys = payloadKeys();
  if (keys.some((existing) => existing.key === entry.key && existing.id === entry.id)) {
    return 'This key is already set.';
  }
  write([...keys, entry]);
  return null;
}

export function removePayloadKey(index: number): void {
  write(payloadKeys().filter((_, i) => i !== index));
}

export function clearPayloadKeys(): void {
  write([]);
}

export function onPayloadKeysChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
