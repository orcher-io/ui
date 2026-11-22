'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Box, Button, Flex, Text, Theme } from '@radix-ui/themes';
import { Cross1Icon } from '@radix-ui/react-icons';
import { useTheme } from '@orcher/workbench-ui';
import { createPortal } from 'react-dom';
import { addPayloadKey, removePayloadKey } from '../lib/payload-keys';
import { usePayloadKeys } from '../hooks/use-payload-keys';

const inputStyle = {
  padding: '6px 8px', fontSize: 12,
  background: 'var(--gray-3)', color: 'var(--gray-12)',
  border: 'none', boxShadow: 'inset 0 0 0 1px var(--gray-a6)',
  borderRadius: 0, outline: 'none',
} as const;

/**
 * The decryption keys set in this tab: list them, add one, remove one. A key
 * is shown only as its id; what was typed is never displayed again.
 */
export function PayloadKeysEditor() {
  const keys = usePayloadKeys();
  const [id, setId] = useState('');
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const problem = addPayloadKey(key, id);
    setError(problem);
    if (!problem) {
      setId('');
      setKey('');
    }
  };

  return (
    <Box>
      <Text style={{ fontSize: 12, color: 'var(--gray-9)', display: 'block', marginBottom: 8, lineHeight: 1.4 }}>
        Keys that open encrypted payloads in this browser. They are kept for this tab only, are
        gone when it closes, and are never sent to the engine.
      </Text>

      {keys.length === 0 ? (
        <Text style={{ fontSize: 12, color: 'var(--gray-8)', display: 'block', marginBottom: 8 }}>
          No keys set. Encrypted payloads are shown as encrypted.
        </Text>
      ) : (
        <Box style={{ marginBottom: 8, maxWidth: 520 }}>
          {keys.map((entry, index) => (
            <Flex
              key={`${entry.id ?? ''}-${index}`}
              align="center"
              justify="between"
              gap="3"
              style={{ padding: '6px 0', borderBottom: '1px solid var(--gray-a3)' }}
            >
              <Text style={{ fontSize: 12, color: 'var(--gray-12)', fontFamily: entry.id ? 'monospace' : undefined }}>
                {entry.id ?? 'Key without an id'}
              </Text>
              <Flex align="center" gap="3">
                <Text style={{ fontSize: 11, color: 'var(--gray-8)' }}>AES-256</Text>
                <Button
                  size="1"
                  variant="soft"
                  color="gray"
                  onClick={() => removePayloadKey(index)}
                  aria-label={`Remove ${entry.id ? `key ${entry.id}` : 'key without an id'}`}
                >
                  Remove
                </Button>
              </Flex>
            </Flex>
          ))}
        </Box>
      )}

      <form onSubmit={submit}>
        <Flex gap="2" align="center" style={{ maxWidth: 520 }}>
          <input
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="Key id (optional)"
            aria-label="Key id (optional)"
            autoComplete="off"
            spellCheck={false}
            style={{ ...inputStyle, width: 130, flexShrink: 0 }}
          />
          <input
            type="password"
            value={key}
            onChange={(e) => { setKey(e.target.value); setError(null); }}
            placeholder="Key: 32 bytes as base64"
            aria-label="Decryption key"
            autoComplete="off"
            spellCheck={false}
            style={{ ...inputStyle, flex: 1, minWidth: 0 }}
          />
          <Button type="submit" size="1" variant="soft" color="gray" disabled={!key.trim()} style={{ flexShrink: 0 }}>
            Add key
          </Button>
        </Flex>
        {error && (
          <Text role="alert" style={{ fontSize: 12, color: 'var(--red-9)', display: 'block', marginTop: 6 }}>
            {error}
          </Text>
        )}
      </form>
    </Box>
  );
}

/** The keys editor in a dialog, for adding a key from where a payload is shown. */
export function PayloadKeysDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { appearance } = useTheme();

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open || typeof window === 'undefined') return null;

  return createPortal(
    <Theme appearance={appearance} accentColor="gray" style={{ minHeight: 0 }}>
      <div
        role="dialog"
        aria-label="Decryption keys"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          left: '50%', top: '22%', transform: 'translateX(-50%)',
          width: 520, maxWidth: 'calc(100vw - 32px)', zIndex: 99999,
          display: 'flex', flexDirection: 'column',
          backgroundColor: 'var(--gray-1)',
          borderRadius: 0,
          border: '0.5px solid var(--gray-a6)',
          boxShadow: '0 16px 50px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        <Box
          style={{
            display: 'flex', alignItems: 'center', height: 36,
            backgroundColor: 'var(--gray-2)',
            borderBottom: '1px solid var(--gray-a6)',
            padding: '0 12px', flexShrink: 0,
          }}
        >
          <Text size="2" weight="medium" style={{ flex: 1 }}>Decryption keys</Text>
          <Button size="1" variant="ghost" color="gray" onClick={onClose} aria-label="Close">
            <Cross1Icon width={14} height={14} />
          </Button>
        </Box>
        <Box style={{ padding: 16 }}>
          <PayloadKeysEditor />
        </Box>
        <Flex gap="2" justify="end" style={{ padding: '0 16px 12px' }}>
          <Button variant="soft" color="gray" onClick={onClose}>Done</Button>
        </Flex>
      </div>
    </Theme>,
    document.body,
  );
}
