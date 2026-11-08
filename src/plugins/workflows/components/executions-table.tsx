'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Text,
  Flex,
  Badge,
  Button,
  Spinner,
  Table,
  ScrollArea,
  Heading,
} from '@radix-ui/themes';
import { ReloadIcon, ChevronLeftIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import { useWorkflowList, useNamespaceList, resolveNamespace, type WorkflowListItem } from '../../../hooks/use-orcher-api';
import { useGlobalNamespace } from '../../../contexts/namespace-context';
import { SearchableSelect } from '../../../components/searchable-select';

const STATUS_COLORS: Record<string, 'green' | 'red' | 'orange' | 'blue' | 'gray'> = {
  running: 'blue',
  completed: 'green',
  failed: 'red',
  canceled: 'orange',
  cancelled: 'orange',
  terminated: 'orange',
  reset: 'orange',
  pending: 'gray',
  unknown: 'gray',
};

const STATUS_OPTIONS = ['all', 'running', 'completed', 'failed', 'canceled', 'pending'] as const;
import { getPageSize, getRefreshInterval, getSetting } from '../../../hooks/use-settings';
import { useDrawer } from '../../../contexts/drawer-context';
import { TableSkeleton } from '../../../components/loading-skeleton';
const PAGE_SIZE = getPageSize();

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function formatDur(ms?: number): string {
  if (!ms || ms <= 0) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

interface ExecutionsTableProps {
  onSelectExecution: (workflow: WorkflowListItem) => void;
}

export function ExecutionsTable({ onSelectExecution }: ExecutionsTableProps) {
  const [namespaceFilter, setNamespaceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(() => getRefreshInterval() > 0);
  const { activeDrawerId } = useDrawer();
  const { namespaces } = useNamespaceList();
  const { globalNamespace } = useGlobalNamespace();
  const { workflows, loading, error, refresh } = useWorkflowList(
    resolveNamespace(namespaceFilter, globalNamespace),
  );

  useEffect(() => {
    if (!autoRefresh) return;
    const ms = getRefreshInterval() || 10_000;
    const interval = setInterval(refresh, ms);
    return () => clearInterval(interval);
  }, [autoRefresh, refresh]);

  const showCompleted = getSetting('dashboard.showCompletedWorkflows', true);

  const filtered = useMemo(() => {
    return workflows.filter((wf) => {
      if (!showCompleted && wf.status === 'completed') return false;
      if (statusFilter !== 'all' && wf.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !wf.workflowType?.toLowerCase().includes(q) &&
          !wf.executionId?.toLowerCase().includes(q) &&
          !wf.workflowId?.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [workflows, statusFilter, search, showCompleted]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const runningCount = workflows.filter((wf) => wf.status === 'running' || wf.status === 'pending').length;

  if (error) {
    return (
      <Box p="6" style={{ textAlign: 'center' }}>
        <Heading size="4" color="red" mb="2">Connection Error</Heading>
        <Text size="2" color="gray">{error}</Text>
        <Box mt="3">
          <Button variant="soft" onClick={refresh}><ReloadIcon /> Retry</Button>
        </Box>
      </Box>
    );
  }

  return (
    <Flex direction="column" style={{ height: '100%' }}>
      {/* Toolbar */}
      <Flex
        p="3" gap="3" align="center"
        style={{ borderBottom: '1px solid var(--gray-a3)', flexShrink: 0 }}
      >
        <Heading size="3">Executions</Heading>
        <Badge variant="soft" color="gray">{filtered.length}</Badge>
        {runningCount > 0 && (
          <Badge color="blue" variant="soft" size="1">{runningCount} running</Badge>
        )}
        <Box style={{ flex: 1 }} />
        <SearchableSelect
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v); setPage(0); }}
          placeholder="All Status"
          searchPlaceholder="Search status..."
          width={140}
          options={STATUS_OPTIONS.map((s) => ({
            value: s,
            label: s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1),
            render: s !== 'all' ? <Badge size="1" variant="soft" color={STATUS_COLORS[s] ?? 'gray'}>{s.charAt(0).toUpperCase() + s.slice(1)}</Badge> : undefined,
          }))}
        />
        <SearchableSelect
          value={namespaceFilter}
          onChange={(v) => { setNamespaceFilter(v); setPage(0); }}
          placeholder="All Namespaces"
          searchPlaceholder="Search namespaces..."
          width={160}
          options={[
            { value: 'all', label: 'All Namespaces' },
            ...namespaces.filter((ns) => ns.status === 'active').map((ns) => ({ value: ns.name, label: ns.name })),
          ]}
        />
        <Button
          variant={autoRefresh ? 'solid' : 'soft'}
          color="gray"
          size="1"
          onClick={() => setAutoRefresh(!autoRefresh)}
          style={{ fontSize: 11 }}
        >
          {autoRefresh ? 'Live' : 'Auto'}
        </Button>
        <Button variant="ghost" size="2" onClick={refresh}>
          <ReloadIcon />
        </Button>
      </Flex>

      {/* Table */}
      <ScrollArea style={{ flex: 1 }}>
        {loading && filtered.length === 0 ? (
          <TableSkeleton rows={8} columns={7} />
        ) : filtered.length === 0 ? (
          <Flex direction="column" align="center" justify="center" p="6" gap="2">
            <Text size="2" color="gray">No executions found</Text>
            <Text size="1" color="gray">Start a workflow or adjust your filters</Text>
          </Flex>
        ) : (
          <Box p="3">
            <Table.Root variant="surface" size="1" className="orcher-compact-table">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>Type</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Execution ID</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Started</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Duration</Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {paged.map((wf) => (
                  <Table.Row
                    key={wf.executionId}
                    style={{
                      cursor: 'pointer',
                      background: activeDrawerId === wf.executionId ? 'var(--gray-a3)' : undefined,
                    }}
                    onClick={() => onSelectExecution(wf)}
                  >
                    <Table.Cell>
                      <Text weight="medium">{wf.workflowType || '—'}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text
                        color="gray"
                        style={{ fontFamily: 'monospace', fontSize: 'inherit' }}
                        truncate
                      >
                        {wf.executionId.slice(0, 16)}...
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge
                        color={STATUS_COLORS[wf.status] ?? 'gray'}
                        size="1"
                        variant="soft"
                      >
                        {wf.status}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Text color="gray" style={{ fontSize: 'inherit' }}>
                        {timeAgo(wf.startedAt)}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text color="gray" style={{ fontSize: 'inherit' }}>
                        {wf.status === 'running'
                          ? <Badge color="blue" variant="outline" size="1">in progress</Badge>
                          : formatDur(wf.durationMs)
                        }
                      </Text>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Box>
        )}
      </ScrollArea>

      {/* Pagination */}
      {totalPages > 1 && (
        <Flex
          p="2" px="3" justify="between" align="center"
          style={{ borderTop: '1px solid var(--gray-a3)', flexShrink: 0 }}
        >
          <Text style={{ fontSize: 11, color: 'var(--gray-8)' }}>
            {filtered.length} executions — page {page + 1} of {totalPages}
            {autoRefresh && ' · auto-refreshing'}
          </Text>
          <Flex gap="1">
            <Button size="1" variant="ghost" color="gray" disabled={page === 0} onClick={() => setPage(page - 1)}>
              <ChevronLeftIcon width={14} height={14} />
            </Button>
            <Button size="1" variant="ghost" color="gray" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
              <ChevronRightIcon width={14} height={14} />
            </Button>
          </Flex>
        </Flex>
      )}
    </Flex>
  );
}
