'use client';

import { useSyncExternalStore } from 'react';
import { noPayloadKeys, onPayloadKeysChanged, payloadKeys } from '../lib/payload-keys';
import type { PayloadKey } from '../lib/payload-seal';

/** The decryption keys set in this tab; re-renders when they change. */
export function usePayloadKeys(): PayloadKey[] {
  return useSyncExternalStore(onPayloadKeysChanged, payloadKeys, noPayloadKeys);
}
