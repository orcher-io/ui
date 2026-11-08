'use client';

import { Component, type ReactNode } from 'react';
import { Box, Text, Flex, Button } from '@radix-ui/themes';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  pluginName?: string;
}

/**
 * What a caller may attach to an Error to get a better failure screen.
 *
 * Structural rather than a shared type: this component should not import from
 * the applications that use it, and an error only has to expose these fields
 * to be rendered well. Anything without them renders exactly as before.
 */
interface StructuredError {
  /** Human sentence describing what happened. */
  message: string;
  /** What the reader can do about it. */
  suggestion?: string;
  /** Machine-readable code, shown small for support and bug reports. */
  code?: string;
  /** A single recovery step, rendered as a button beside Try Again. */
  action?: { label: string; onAction: () => void };
}

function readStructured(error: Error | null): Partial<StructuredError> {
  if (!error) return {};
  const e = error as Error & Partial<StructuredError>;
  return {
    suggestion: typeof e.suggestion === 'string' ? e.suggestion : undefined,
    code: typeof e.code === 'string' ? e.code : undefined,
    action:
      e.action && typeof e.action.onAction === 'function' && typeof e.action.label === 'string'
        ? e.action
        : undefined,
  };
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    const title = this.props.pluginName
      ? `Plugin Error: ${this.props.pluginName}`
      : 'Something went wrong';

    const message = this.state.error?.message || 'An unexpected error occurred.';
    const { suggestion, code, action } = readStructured(this.state.error);

    return (
      <Box
        style={{
          borderLeft: '3px solid var(--red-9)',
          backgroundColor: 'var(--red-a2)',
          borderRadius: 0,
          padding: '12px 16px',
        }}
      >
        <Flex gap="3" align="start">
          <Box style={{ flexShrink: 0, marginTop: 1, color: 'var(--red-9)' }}>
            <ExclamationTriangleIcon width={16} height={16} />
          </Box>
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Text
              weight="medium"
              style={{
                fontSize: 12,
                color: 'var(--red-11)',
                display: 'block',
                marginBottom: 4,
              }}
            >
              {title}
            </Text>
            {/* Wraps rather than truncating. A single ellipsised line is fine
                for "Cannot read property of undefined" and useless for anything
                that arrived from a server with something to say. */}
            <Text
              style={{
                fontSize: 12,
                color: 'var(--red-10)',
                lineHeight: 1.4,
                display: 'block',
                maxWidth: '100%',
                overflowWrap: 'anywhere',
              }}
            >
              {message}
            </Text>
            {suggestion && (
              <Text
                style={{
                  fontSize: 12,
                  color: 'var(--gray-11)',
                  lineHeight: 1.4,
                  display: 'block',
                  marginTop: 6,
                  overflowWrap: 'anywhere',
                }}
              >
                {suggestion}
              </Text>
            )}
            {code && (
              <Text
                style={{
                  fontSize: 11,
                  color: 'var(--gray-9)',
                  display: 'block',
                  marginTop: 6,
                  fontFamily: 'var(--code-font-family, monospace)',
                }}
              >
                {code}
              </Text>
            )}
            <Flex gap="2" style={{ marginTop: 8 }}>
              {/* The recovery step first, when there is one: retrying an
                  expired session just fails again. */}
              {action && (
                <Button
                  size="1"
                  variant="solid"
                  color="red"
                  onClick={action.onAction}
                  style={{ borderRadius: 0, fontSize: 12, cursor: 'pointer' }}
                >
                  {action.label}
                </Button>
              )}
              <Button
                size="1"
                variant="soft"
                color="red"
                onClick={this.handleReset}
                style={{ borderRadius: 0, fontSize: 12, cursor: 'pointer' }}
              >
                Try Again
              </Button>
            </Flex>
          </Box>
        </Flex>
      </Box>
    );
  }
}
