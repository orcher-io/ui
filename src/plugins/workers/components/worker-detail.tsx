'use client';

import { useMemo, useState } from 'react';
import { useToastActions } from '@orcher/workbench-ui';
import {
  Box,
  Text,
  Flex,
  Badge,
  Table,
} from '@radix-ui/themes';
import { CopyIcon, CheckIcon } from '@radix-ui/react-icons';
import { useWorkerList, useWorkflowList, type WorkerItem, type WorkflowListItem } from '../../../hooks/use-orcher-api';
import { DetailSkeleton } from '../../../components/loading-skeleton';
import { KebabMenu } from '../../../components/kebab-menu';
import { ConfirmDialog } from '../../../components/confirm-dialog';
import { MinusCircledIcon, CrossCircledIcon } from '@radix-ui/react-icons';
import { HelpTip } from '../../../components/help-tip';

// ============================================================================
// Helpers
// ============================================================================

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function formatTimestamp(ts?: string): string {
  if (!ts) return '—';
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function statusColor(status: string): 'gray' | 'blue' | 'orange' | 'red' {
  switch (status) {
    case 'idle': return 'gray';
    case 'busy': return 'blue';
    case 'draining': return 'orange';
    case 'offline': case 'error': return 'red';
    default: return 'gray';
  }
}

function healthColor(health: string): 'green' | 'orange' | 'red' | 'gray' {
  switch (health) {
    case 'healthy': return 'green';
    case 'degraded': return 'orange';
    case 'unhealthy': return 'red';
    default: return 'gray';
  }
}

// ============================================================================
// Detail row
// ============================================================================

function DetailRow({ label, value, mono, help }: { label: string; value: string; mono?: boolean; help?: string }) {
  return (
    <>
      <Flex align="center" gap="1" className="detail-row-label">
        <Text style={{ color: 'var(--gray-8)', fontSize: 12 }}>{label}</Text>
        {help && <HelpTip content={help} />}
      </Flex>
      <Text style={{ color: 'var(--gray-12)', fontSize: 12, fontFamily: mono ? 'monospace' : 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value}
      </Text>
    </>
  );
}

// ============================================================================
// Section header
// ============================================================================

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <Flex align="center" gap="2" mb="2">
      <Text size="2" weight="medium" style={{ color: 'var(--gray-11)' }}>{title}</Text>
      {count !== undefined && (
        <Badge size="1" variant="soft" color="gray">{count}</Badge>
      )}
    </Flex>
  );
}

// ============================================================================
// Capability badge
// ============================================================================

function CapabilityItem({ value }: { value: string }) {
  const isWorkflow = value.startsWith('workflow:');
  const isTask = value.startsWith('task:');
  const name = value.replace(/^(workflow|task):/, '');

  return (
    <Flex align="center" gap="2" py="1" px="2" style={{ borderRadius: 0, background: 'var(--gray-a2)' }}>
      <Badge size="1" variant="surface" color={isWorkflow ? 'blue' : isTask ? 'gray' : 'gray'} style={{ fontSize: 9 }}>
        {isWorkflow ? 'WF' : isTask ? 'TASK' : '?'}
      </Badge>
      <Text style={{ fontSize: 12, color: 'var(--gray-12)' }}>{name}</Text>
    </Flex>
  );
}

// ============================================================================
// Worker tabs
// ============================================================================

type WorkerTabId = 'workflows' | 'capabilities';

