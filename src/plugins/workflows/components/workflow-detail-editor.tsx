'use client';

import { useState } from 'react';
import { useToastActions } from '@orcher/workbench-ui';
import {
  Box,
  Text,
  Heading,
  Badge,
  Flex,
  Spinner,
  Button,
} from '@radix-ui/themes';
import { ReloadIcon, CopyIcon, CheckIcon, StopIcon, CrossCircledIcon, ResetIcon } from '@radix-ui/react-icons';
import {
  useWorkflowStatus,
  useJournal,
  useLogs,
  apiCancelWorkflow,
  apiResetWorkflow,
} from '../../../hooks/use-orcher-api';
import { JournalTimeline } from '../../../plugins/journal/components/journal-timeline';
import { TasksSection } from './tasks-section';
import { TimelineSection } from './timeline-section';
import { GraphSection } from './graph-section';
import { LogsSection } from './logs-section';
import { KebabMenu } from '../../../components/kebab-menu';
import { ConfirmDialog } from '../../../components/confirm-dialog';
import { DetailSkeleton } from '../../../components/loading-skeleton';
import { getSetting } from '../../../hooks/use-settings';

interface WorkflowDetailProps {
  workflowId: string;
  executionId?: string;
}

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

type TabId = 'tasks' | 'timeline' | 'graph' | 'journal' | 'logs';

