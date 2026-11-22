/**
 * Opening sealed payloads in the browser.
 *
 * Clients and workers that are given a codec compress or encrypt every payload
 * before it reaches the engine. The engine holds no key: it stores what it was
 * sent and returns it unchanged, so the dashboard receives this where it used
 * to receive the value:
 *
 *   {"metadata": {"encoding": "binary/encrypted", "encryption-key-id": "k1"},
 *    "data": "<base64>"}
 *
 * `encoding` names what was done to the value, in order, after `binary/`:
 * `binary/gzip`, `binary/encrypted`, `binary/gzip+encrypted`. Opening undoes
 * the steps last to first, and what is left is the value as JSON text.
 *
 * Encryption is AES-256-GCM with no additional data. The encrypted bytes are
 * `[12-byte nonce][ciphertext][16-byte tag]`, which is what WebCrypto takes as
 * `iv` and `data`. Everything here runs in the page: neither a key nor an
 * opened value is sent anywhere, logged, or put in an error message.
 */

/** A decryption key, as the user entered it. */
export interface PayloadKey {
  /** The id the writer gave the key, if the user named one */
  id?: string;
  /** The 32 key bytes, as standard base64 */
  key: string;
}

/** A sealed payload: what was done to the value, and the bytes that resulted. */
export interface SealedPayload {
  encoding: string;
  /** The id of the key it was encrypted with, when the writer named it */
  keyId?: string;
  data: string;
}

export type OpenedPayload =
  /** The value was not sealed, or was sealed and has been opened */
  | { state: 'open'; value: unknown; wasSealed: boolean }
  /** Encrypted, and there is no key to try */
  | { state: 'locked'; keyId?: string }
  /** Encrypted, and none of the keys that are set opens it */
  | { state: 'wrong-key'; keyId?: string }
  /** Sealed, but not in a form this dashboard can open */
  | { state: 'unreadable'; reason: string };

const KEY_ID = 'encryption-key-id';
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
/** No payload the engine accepts is near this; it stops a small sealed value inflating without end. */
const MAX_INFLATED_BYTES = 64 * 1024 * 1024;

/**
 * `value` as a sealed payload, or null when it is anything else.
 *
 * It decides as the writer's own reader does: an object with exactly
 * `metadata` (text values) and `data` (text), whose `encoding` is not a JSON
 * one. A user's value that merely looks similar is left alone.
 */
export function readSealed(value: unknown): SealedPayload | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const names = Object.keys(record);
  if (names.length !== 2 || !('metadata' in record) || !('data' in record)) return null;
  const { metadata, data } = record;
  if (typeof data !== 'string') return null;
  if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) return null;
  const entries = metadata as Record<string, unknown>;
  if (Object.values(entries).some((entry) => typeof entry !== 'string')) return null;
  const encoding = entries.encoding;
  if (typeof encoding !== 'string' || encoding.includes('json')) return null;
  const keyId = entries[KEY_ID];
  return { encoding, data, ...(typeof keyId === 'string' ? { keyId } : {}) };
}

/**
 * A value some journal entries carry as base64 of its JSON text (an event's
 * payload, a result journaled by an earlier engine). Undefined when `text` is
 * not that.
 */
export function decodeBase64Json(text: unknown): { value: unknown } | undefined {
  if (typeof text !== 'string') return undefined;
  const bytes = base64ToBytes(text);
  if (!bytes) return undefined;
  try {
    return { value: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) };
  } catch {
    return undefined;
  }
}