function WorkerTabs({
  worker,
  workflowTypes,
  taskTypes,
  runningWorkflows,
  recentWorkflows,
  onSelectWorkflow,
}: {
  worker: WorkerItem;
  workflowTypes: string[];
  taskTypes: string[];
  runningWorkflows: WorkflowListItem[];
  recentWorkflows: WorkflowListItem[];
  onSelectWorkflow?: (wf: WorkflowListItem) => void;
}) {
  const [activeTab, setActiveTab] = useState<WorkerTabId>('workflows');

  const tabs: { id: WorkerTabId; label: string; count?: number }[] = [
    { id: 'workflows', label: 'Workflows', count: runningWorkflows.length + recentWorkflows.length },
    { id: 'capabilities', label: 'Capabilities', count: (worker.capabilities ?? []).length },
  ];

  return (
    <Box>
      {/* Tab bar */}
      <Flex style={{ borderBottom: '1px solid var(--gray-a3)', marginBottom: 8 }}>
        {tabs.map((tab) => (
          <Box
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '6px 14px',
              cursor: 'pointer',
              borderBottom: activeTab === tab.id ? '2px solid var(--gray-12)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--gray-12)' : 'var(--gray-9)',
              fontSize: 12,
              fontWeight: activeTab === tab.id ? 500 : 400,
              transition: 'all 0.1s',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <Badge size="1" variant="soft" color="gray" style={{ fontSize: 9 }}>
                {tab.count}
              </Badge>
            )}
          </Box>
        ))}
      </Flex>

      {/* Tab content */}
      {activeTab === 'capabilities' && (
        <Box>
          {(!worker.capabilities || worker.capabilities.length === 0) ? (
            <Text style={{ fontSize: 12, color: 'var(--gray-8)' }}>No capabilities registered</Text>
          ) : (
            <>
              {workflowTypes.length > 0 && (
                <Box mb="3">
                  <Text style={{ fontSize: 10, color: 'var(--gray-8)', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'block', marginBottom: 4 }}>
                    Workflows ({workflowTypes.length})
                  </Text>
                  <Flex gap="1" wrap="wrap">
                    {workflowTypes.map((name) => (
                      <CapabilityItem key={`wf:${name}`} value={`workflow:${name}`} />
                    ))}
                  </Flex>
                </Box>
              )}
              {taskTypes.length > 0 && (
                <Box mb="3">
                  <Text style={{ fontSize: 10, color: 'var(--gray-8)', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'block', marginBottom: 4 }}>
                    Tasks ({taskTypes.length})
                  </Text>
                  <Flex gap="1" wrap="wrap">
                    {taskTypes.map((name) => (
                      <CapabilityItem key={`task:${name}`} value={`task:${name}`} />
                    ))}
                  </Flex>
                </Box>
              )}
              {worker.tags && worker.tags.length > 0 && (
                <Box>
                  <Text style={{ fontSize: 10, color: 'var(--gray-8)', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'block', marginBottom: 4 }}>
                    Tags ({worker.tags.length})
                  </Text>
                  <Flex gap="1" wrap="wrap">
                    {worker.tags.map((tag) => (
                      <Badge key={tag} size="1" variant="surface" color="gray">{tag}</Badge>
                    ))}
                  </Flex>
                </Box>
              )}
            </>
          )}
        </Box>
      )}

      {activeTab === 'workflows' && (
        <WorkflowTable workflows={[...runningWorkflows, ...recentWorkflows]} onSelect={onSelectWorkflow} />
      )}

    </Box>
  );
}

const PAGE_SIZE = 5;

function WorkflowTable({ workflows, onSelect }: { workflows: WorkflowListItem[]; onSelect?: (wf: WorkflowListItem) => void }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(workflows.length / PAGE_SIZE));
  const paged = workflows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (workflows.length === 0) {
    return <Text style={{ fontSize: 12, color: 'var(--gray-8)' }}>No workflows</Text>;
  }
  return (
    <Box>
      <Table.Root variant="surface" size="1" className="orcher-compact-table">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>Type</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Execution ID</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Started</Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {paged.map((wf) => (
            <Table.Row
              key={wf.executionId}
              style={{ cursor: onSelect ? 'pointer' : 'default' }}
              onClick={() => onSelect?.(wf)}
            >
            <Table.Cell>
              <Text weight="medium">{wf.workflowType}</Text>
            </Table.Cell>
            <Table.Cell>
              <Text color="gray" style={{ fontFamily: 'monospace', fontSize: 'inherit' }} truncate>
                {wf.executionId.slice(0, 16)}...
              </Text>
            </Table.Cell>
            <Table.Cell>
              <Badge size="1" variant="soft" color={wf.status === 'completed' ? 'green' : wf.status === 'running' ? 'blue' : wf.status === 'failed' ? 'red' : 'gray'}>
                {wf.status}
              </Badge>
            </Table.Cell>
            <Table.Cell>
              <Text color="gray" style={{ fontSize: 'inherit' }}>{timeAgo(wf.startedAt)}</Text>
            </Table.Cell>
          </Table.Row>
        ))}
        </Table.Body>
      </Table.Root>
      {totalPages > 1 && (
        <Flex justify="between" align="center" mt="2">
          <Text style={{ fontSize: 11, color: 'var(--gray-8)' }}>{workflows.length} total</Text>
          <Flex gap="1" align="center">
            <Box
              onClick={() => setPage(Math.max(0, page - 1))}
              style={{ padding: '2px 8px', fontSize: 11, cursor: page === 0 ? 'default' : 'pointer', color: page === 0 ? 'var(--gray-6)' : 'var(--gray-11)' }}
            >
              Prev
            </Box>
            <Text style={{ fontSize: 11, color: 'var(--gray-8)' }}>{page + 1}/{totalPages}</Text>
            <Box
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              style={{ padding: '2px 8px', fontSize: 11, cursor: page >= totalPages - 1 ? 'default' : 'pointer', color: page >= totalPages - 1 ? 'var(--gray-6)' : 'var(--gray-11)' }}
            >
              Next
            </Box>
          </Flex>
        </Flex>
      )}
    </Box>
  );
}

function CopyableValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Flex align="center" gap="1" onClick={handleCopy} style={{ cursor: 'pointer', overflow: 'hidden' }} title="Click to copy">
      <Text style={{ color: 'var(--gray-12)', fontFamily: 'monospace', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value}
      </Text>
      {copied
        ? <CheckIcon width={11} height={11} style={{ color: 'var(--green-9)', flexShrink: 0 }} />
        : <CopyIcon width={11} height={11} style={{ color: 'var(--gray-7)', flexShrink: 0 }} />
      }
    </Flex>
  );
}

// ============================================================================
// Main component
// ============================================================================

interface WorkerDetailProps {
  workerId: string;
  onSelectWorkflow?: (wf: WorkflowListItem) => void;
}

export function WorkerDetail({ workerId, onSelectWorkflow }: WorkerDetailProps) {
  const toast = useToastActions();
  const { workers } = useWorkerList();
  const { workflows } = useWorkflowList();
  const worker = workers.find((w) => w.id === workerId);

  // Parse capabilities into workflow types and task types
  const { workflowTypes, taskTypes } = useMemo(() => {
    if (!worker?.capabilities) return { workflowTypes: [] as string[], taskTypes: [] as string[] };
    const wf: string[] = [];
    const t: string[] = [];
    for (const cap of worker.capabilities) {
      if (cap.startsWith('workflow:')) wf.push(cap.replace('workflow:', ''));
      else if (cap.startsWith('task:')) t.push(cap.replace('task:', ''));
    }
    return { workflowTypes: wf, taskTypes: t };
  }, [worker?.capabilities]);

  // Find workflows that match this worker's capabilities
  const relatedWorkflows = useMemo(() => {
    if (!workflowTypes.length) return [];
    return workflows
      .filter((wf) => workflowTypes.includes(wf.workflowType))
      .sort((a, b) => new Date(b.startedAt ?? 0).getTime() - new Date(a.startedAt ?? 0).getTime())
      .slice(0, 20);
  }, [workflows, workflowTypes]);

  const runningWorkflows = relatedWorkflows.filter((wf) => wf.status === 'running');
  const recentWorkflows = relatedWorkflows.filter((wf) => wf.status !== 'running');
  const [confirmAction, setConfirmAction] = useState<'drain' | 'remove' | null>(null);

  if (!worker && workers.length === 0) {
    return <DetailSkeleton />;
  }

  if (!worker) {
    return (
      <Flex align="center" justify="center" p="6">
        <Text color="gray">Worker not found</Text>
      </Flex>
    );
  }

  const utilPct = worker.maxConcurrentTasks > 0
    ? Math.round((worker.currentTaskCount / worker.maxConcurrentTasks) * 100)
    : 0;

  const isStale = worker.lastHeartbeat
    ? (Date.now() - new Date(worker.lastHeartbeat).getTime()) > 300_000
    : true;

  return (
    <Flex direction="column" style={{ height: '100%', overflow: 'hidden' }}>
      <Flex direction="column" gap="4" p="3" style={{ flexShrink: 0 }}>

        {/* ── General ── */}
        <Box>
          <Flex justify="between" align="center" mb="1">
            <Text style={{ fontSize: 10, color: 'var(--gray-12)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>General</Text>
            <KebabMenu items={[
              { icon: <MinusCircledIcon width={13} height={13} />, label: 'Drain Worker', onClick: () => setConfirmAction('drain') },
              { separator: true },
              { icon: <CrossCircledIcon width={13} height={13} />, label: 'Remove Worker', onClick: () => setConfirmAction('remove'), danger: true },
            ]} />
          </Flex>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 16px' }}>
            <Text style={{ color: 'var(--gray-8)', fontSize: 12 }}>Worker ID</Text>
            <CopyableValue value={worker.workerId} />
            <DetailRow label="Name" value={worker.name || '—'} help="Display name set during worker registration" />
            <DetailRow label="Type" value={worker.workerType || 'standard'} help="Worker type determines which task queues this worker polls" />
            {worker.hostAddress && <DetailRow label="Host" value={`${worker.hostAddress}${worker.port ? ':' + worker.port : ''}`} mono help="Network address where this worker is reachable" />}
            <DetailRow label="Heartbeat" value={worker.lastHeartbeat ? `${timeAgo(worker.lastHeartbeat)}` : 'Never'} help="Last time the worker sent a heartbeat. Workers are considered stale after 5 minutes" />
            <DetailRow label="Registered" value={formatTimestamp(worker.createdAt)} mono help="When this worker first connected to the server" />
          </div>
        </Box>

        {/* ── Resources ── */}
        <Box>
          <Text style={{ fontSize: 10, color: 'var(--gray-12)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Resources</Text>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 16px' }}>
            <DetailRow label="CPU Cores" value={worker.cpuCores != null ? String(worker.cpuCores) : '—'} help={worker.cpuCores != null ? 'CPU cores reported by the worker' : 'Not reported. Set via worker.with_resources(cpu_cores, memory_mb, disk_mb) in your SDK'} />
            <DetailRow label="Memory" value={worker.memoryMb != null ? (worker.memoryMb >= 1024 ? `${(worker.memoryMb / 1024).toFixed(1)} GB` : `${worker.memoryMb} MB`) : '—'} help={worker.memoryMb != null ? 'Memory reported by the worker' : 'Not reported. Set via worker.with_resources(cpu_cores, memory_mb, disk_mb) in your SDK'} />
            <DetailRow label="Disk Space" value={worker.diskSpaceMb != null ? (worker.diskSpaceMb >= 1024 ? `${(worker.diskSpaceMb / 1024).toFixed(1)} GB` : `${worker.diskSpaceMb} MB`) : '—'} help={worker.diskSpaceMb != null ? 'Disk space reported by the worker' : 'Not reported. Set via worker.with_resources(cpu_cores, memory_mb, disk_mb) in your SDK'} />
          </div>
        </Box>

        {/* ── Metadata ── */}
        {worker.metadata && Object.keys(worker.metadata).length > 0 && (
          <Box>
            <Text style={{ fontSize: 10, color: 'var(--gray-12)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Metadata</Text>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 16px' }}>
              {Object.entries(worker.metadata).map(([key, val]) => (
                <DetailRow key={key} label={key} value={typeof val === 'object' ? JSON.stringify(val) : String(val)} mono />
              ))}
            </div>
          </Box>
        )}

        {/* ── Capacity bar ── */}
        <Box>
          <Flex justify="between" mb="1">
            <Flex align="center" gap="1">
              <Text style={{ fontSize: 11, color: 'var(--gray-8)' }}>Capacity</Text>
              <HelpTip content="Task slot utilization. Set max slots via maxConcurrentTasks in your worker config" />
            </Flex>
            <Text style={{ fontSize: 11, color: 'var(--gray-8)' }}>{worker.currentTaskCount}/{worker.maxConcurrentTasks} slots ({utilPct}%)</Text>
          </Flex>
          <div style={{ height: 4, background: 'var(--gray-a3)', overflow: 'hidden' }}>
            <div style={{
              width: `${utilPct}%`,
              height: '100%',
              background: utilPct > 80 ? 'var(--red-9)' : utilPct > 50 ? 'var(--orange-9)' : 'var(--gray-9)',
              transition: 'width 0.3s',
            }} />
          </div>
        </Box>

        {/* Stale warning */}
        {isStale && (
          <Box style={{ borderLeft: '3px solid var(--orange-9)', background: 'var(--orange-a2)', padding: '8px 12px' }}>
            <Text style={{ color: 'var(--orange-9)', fontSize: 11, fontWeight: 500, display: 'block', marginBottom: 2 }}>
              Worker may be disconnected
            </Text>
            <Text style={{ color: 'var(--orange-9)', fontSize: 11 }}>
              {worker.lastHeartbeat
                ? `Last heartbeat was ${timeAgo(worker.lastHeartbeat)}. Check if the worker process is still running.`
                : 'No heartbeat has ever been received. The worker may not have started successfully.'
              }
            </Text>
          </Box>
        )}

      </Flex>

      {/* ── Tabs (fills remaining space) ── */}
      <Box px="3" pb="3" style={{ flex: 1, overflow: 'hidden' }}>
        <WorkerTabs
          worker={worker}
          workflowTypes={workflowTypes}
          taskTypes={taskTypes}
          runningWorkflows={runningWorkflows}
          recentWorkflows={recentWorkflows}
          onSelectWorkflow={onSelectWorkflow}
        />
      </Box>
      <ConfirmDialog
        open={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        onConfirm={async () => {
          // TODO: Wire to actual drain/remove API when available
          toast.info(`${confirmAction} is not yet implemented in the backend`);
          setConfirmAction(null);
        }}
        title={confirmAction === 'drain' ? 'Drain Worker' : 'Remove Worker'}
        message={
          confirmAction === 'drain'
            ? `Drain "${worker.name || worker.workerId}"? The worker will stop accepting new tasks and finish current ones before going idle.`
            : `Remove "${worker.name || worker.workerId}" from the system? This will unregister the worker. It can re-register by reconnecting.`
        }
        confirmLabel={confirmAction === 'drain' ? 'Drain' : 'Remove'}
        variant={confirmAction === 'remove' ? 'danger' : 'default'}
      />
    </Flex>
  );
}