function formatTimestamp(ts?: string): string {
  if (!ts) return '—';
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatDuration(start?: string, end?: string): string {
  if (!start || !end) return '—';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(1)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

// ============================================================================
// Copyable ID field
// ============================================================================

function CopyableId({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <Text style={{ color: 'var(--gray-8)', fontSize: 12 }}>{label}</Text>
      <Flex
        align="center"
        gap="1"
        onClick={handleCopy}
        style={{ cursor: 'pointer', overflow: 'hidden' }}
        title="Click to copy"
      >
        <Text style={{
          color: 'var(--gray-12)', fontFamily: 'monospace', fontSize: 12,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {value}
        </Text>
        {copied
          ? <CheckIcon width={11} height={11} style={{ color: 'var(--green-9)', flexShrink: 0 }} />
          : <CopyIcon width={11} height={11} style={{ color: 'var(--gray-7)', flexShrink: 0 }} />
        }
      </Flex>
    </>
  );
}

// ============================================================================
// Main component
// ============================================================================

export function WorkflowDetailEditor({ workflowId, executionId }: WorkflowDetailProps) {
  const [activeTab, setActiveTab] = useState<TabId>('tasks');
  const [confirmAction, setConfirmAction] = useState<'cancel' | 'terminate' | 'reset' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const toast = useToastActions();
  const { status, loading, error, refresh } = useWorkflowStatus(workflowId);
  const {
    entries: journalEntries,
    loading: journalLoading,
    refresh: refreshJournal,
  } = useJournal(workflowId, executionId ?? workflowId);
  const {
    logs,
    loading: logsLoading,
    refresh: refreshLogs,
  } = useLogs(workflowId);

  const executeAction = async () => {
    setActionLoading(true);
    try {
      if (confirmAction === 'cancel') {
        await apiCancelWorkflow(workflowId, 'Cancelled from dashboard');
        refresh();
      } else if (confirmAction === 'terminate') {
        await apiCancelWorkflow(workflowId, 'Terminated from dashboard', true);
        refresh();
      } else if (confirmAction === 'reset') {
        // For reset, we use event ID 1 as default — in a real implementation
        // the confirm dialog would have an input field for the event ID
        await apiResetWorkflow(workflowId, 1, 'Reset from dashboard');
        refresh();
        refreshJournal();
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  };

  if (loading) {
    return <DetailSkeleton />;
  }

  if (error) {
    return (
      <Flex direction="column" align="center" justify="center" gap="2" p="6" style={{ height: '100%' }}>
        <Text color="red" weight="bold">Connection Error</Text>
        <Text size="2" color="gray">{error}</Text>
        <Button size="1" variant="soft" onClick={refresh}>Retry</Button>
      </Flex>
    );
  }

  const currentStatus = status?.status ?? 'unknown';
  const taskCount = journalEntries.filter(
    (e) => e.eventType.includes('TaskScheduled') || e.eventType.includes('Taskscheduled'),
  ).length;

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'tasks', label: 'Tasks', count: taskCount },
    { id: 'timeline', label: 'Timeline' },
    { id: 'graph', label: 'Graph' },
    { id: 'journal', label: 'Journal', count: journalEntries.length },
    { id: 'logs', label: 'Logs', count: logs.length },
  ];

  // Execute an action directly (bypass confirmation dialog)
  const executeActionDirect = async (action: 'cancel' | 'terminate' | 'reset') => {
    setActionLoading(true);
    try {
      if (action === 'cancel') {
        await apiCancelWorkflow(workflowId, 'Cancelled from dashboard');
        refresh();
      } else if (action === 'terminate') {
        await apiCancelWorkflow(workflowId, 'Terminated from dashboard', true);
        refresh();
      } else if (action === 'reset') {
        await apiResetWorkflow(workflowId, 1, 'Reset from dashboard');
        refresh();
        refreshJournal();
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAction = (action: 'cancel' | 'terminate' | 'reset') => {
    if (action === 'cancel' && !getSetting('workflows.confirmCancel', true)) {
      executeActionDirect('cancel');
    } else if (action === 'reset' && !getSetting('workflows.confirmReset', true)) {
      executeActionDirect('reset');
    } else {
      setConfirmAction(action);
    }
  };

  // Build kebab menu items based on status
  const menuItems = [];
  if (currentStatus === 'running') {
    menuItems.push({ icon: <StopIcon width={13} height={13} />, label: 'Cancel', onClick: () => handleAction('cancel') });
    menuItems.push({ icon: <CrossCircledIcon width={13} height={13} />, label: 'Terminate', onClick: () => setConfirmAction('terminate'), danger: true });
  }
  if (currentStatus === 'failed' || currentStatus === 'completed') {
    menuItems.push({ icon: <ResetIcon width={13} height={13} />, label: 'Reset', onClick: () => handleAction('reset') });
  }

  return (
    <Flex direction="column" style={{ height: '100%' }}>
      {/* ── Header ── */}
      <Box style={{ flexShrink: 0, borderBottom: '1px solid var(--gray-a3)' }}>
        <Flex p="3" gap="3" align="center">
          <Heading size="3">{status?.workflowType || workflowId}</Heading>
          <Badge
            color={STATUS_COLORS[currentStatus] ?? 'gray'}
            size="1"
            variant="soft"
          >
            {currentStatus.toUpperCase()}
          </Badge>
          <Box style={{ flex: 1 }} />
          <Flex gap="3" align="center">
            <Button
              size="1"
              variant="ghost"
              color="gray"
              onClick={() => { refresh(); refreshJournal(); refreshLogs(); }}
            >
              <ReloadIcon width={14} height={14} />
            </Button>
            {menuItems.length > 0 && (
              <KebabMenu disabled={actionLoading} items={menuItems} />
            )}
          </Flex>
        </Flex>

        {/* Error banner */}
        {status?.error && (
          <Flex align="start" gap="2" px="3" pb="2">
            <Box style={{
              width: '100%',
              padding: '8px 12px',
              background: 'var(--red-a2)',
              borderLeft: '3px solid var(--red-9)',
            }}>
              <Text style={{ fontSize: 11, color: 'var(--red-9)', fontWeight: 500, display: 'block', marginBottom: 2 }}>
                Error
              </Text>
              <Text style={{ fontSize: 12, color: 'var(--red-11)', lineHeight: 1.4 }}>
                {status.error}
              </Text>
            </Box>
          </Flex>
        )}

        {/* Details grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto 1fr',
            gap: '4px 16px',
            padding: '0 12px 10px',
            fontSize: 12,
          }}
        >
          <CopyableId label="Execution ID" value={status?.executionId ?? workflowId} />
          <CopyableId label="Workflow ID" value={status?.workflowId ?? '—'} />

          <Text style={{ color: 'var(--gray-8)', fontSize: 12 }}>Namespace</Text>
          <Text style={{ color: 'var(--gray-12)', fontSize: 12 }}>
            {status?.namespace || '—'}
          </Text>
          <Text style={{ color: 'var(--gray-8)', fontSize: 12 }}>Task Queue</Text>
          <Text style={{ color: 'var(--gray-12)', fontSize: 12 }}>
            {status?.taskQueue || '—'}
          </Text>

          <Text style={{ color: 'var(--gray-8)', fontSize: 12 }}>Started</Text>
          <Text style={{ color: 'var(--gray-12)', fontFamily: 'monospace', fontSize: 12 }}>
            {formatTimestamp(status?.startedAt)}
          </Text>
          <Text style={{ color: 'var(--gray-8)', fontSize: 12 }}>Completed</Text>
          <Text style={{ color: 'var(--gray-12)', fontFamily: 'monospace', fontSize: 12 }}>
            {formatTimestamp(status?.completedAt)}
          </Text>

          <Text style={{ color: 'var(--gray-8)', fontSize: 12 }}>Duration</Text>
          <Text style={{ color: 'var(--gray-12)', fontFamily: 'monospace', fontSize: 12 }}>
            {formatDuration(status?.startedAt, status?.completedAt)}
          </Text>
          <Text style={{ color: 'var(--gray-8)', fontSize: 12 }}>Status</Text>
          <Text style={{ color: 'var(--gray-12)', fontSize: 12 }}>
            {currentStatus}
          </Text>
        </div>
      </Box>

      {/* ── Tab bar ── */}
      <Flex style={{ borderBottom: '1px solid var(--gray-a3)', flexShrink: 0, padding: '0 12px' }}>
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

      {/* ── Tab content ── */}
      <Box style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'tasks' && (
          <Box p="3">
            {journalLoading ? (
              <Flex align="center" gap="2" p="4">
                <Spinner size="1" />
                <Text size="2" color="gray">Loading tasks...</Text>
              </Flex>
            ) : (
              <TasksSection entries={journalEntries} />
            )}
          </Box>
        )}

        {activeTab === 'timeline' && (
          <TimelineSection entries={journalEntries} loading={journalLoading} />
        )}

        {activeTab === 'graph' && (
          <GraphSection entries={journalEntries} loading={journalLoading} />
        )}

        {activeTab === 'journal' && (
          journalLoading ? (
            <Flex align="center" gap="2" p="4">
              <Spinner size="1" />
              <Text size="2" color="gray">Loading journal...</Text>
            </Flex>
          ) : (
            <JournalTimeline
              executionId={status?.executionId ?? workflowId}
              entries={journalEntries}
            />
          )
        )}

        {activeTab === 'logs' && <LogsSection logs={logs} loading={logsLoading} />}
      </Box>

      {/* ── Confirm dialog ── */}
      <ConfirmDialog
        open={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        onConfirm={executeAction}
        title={
          confirmAction === 'cancel' ? 'Cancel Workflow'
          : confirmAction === 'terminate' ? 'Terminate Workflow'
          : 'Reset Workflow'
        }
        message={
          confirmAction === 'cancel'
            ? `Cancel "${status?.workflowType}"? The workflow will stop gracefully and run cleanup handlers.`
          : confirmAction === 'terminate'
            ? `Terminate "${status?.workflowType}"? This immediately stops the workflow without cleanup. Use Cancel for graceful shutdown.`
          : `Reset "${status?.workflowType}" to a previous state? The workflow will replay from the reset point.`
        }
        confirmLabel={
          confirmAction === 'cancel' ? 'Cancel Workflow'
          : confirmAction === 'terminate' ? 'Terminate'
          : 'Reset'
        }
        variant={confirmAction === 'terminate' ? 'danger' : 'default'}
        loading={actionLoading}
      />
    </Flex>
  );
}
