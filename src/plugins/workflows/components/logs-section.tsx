'use client';

import { Box, Text, Flex, Badge, ScrollArea, Spinner } from '@radix-ui/themes';
import type { LogEntry } from '../../../hooks/use-orcher-api';

const LEVEL_COLORS: Record<string, 'green' | 'red' | 'orange' | 'blue' | 'gray'> = {
  error: 'red',
  warn: 'orange',
  warning: 'orange',
  info: 'blue',
  debug: 'gray',
};

interface LogsSectionProps {
  logs: LogEntry[];
  loading: boolean;
}

export function LogsSection({ logs, loading }: LogsSectionProps) {
  if (loading) {
    return (
      <Flex align="center" gap="2" p="4">
        <Spinner size="1" />
        <Text size="2" color="gray">Loading logs...</Text>
      </Flex>
    );
  }

  if (logs.length === 0) {
    return (
      <Flex justify="center" p="6">
        <Text size="2" color="gray">No logs available</Text>
      </Flex>
    );
  }

  return (
    <ScrollArea style={{ flex: 1 }}>
      <Box
        style={{
          fontFamily: 'monospace',
          fontSize: 12,
          lineHeight: 1.6,
          padding: 12,
        }}
      >
        {logs.map((log) => (
          <Flex
            key={log.id}
            gap="2"
            align="baseline"
            style={{
              borderBottom: '1px solid var(--gray-3)',
              padding: '2px 0',
            }}
          >
            <Text
              size="1"
              color="gray"
              style={{ minWidth: 75, flexShrink: 0, fontFamily: 'monospace' }}
            >
              {log.timestamp
                ? new Date(log.timestamp).toLocaleTimeString()
                : '—'}
            </Text>
            <Badge
              color={LEVEL_COLORS[log.level?.toLowerCase()] ?? 'gray'}
              size="1"
              variant="soft"
              style={{ minWidth: 40, textAlign: 'center', flexShrink: 0 }}
            >
              {log.level?.toUpperCase() ?? 'LOG'}
            </Badge>
            {log.step && (
              <Text
                size="1"
                color="gray"
                style={{ minWidth: 80, flexShrink: 0 }}
              >
                [{log.step}]
              </Text>
            )}
            <Text size="1" style={{ wordBreak: 'break-word' }}>
              {log.message}
            </Text>
          </Flex>
        ))}
      </Box>
    </ScrollArea>
  );
}
