'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  Text,
  Flex,
  Badge,
  Button,
  TextField,
  Spinner,
  Table,
  ScrollArea,
  Heading,
} from '@radix-ui/themes';
import { ChevronDownIcon, CheckIcon } from '@radix-ui/react-icons';
import { MagnifyingGlassIcon, ReloadIcon } from '@radix-ui/react-icons';
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

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '—';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

interface WorkflowsTableProps {
  onSelectWorkflow: (workflow: WorkflowListItem) => void;
}

import { getPageSize } from '../../../hooks/use-settings';
import { useDrawer } from '../../../contexts/drawer-context';
import { TableSkeleton } from '../../../components/loading-skeleton';
const PAGE_SIZE = getPageSize();

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'running', label: 'Running', color: 'blue' as const },
  { value: 'completed', label: 'Completed', color: 'green' as const },
  { value: 'failed', label: 'Failed', color: 'red' as const },
  { value: 'canceled', label: 'Canceled', color: 'orange' as const },
  { value: 'terminated', label: 'Terminated', color: 'orange' as const },
  { value: 'reset', label: 'Reset', color: 'orange' as const },
  { value: 'timed_out', label: 'Timed Out', color: 'gray' as const },
];

function StatusDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Focus search input when opened
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const filtered = STATUS_OPTIONS.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase()),
  );

  const current = STATUS_OPTIONS.find((o) => o.value === value);

  return (
    <Box ref={ref} style={{ position: 'relative' }}>
      <Button
        variant="surface"
        size="2"
        onClick={() => setOpen(!open)}
        style={{ minWidth: 140, justifyContent: 'space-between' }}
      >
        <Flex align="center" gap="2">
          {current?.color && (
            <Badge color={current.color} size="1" variant="soft">
              {current.label}
            </Badge>
          )}
          {!current?.color && <Text size="2">{current?.label ?? 'All Status'}</Text>}
        </Flex>
        <ChevronDownIcon />
      </Button>

      {open && (
        <Box
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            width: 200,
            background: 'var(--gray-2)',
            border: 'none',
            borderRadius: 0,
            boxShadow: 'inset 0 0 0 0.5px var(--gray-a3), 0 4px 12px rgba(0,0,0,0.3)',
            zIndex: 50,
            overflow: 'hidden',
          }}
        >
          <Box p="1" style={{ borderBottom: '1px solid var(--gray-6)' }}>
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search status..."
              style={{
                width: '100%',
                padding: '6px 8px',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: 'var(--gray-12)',
                fontSize: 13,
              }}
            />
          </Box>
          <Box style={{ maxHeight: 200, overflowY: 'auto' }}>
            {filtered.map((opt) => (
              <Flex
                key={opt.value}
                align="center"
                justify="between"
                px="3"
                py="1"
                style={{
                  cursor: 'pointer',
                  background: opt.value === value ? 'var(--accent-4)' : 'transparent',
                }}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                  setSearch('');
                }}
                onMouseEnter={(e) => {
                  if (opt.value !== value) {
                    e.currentTarget.style.background = 'var(--gray-4)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background =
                    opt.value === value ? 'var(--accent-4)' : 'transparent';
                }}
              >
                <Flex align="center" gap="2">
                  {opt.color ? (
                    <Badge color={opt.color} size="1" variant="soft">
                      {opt.label}
                    </Badge>
                  ) : (
                    <Text size="2">{opt.label}</Text>
                  )}
                </Flex>
                {opt.value === value && (
                  <CheckIcon width={14} height={14} style={{ color: 'var(--gray-11)' }} />
                )}
              </Flex>
            ))}
            {filtered.length === 0 && (
              <Text size="1" color="gray" style={{ display: 'block', textAlign: 'center', padding: 'var(--space-2)' }}>
                No match
              </Text>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}

function NamespaceDropdown({
  value,
  onChange,
  namespaces,
}: {
  value: string;
  onChange: (value: string) => void;
  namespaces: { name: string; status: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const options = [
    { value: 'all', label: 'All Namespaces' },
    ...namespaces
      .filter((ns) => ns.status === 'active')
      .map((ns) => ({ value: ns.name, label: ns.name })),
  ];

  const filtered = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase()),
  );

  const current = options.find((o) => o.value === value);

  return (
    <Box ref={ref} style={{ position: 'relative' }}>
      <Button
        variant="surface"
        size="2"
        onClick={() => setOpen(!open)}
        style={{ minWidth: 160, justifyContent: 'space-between' }}
      >
        <Text size="2">{current?.label ?? 'All Namespaces'}</Text>
        <ChevronDownIcon />
      </Button>

      {open && (
        <Box
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            width: 220,
            background: 'var(--gray-2)',
            border: 'none',
            borderRadius: 0,
            boxShadow: 'inset 0 0 0 0.5px var(--gray-a3), 0 4px 12px rgba(0,0,0,0.3)',
            zIndex: 50,
            overflow: 'hidden',
          }}
        >
          <Box p="1" style={{ borderBottom: '1px solid var(--gray-6)' }}>
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search namespaces..."
              style={{
                width: '100%',
                padding: '6px 8px',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: 'var(--gray-12)',
                fontSize: 13,
              }}
            />
          </Box>
          <Box style={{ maxHeight: 200, overflowY: 'auto' }}>
            {filtered.map((opt) => (
              <Flex
                key={opt.value}
                align="center"
                justify="between"
                px="3"
                py="1"
                style={{
                  cursor: 'pointer',
                  background: opt.value === value ? 'var(--accent-4)' : 'transparent',
                }}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                  setSearch('');
                }}
                onMouseEnter={(e) => {
                  if (opt.value !== value) {
                    e.currentTarget.style.background = 'var(--gray-4)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background =
                    opt.value === value ? 'var(--accent-4)' : 'transparent';
                }}
              >
                <Text size="2">{opt.label}</Text>
                {opt.value === value && (
                  <CheckIcon width={14} height={14} style={{ color: 'var(--gray-11)' }} />
                )}
              </Flex>
            ))}
            {filtered.length === 0 && (
              <Text size="1" color="gray" style={{ display: 'block', textAlign: 'center', padding: 'var(--space-2)' }}>
                No match
              </Text>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}

export function WorkflowsTable({ onSelectWorkflow }: WorkflowsTableProps) {
  const [namespaceFilter, setNamespaceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const { activeDrawerId } = useDrawer();
  const { namespaces } = useNamespaceList();
  const { globalNamespace } = useGlobalNamespace();
  const { workflows, loading, error, refresh } = useWorkflowList(
    resolveNamespace(namespaceFilter, globalNamespace),
  );

  const filtered = workflows.filter((wf) => {
    if (statusFilter !== 'all' && wf.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        wf.workflowType.toLowerCase().includes(q) ||
        wf.workflowId.toLowerCase().includes(q) ||
        wf.executionId.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset to first page when filters change
  const handleNamespaceChange = (value: string) => { setNamespaceFilter(value); setPage(0); };
  const handleStatusChange = (value: string) => { setStatusFilter(value); setPage(0); };
  const handleSearchChange = (value: string) => { setSearch(value); setPage(0); };

  return (
    <Flex direction="column" style={{ height: '100%' }}>
      {/* Toolbar */}
      <Flex
        p="3"
        gap="3"
        align="center"
        style={{ borderBottom: '1px solid var(--gray-6)' }}
      >
        <Heading size="3" style={{ marginRight: 'auto' }}>
          Workflows
        </Heading>

        <SearchableSelect
          value={namespaceFilter}
          onChange={handleNamespaceChange}
          placeholder="All Namespaces"
          searchPlaceholder="Search namespaces..."
          width={160}
          options={[
            { value: 'all', label: 'All Namespaces' },
            ...namespaces.filter((ns) => ns.status === 'active').map((ns) => ({ value: ns.name, label: ns.name })),
          ]}
        />
        <SearchableSelect
          value={statusFilter}
          onChange={handleStatusChange}
          placeholder="All Status"
          searchPlaceholder="Search status..."
          width={140}
          options={STATUS_OPTIONS.map((opt) => ({
            value: opt.value,
            label: opt.label,
            render: opt.color ? (
              <Badge size="1" variant="soft" color={opt.color}>{opt.label}</Badge>
            ) : undefined,
          }))}
        />

        <TextField.Root
          placeholder="Search workflows..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          style={{ width: 240 }}
          size="2"
        >
          <TextField.Slot>
            <MagnifyingGlassIcon />
          </TextField.Slot>
        </TextField.Root>

        <Button variant="ghost" size="2" onClick={refresh}>
          <ReloadIcon />
        </Button>
      </Flex>

      {/* Content */}
      {loading ? (
        <TableSkeleton rows={8} columns={6} />
      ) : error ? (
        <Flex
          direction="column"
          align="center"
          justify="center"
          gap="3"
          p="6"
          style={{ flex: 1 }}
        >
          <Text color="red" weight="bold">
            Connection Error
          </Text>
          <Text size="2" color="gray">
            {error}
          </Text>
          <Text size="1" color="gray">
            Make sure the orchestrator is running.
          </Text>
          <Button size="2" variant="soft" onClick={refresh}>
            Retry
          </Button>
        </Flex>
      ) : (
        <ScrollArea style={{ flex: 1 }}>
          <Box p="3">
          <Table.Root variant="surface" size="1" className="orcher-compact-table">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Type</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Workflow ID</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Execution ID</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Task Queue</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Started</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {paged.length === 0 ? (
                <Table.Row>
                  <Table.Cell colSpan={6}>
                    <Flex justify="center" p="4">
                      <Text color="gray" size="2">
                        {workflows.length === 0
                          ? 'No workflows found. Start a workflow to see it here.'
                          : 'No workflows match the current filters.'}
                      </Text>
                    </Flex>
                  </Table.Cell>
                </Table.Row>
              ) : (
                paged.map((wf) => (
                  <Table.Row
                    key={wf.executionId}
                    style={{ cursor: 'pointer', background: activeDrawerId === wf.executionId ? 'var(--gray-a3)' : undefined }}
                    onClick={() => onSelectWorkflow(wf)}
                  >
                    <Table.Cell>
                      <Text weight="medium">{wf.workflowType || '—'}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text
                        style={{ fontFamily: 'monospace', fontSize: 'inherit' }}
                        truncate
                      >
                        {wf.workflowId || '—'}
                      </Text>
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
                      <Text size="2" color="gray">
                        {wf.taskQueue || '—'}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="2" color="gray">
                        {timeAgo(wf.startedAt)}
                      </Text>
                    </Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table.Root>
          </Box>

          {/* Pagination */}
          <Flex
            p="3"
            justify="between"
            align="center"
            style={{ borderTop: '1px solid var(--gray-6)' }}
          >
            <Text size="1" color="gray">
              {filtered.length === 0
                ? '0 workflows'
                : `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, filtered.length)} of ${filtered.length} workflows`}
            </Text>
            <Flex gap="2" align="center">
              <Button
                size="1"
                variant="ghost"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <Text size="1" color="gray">
                {totalPages > 0 ? `${page + 1} / ${totalPages}` : '—'}
              </Text>
              <Button
                size="1"
                variant="ghost"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </Flex>
          </Flex>
        </ScrollArea>
      )}
    </Flex>
  );
}
