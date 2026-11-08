'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Box, Button, Card, Code, Flex, Heading, Text, TextField, Theme } from '@radix-ui/themes';
import { checkEngineAccess } from '@/lib/gateway-client';
import { onSignInRequired, signIn, storedApiKey } from '@/lib/engine-auth';

type Access = 'checking' | 'ok' | 'sign-in';

/**
 * Shows the dashboard, or asks for an API key first when the engine requires
 * one. An engine without authentication goes straight to the dashboard.
 */
export function EngineSignInGate({ children }: { children: ReactNode }) {
  const [access, setAccess] = useState<Access>('checking');

  useEffect(() => {
    let live = true;
    checkEngineAccess(storedApiKey()).then((result) => {
      // Unreachable: show the dashboard, which reports the engine as disconnected
      if (live) setAccess(result === 'unauthorized' ? 'sign-in' : 'ok');
    });
    const stop = onSignInRequired(() => setAccess('sign-in'));
    return () => {
      live = false;
      stop();
    };
  }, []);

  if (access === 'checking') return null;
  if (access === 'sign-in') return <SignIn onSignedIn={() => setAccess('ok')} />;
  return <>{children}</>;
}

/** The theme the dashboard will show: the saved choice, else the system's. */
function appearance(): 'light' | 'dark' {
  const saved = localStorage.getItem('workbench-theme');
  if (saved === 'light' || saved === 'dark') return saved;
  // As workbench decides: dark unless the system asks for light
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function SignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const candidate = key.trim();
    if (!candidate) return;
    setBusy(true);
    setError(null);
    const result = await checkEngineAccess(candidate);
    setBusy(false);
    if (result === 'ok') {
      signIn(candidate);
      onSignedIn();
    } else if (result === 'unauthorized') {
      setError('The engine did not accept this key.');
    } else {
      setError('The engine could not be reached.');
    }
  };

  return (
    <Theme appearance={appearance()} accentColor="gray">
      <Flex align="center" justify="center" style={{ minHeight: '100vh', padding: 24 }}>
        <Card size="4" style={{ width: 420 }}>
          <form onSubmit={submit}>
            <Flex direction="column" gap="4">
              <Box>
                <Heading size="5">Sign in to Orcher</Heading>
                <Text as="p" size="2" color="gray" mt="2">
                  This engine requires an API key.
                </Text>
              </Box>
              <TextField.Root
                type="password"
                placeholder="API key"
                autoFocus
                autoComplete="off"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                aria-label="API key"
              />
              {error && (
                <Text size="2" color="red" role="alert">
                  {error}
                </Text>
              )}
              <Button type="submit" disabled={busy || !key.trim()}>
                {busy ? 'Checking…' : 'Sign in'}
              </Button>
              <Text size="1" color="gray">
                Create a key with <Code>orcher api-key create</Code>. It is kept in this browser
                until you sign out.
              </Text>
            </Flex>
          </form>
        </Card>
      </Flex>
    </Theme>
  );
}
