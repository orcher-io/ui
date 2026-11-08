'use client';

import { useState, useMemo } from 'react';
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
import { useWorkerList, useNamespaceList, resolveNamespace, type WorkerItem } from '../../../hooks/use-orcher-api';
import { SearchableSelect } from '../../../components/searchable-select';
import { useGlobalNamespace } from '../../../contexts/namespace-context';

import { getPageSize } from '../../../hooks/use-settings';
import { HelpTip } from '../../../components/help-tip';
import { useDrawer } from '../../../contexts/drawer-context';
import { TableSkeleton } from '../../../components/loading-skeleton';
const PAGE_SIZE = getPageSize();

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) {
    const abs = Math.abs(diff);
    if (abs < 60_000) return `in ${Math.floor(abs / 1000)}s`;
    if (abs < 3_600_000) return `in ${Math.floor(abs / 60_000)}m`;
    if (abs < 86_400_000) return `in ${Math.floor(abs / 3_600_000)}h`;
    return `in ${Math.floor(abs / 86_400_000)}d`;
  }
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function statusColor(status: string): 'gray' | 'blue' | 'orange' | 'red' {
  switch (status) {
    case 'idle': return 'gray';
    case 'busy': return 'blue';
    case 'draining': return 'orange';
    case 'offline': return 'red';
    case 'error': return 'red';
    default: return 'gray';
  }
}

function healthColor(health: string): 'green' | 'orange' | 'red' | 'gray' {
  switch (health) {
    case 'healthy': return 'green';
    case 'degraded': return 'orange';
    case 'unhealthy': return 'red';
    case 'unknown': return 'gray';
    default: return 'gray';
  }
}

const STATUS_OPTIONS = ['all', 'idle', 'busy', 'draining', 'offline', 'error'] as const;

interface WorkersTableProps {
  onSelectWorker?: (worker: WorkerItem) => void;
}

export function WorkersTable({ onSelectWorker }: WorkersTableProps) {
  const { workers, loading, error, refresh } = useWorkerList();
  const { namespaces } = useNamespaceList();
  const [namespaceFilter, setNamespaceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const { activeDrawerId } = useDrawer();
  const [page, setPage] = useState(0);

  const { globalNamespace } = useGlobalNamespace();
  const effectiveNs = resolveNamespace(namespaceFilter, globalNamespace);

  const filtered = useMemo(() => {
    return workers.filter((w) => {
      if (statusFilter !== 'all' && w.status !== statusFilter) return false;
      if (effectiveNs) {
        // An SDK worker registers with a namespace, which the engine keeps in
        // the row's metadata. Match on that first; the name/tag/capability
        // heuristics below never held for a real worker, whose name is its
        // pod, so the page showed "No workers found" for every namespace.
        const hasNs = w.metadata?.namespace === effectiveNs
          || w.capabilities?.includes(effectiveNs)
          || w.tags?.includes(effectiveNs)
          || w.name?.includes(effectiveNs);
        if (!hasNs) return false;
      }
      return true;
    });
  }, [workers, statusFilter, namespaceFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

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
        <Heading size="3">Workers</Heading>
        <HelpTip content="Workers are processes that execute workflow and task logic. They poll the server for work and report heartbeats" alwaysVisible />
        <Badge variant="soft" color="gray">{filtered.length}</Badge>
        <Box style={{ flex: 1 }} />
        <SearchableSelect
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v); setPage(0); }}
          placeholder="All Status"
          searchPlaceholder="Search status..."
          width={140}
          options={STATUS_OPTIONS.map((s) => ({ value: s, label: s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1) }))}
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
        <Button variant="ghost" size="2" onClick={refresh}>
          <ReloadIcon />
        </Button>
      </Flex>

      {/* Table */}
      <ScrollArea style={{ flex: 1 }}>
        {loading ? (
          <TableSkeleton rows={8} columns={5} />
        ) : filtered.length === 0 ? (
          <Flex direction="column" align="center" justify="center" p="6" gap="2">
            <Text size="2" color="gray">No workers found</Text>
            <Text size="1" color="gray">Start a worker to process workflow tasks</Text>
          </Flex>
        ) : (
          <Box p="3">
            <Table.Root variant="surface" size="1" className="orcher-compact-table">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell><Flex align="center" gap="1">Status <HelpTip content="idle = waiting for tasks, busy = processing tasks, draining = finishing tasks before shutdown" alwaysVisible /></Flex></Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell><Flex align="center" gap="1">Health <HelpTip content="Based on heartbeat frequency and error rate. Stale after 5 min without heartbeat" alwaysVisible /></Flex></Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell><Flex align="center" gap="1">Tasks <HelpTip content="Current active tasks / max concurrent task slots" alwaysVisible /></Flex></Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Last Heartbeat</Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {paged.map((w) => (
                  <Table.Row
                    key={w.id}
                    style={{
                      cursor: onSelectWorker ? 'pointer' : 'default',
                      background: activeDrawerId === w.id ? 'var(--gray-a3)' : undefined,
                    }}
                    onClick={() => onSelectWorker?.(w)}
                  >
                    <Table.Cell>
                      <Text weight="medium" truncate>{w.name || w.workerId}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge size="1" variant="soft" color={statusColor(w.status)}>
                        {w.status}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge size="1" variant="soft" color={healthColor(w.healthStatus)}>
                        {w.healthStatus}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Flex align="center" gap="2">
                        <div style={{
                          width: 60,
                          height: 6,
                          background: 'var(--gray-a3)',
                          borderRadius: 0,
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${w.maxConcurrentTasks > 0 ? (w.currentTaskCount / w.maxConcurrentTasks) * 100 : 0}%`,
                            height: '100%',
                            background: w.currentTaskCount / w.maxConcurrentTasks > 0.8
                              ? 'var(--red-9)'
                              : w.currentTaskCount / w.maxConcurrentTasks > 0.5
                                ? 'var(--orange-9)'
                                : 'var(--gray-9)',
                            borderRadius: 0,
                            transition: 'width 0.3s',
                          }} />
                        </div>
                        <Text style={{ fontSize: 10, color: 'var(--gray-8)', whiteSpace: 'nowrap' }}>
                          {w.currentTaskCount}/{w.maxConcurrentTasks}
                        </Text>
                      </Flex>
                    </Table.Cell>
                    <Table.Cell>
                      <Text color="gray" style={{ fontSize: 'inherit' }}>
                        {timeAgo(w.lastHeartbeat)}
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
            {filtered.length} workers — page {page + 1} of {totalPages}
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
