'use client';

import { Box, Text, Flex, Badge, Card, ScrollArea } from '@radix-ui/themes';

interface JournalEntry {
  eventId: number;
  eventType: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

const EVENT_TYPE_COLORS: Record<string, 'green' | 'red' | 'blue' | 'orange' | 'purple' | 'gray'> = {
  WorkflowExecutionStarted: 'blue',
  TaskScheduled: 'purple',
  TaskStarted: 'blue',
  TaskCompleted: 'green',
  TaskFailed: 'red',
  TimerStarted: 'orange',
  TimerFired: 'orange',
  EventReceived: 'purple',
  WorkflowExecutionCompleted: 'green',
  WorkflowExecutionFailed: 'red',
  WorkflowExecutionReset: 'orange',
  StepCompleted: 'green',
};

interface JournalTimelineProps {
  executionId: string;
  entries?: JournalEntry[];
}

export function JournalTimeline({ executionId, entries = [] }: JournalTimelineProps) {
  if (entries.length === 0) {
    return (
      <Box p="4">
        <Card>
          <Flex direction="column" gap="2" align="center" p="6">
            <Text weight="bold" size="3">No Journal Entries</Text>
            <Text size="2" color="gray">
              Connect to an Orcher orchestrator to view the execution journal
              for {executionId}.
            </Text>
          </Flex>
        </Card>
      </Box>
    );
  }

  return (
    <ScrollArea style={{ height: '100%' }}>
      <Box p="4">
        <Flex direction="column" gap="2">
          {entries.map((entry) => (
            <Card key={entry.eventId} size="1">
              <Flex justify="between" align="center">
                <Flex gap="2" align="center">
                  <Text size="1" color="gray" style={{ fontFamily: 'monospace', minWidth: 24 }}>
                    #{entry.eventId}
                  </Text>
                  <Badge
                    color={EVENT_TYPE_COLORS[entry.eventType] ?? 'gray'}
                    size="1"
                    variant="soft"
                  >
                    {entry.eventType}
                  </Badge>
                </Flex>
                <Text size="1" color="gray">
                  {entry.timestamp}
                </Text>
              </Flex>
            </Card>
          ))}
        </Flex>
      </Box>
    </ScrollArea>
  );
}
