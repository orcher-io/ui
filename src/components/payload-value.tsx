'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { openPayload, readSealed, type OpenedPayload } from '../lib/payload-seal';
import { usePayloadKeys } from '../hooks/use-payload-keys';
import { PayloadKeysDialog } from './payload-keys-editor';

/** A payload to show: a value the API returned, or text to show as it is. */
export type ShownPayload = { value: unknown } | { text: string };

/** Whether there is anything to show: an empty text is nothing. */
export function hasPayload(payload: ShownPayload | undefined): payload is ShownPayload {
  return payload !== undefined && !('text' in payload && payload.text === '');
}

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2) ?? '';
}

/**
 * A payload as text, in whatever style surrounds it.
 *
 * A value that is not sealed is printed at once, as JSON. A sealed one is
 * opened with the keys set in this tab and printed the same way; when it
 * cannot be, this says so (encrypted and no key, encrypted and no key fits,
 * unreadable) and offers the keys dialog.
 */
export function PayloadValue({ payload }: { payload: ShownPayload }) {
  if ('text' in payload) return <>{payload.text}</>;
  if (!readSealed(payload.value)) return <>{pretty(payload.value)}</>;
  return <SealedValue value={payload.value} />;
}

function SealedValue({ value }: { value: unknown }) {
  const keys = usePayloadKeys();
  const [opened, setOpened] = useState<OpenedPayload | null>(null);
  const [keysOpen, setKeysOpen] = useState(false);

  useEffect(() => {
    let live = true;
    openPayload(value, keys)
      .catch((): OpenedPayload => ({ state: 'unreadable', reason: 'it could not be opened' }))
      .then((result) => {
        if (live) setOpened(result);
      });
    return () => {
      live = false;
    };
  }, [value, keys]);

  const action = (label: string): ReactNode => (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => { e.stopPropagation(); setKeysOpen(true); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKeysOpen(true); }
      }}
      style={{ color: 'var(--gray-12)', textDecoration: 'underline', cursor: 'pointer' }}
    >
      {label}
    </span>
  );

  const named = opened && 'keyId' in opened && opened.keyId ? ` with key ${opened.keyId}` : '';

  // Until it has been opened there is nothing to print; opening takes a
  // moment at most and always ends. The dialog stays mounted through every
  // state, so adding the key that works does not close it under the user.
  return (
    <>
      {opened?.state === 'open' && pretty(opened.value)}
      {opened && opened.state !== 'open' && (
        <span data-payload-state={opened.state} style={{ whiteSpace: 'normal', wordBreak: 'normal', color: 'var(--gray-10)' }}>
          {opened.state === 'locked' && <>Encrypted{named} · {action('Add a key')}</>}
          {opened.state === 'wrong-key' && (
            <>Encrypted{named} · none of your keys opens this · {action('Manage keys')}</>
          )}
          {opened.state === 'unreadable' && <>Cannot be shown: {opened.reason}</>}
        </span>
      )}
      <PayloadKeysDialog open={keysOpen} onClose={() => setKeysOpen(false)} />
    </>
  );
}

/**
 * A note for a form that sends a payload: the dashboard sends it as it is.
 * Shown only when a decryption key is set, which is when it would surprise.
 */
export function UnencryptedSendNotice({ children }: { children: ReactNode }) {
  const keys = usePayloadKeys();
  if (keys.length === 0) return null;
  return (
    <span role="note" style={{ fontSize: 12, color: 'var(--gray-9)', lineHeight: 1.4, display: 'block' }}>
      {children}
    </span>
  );
}
