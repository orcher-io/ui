'use client';

import { useState, useEffect } from 'react';
import { Box, Text, Flex } from '@radix-ui/themes';
import { SunIcon, MoonIcon } from '@radix-ui/react-icons';
import { useTheme } from '@orcher/workbench-ui';
import { useGlobalNamespace } from '../../contexts/namespace-context';
import { apiFetch } from '@/lib/api-transport';

// ============================================================================
// Connection indicator
// ============================================================================

function ConnectionDot({ connected }: { connected: boolean }) {
  return (
    <div style={{
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: connected ? '#22c55e' : '#ef4444',
      flexShrink: 0,
    }} />
  );
}

// ============================================================================
// Footer Left
// ============================================================================

export function OrcherFooterLeft() {
  const { globalNamespace } = useGlobalNamespace();
  const [connected, setConnected] = useState(false);
  const [gatewayUrl, setGatewayUrl] = useState('');

  // Fetch server config + check connection periodically
  useEffect(() => {
    const check = async () => {
      try {
        const [connRes, cfgRes] = await Promise.all([
          apiFetch('/api/workflows?limit=1'),
          apiFetch('/api/config'),
        ]);
        setConnected(connRes.ok);
        if (cfgRes.ok) {
          const cfg = await cfgRes.json();
          setGatewayUrl(cfg.gatewayUrl ?? '');
        }
      } catch {
        setConnected(false);
      }
    };
    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Flex align="center" gap="3" style={{ height: '100%' }}>
      <Flex align="center" gap="1">
        <ConnectionDot connected={connected} />
        <Text style={{ fontSize: 11, color: connected ? 'var(--gray-10)' : 'var(--red-9)' }}>
          {connected ? 'Connected' : 'Disconnected'}
        </Text>
      </Flex>
      <Text style={{ fontSize: 11, color: 'var(--gray-7)' }}>|</Text>
      <Text style={{ fontSize: 11, color: 'var(--gray-8)', fontFamily: 'monospace' }}>
        {gatewayUrl ? gatewayUrl.replace(/^https?:\/\//, '') : '...'}
      </Text>
      {globalNamespace !== 'all' && (
        <>
          <Text style={{ fontSize: 11, color: 'var(--gray-7)' }}>|</Text>
          <Text style={{ fontSize: 11, color: 'var(--gray-10)' }}>{globalNamespace}</Text>
        </>
      )}
    </Flex>
  );
}

// ============================================================================
// Footer Right
// ============================================================================

export function OrcherFooterRight() {
  const { appearance, toggleTheme } = useTheme();
  const [time, setTime] = useState('');

  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString());
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Flex align="center" gap="3" style={{ height: '100%' }}>
      <Text style={{ fontSize: 11, color: 'var(--gray-8)', fontFamily: 'monospace' }}>
        {time}
      </Text>
      <Text style={{ fontSize: 11, color: 'var(--gray-7)' }}>|</Text>
      <Box
        onClick={toggleTheme}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--gray-9)' }}
        title={`Switch to ${appearance === 'dark' ? 'light' : 'dark'} mode`}
      >
        {appearance === 'dark'
          ? <SunIcon width={12} height={12} />
          : <MoonIcon width={12} height={12} />
        }
      </Box>
      <Text style={{ fontSize: 11, color: 'var(--gray-7)' }}>|</Text>
      <Text style={{ fontSize: 11, color: 'var(--gray-8)' }}>
        Orcher v0.1.0
      </Text>
    </Flex>
  );
}