/** Standard base64 as bytes, or null when `text` is not base64. */
export function base64ToBytes(text: string): Uint8Array<ArrayBuffer> | null {
  const compact = text.replace(/\s+/g, '');
  if (compact.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(compact)) return null;
  try {
    const binary = atob(compact);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

/**
 * Why `key` cannot be used as a decryption key, or null when it can. The
 * message never repeats what was typed.
 */
export function payloadKeyProblem(key: string): string | null {
  const text = key.trim();
  if (!text) return 'Enter a key.';
  const bytes = base64ToBytes(text);
  if (!bytes) return 'A key is 32 bytes written as base64. This is not base64.';
  if (bytes.length !== 32) {
    return `A key is 32 bytes written as base64. This decodes to ${bytes.length} ${bytes.length === 1 ? 'byte' : 'bytes'}.`;
  }
  return null;
}

/** The steps an encoding names, in the order they were applied; null for one this dashboard does not know. */
function steps(encoding: string): string[] | null {
  if (!encoding.startsWith('binary/')) return null;
  const names = encoding.slice('binary/'.length).split('+');
  return names.every((name) => name === 'gzip' || name === 'encrypted') ? names : null;
}

// Imported keys, by their base64: importing is asynchronous and a journal holds many payloads
const imported = new Map<string, Promise<CryptoKey | null>>();

function importKey(key: PayloadKey): Promise<CryptoKey | null> {
  let pending = imported.get(key.key);
  if (!pending) {
    const bytes = base64ToBytes(key.key.trim());
    pending =
      bytes && bytes.length === 32
        ? crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['decrypt']).catch(() => null)
        : Promise.resolve(null);
    imported.set(key.key, pending);
  }
  return pending;
}

/** The keys worth trying: the one the payload names, else every key. */
function candidates(keys: PayloadKey[], keyId: string | undefined): PayloadKey[] {
  if (keyId === undefined) return keys;
  // A key entered without an id may still be the one the writer named
  return [...keys.filter((key) => key.id === keyId), ...keys.filter((key) => !key.id)];
}

async function decrypt(
  data: Uint8Array<ArrayBuffer>,
  keys: PayloadKey[],
): Promise<Uint8Array<ArrayBuffer> | null> {
  const iv = data.subarray(0, NONCE_BYTES);
  const sealed = data.subarray(NONCE_BYTES);
  for (const candidate of keys) {
    const key = await importKey(candidate);
    if (!key) continue;
    try {
      return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, sealed));
    } catch {
      // The tag did not verify: not this key
    }
  }
  return null;
}

async function gunzip(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_INFLATED_BYTES) {
      await reader.cancel();
      throw new Error('too large');
    }
    chunks.push(value);
  }
  const inflated = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    inflated.set(chunk, offset);
    offset += chunk.length;
  }
  return inflated;
}

/**
 * Open `value` if it is a sealed payload; anything else comes back as it is.
 *
 * Never throws and always settles: a payload that cannot be opened is
 * reported as `locked`, `wrong-key` or `unreadable`.
 */
export async function openPayload(value: unknown, keys: PayloadKey[]): Promise<OpenedPayload> {
  const sealed = readSealed(value);
  if (!sealed) return { state: 'open', value, wasSealed: false };

  const order = steps(sealed.encoding);
  if (!order) {
    return { state: 'unreadable', reason: `its encoding, ${sealed.encoding}, is not one this dashboard knows` };
  }
  let bytes = base64ToBytes(sealed.data);
  if (!bytes) return { state: 'unreadable', reason: 'its data is not base64' };

  try {
    for (const step of [...order].reverse()) {
      if (step === 'encrypted') {
        if (keys.length === 0) return { state: 'locked', keyId: sealed.keyId };
        if (bytes.length < NONCE_BYTES + TAG_BYTES) {
          return { state: 'unreadable', reason: 'it is too short to be an encrypted value' };
        }
        const plain = await decrypt(bytes, candidates(keys, sealed.keyId));
        if (!plain) return { state: 'wrong-key', keyId: sealed.keyId };
        bytes = plain;
      } else {
        if (typeof DecompressionStream === 'undefined') {
          return { state: 'unreadable', reason: 'this browser cannot decompress it' };
        }
        try {
          bytes = await gunzip(bytes);
        } catch {
          return { state: 'unreadable', reason: 'it could not be decompressed' };
        }
      }
    }
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      return { state: 'open', value: JSON.parse(text), wasSealed: true };
    } catch {
      return { state: 'unreadable', reason: 'what it holds is not JSON' };
    }
  } catch {
    return { state: 'unreadable', reason: 'it could not be opened' };
  }
}
