'use client';

import { Box, Text, Flex, Badge, Card, Spinner, Button, ScrollArea } from '@radix-ui/themes';
import { useWorkflowList, type WorkflowListItem } from '../../../hooks/use-orcher-api';

const STATUS_COLORS: Record<string, 'green' | 'red' | 'orange' | 'blue' | 'gray'> = {
  running: 'blue',
  completed: 'green',
  failed: 'red',
  canceled: 'orange',
  cancelled: 'orange',
  terminated: 'orange',
  reset: 'orange',
  pending: 'gray',
};

interface WorkflowListProps {
  namespace?: string;
  onSelect: (workflow: WorkflowListItem) => void;
}

export function WorkflowList({ namespace = 'benchmark', onSelect }: WorkflowListProps) {
  const { workflows, loading, error, refresh } = useWorkflowList(namespace);

  if (loading) {
    return (
      <Flex align="center" justify="center" p="4">
        <Spinner size="2" />
        <Text ml="2" size="2" color="gray">Loading...</Text>
      </Flex>
    );
  }

  if (error) {
    return (
      <Box p="3">
        <Card size="1">
          <Flex direction="column" gap="1" align="center">
            <Text size="2" color="red">Not connected</Text>
            <Text size="1" color="gray">{error}</Text>
            <Button size="1" variant="ghost" onClick={refresh}>Retry</Button>
          </Flex>
        </Card>
      </Box>
    );
  }

  if (workflows.length === 0) {
    return (
      <Box p="3">
        <Text size="2" color="gray">No workflows found</Text>
        <Button size="1" variant="ghost" onClick={refresh} mt="2">Refresh</Button>
      </Box>
    );
  }

  return (
    <ScrollArea style={{ height: '100%' }}>
      <Flex direction="column" gap="1" p="2">
        <Flex justify="between" align="center" px="1" mb="1">
          <Text size="1" color="gray" weight="bold">{workflows.length} workflows</Text>
          <Button size="1" variant="ghost" onClick={refresh}>Refresh</Button>
        </Flex>
        {workflows.map((wf) => (
          <Card
            key={wf.executionId}
            size="1"
            style={{ cursor: 'pointer' }}
            onClick={() => onSelect(wf)}
          >
            <Flex justify="between" align="center">
              <Flex direction="column" gap="0">
                <Text size="2" weight="medium" truncate style={{ maxWidth: 180 }}>
                  {wf.workflowType || wf.workflowId}
                </Text>
                <Text size="1" color="gray" style={{ fontFamily: 'monospace' }} truncate>
                  {wf.executionId.slice(0, 12)}...
                </Text>
              </Flex>
              <Badge color={STATUS_COLORS[wf.status] ?? 'gray'} size="1" variant="soft">
                {wf.status}
              </Badge>
            </Flex>
          </Card>
        ))}
      </Flex>
    </ScrollArea>
  );
}
