'use client';

import { useState, useCallback, useRef, useEffect, useMemo, type MouseEvent as ReactMouseEvent } from 'react';
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
  TextField,
  TextArea,
  Theme,
} from '@radix-ui/themes';
import { ReloadIcon, PlusIcon, Cross1Icon } from '@radix-ui/react-icons';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { SearchableSelect } from '../../../components/searchable-select';
import { CronBuilder } from '../../../components/cron-builder';
import { HelpTip } from '../../../components/help-tip';
import { useTheme, useToastActions } from '@orcher/workbench-ui';
import { useGlobalNamespace } from '../../../contexts/namespace-context';
import { resolveNamespace } from '../../../hooks/use-orcher-api';
import {
  useScheduleList,
  useNamespaceList,
  useWorkflowList,
  apiPauseSchedule,
  apiResumeSchedule,
  apiDeleteSchedule,
  apiCreateSchedule,
  type ScheduleItem,
} from '../../../hooks/use-orcher-api';

import { cronToText } from '../../../utils/cron-text';
import { useDrawer } from '../../../contexts/drawer-context';
import { TableSkeleton } from '../../../components/loading-skeleton';

const TIMEZONE_OPTIONS: { value: string; label: string }[] = (() => {
  try {
    const zones = Intl.supportedValuesOf('timeZone');
    return [
      { value: 'UTC', label: 'UTC' },
      ...zones.filter((z) => z !== 'UTC').map((z) => ({ value: z, label: z.replace(/_/g, ' ') })),
    ];
  } catch {
    // Fallback for older runtimes
    return [
      { value: 'UTC', label: 'UTC' },
      { value: 'America/New_York', label: 'America/New York' },
      { value: 'America/Chicago', label: 'America/Chicago' },
      { value: 'America/Denver', label: 'America/Denver' },
      { value: 'America/Los_Angeles', label: 'America/Los Angeles' },
      { value: 'Europe/London', label: 'Europe/London' },
      { value: 'Europe/Berlin', label: 'Europe/Berlin' },
      { value: 'Europe/Paris', label: 'Europe/Paris' },
      { value: 'Asia/Tokyo', label: 'Asia/Tokyo' },
      { value: 'Asia/Shanghai', label: 'Asia/Shanghai' },
      { value: 'Asia/Kolkata', label: 'Asia/Kolkata' },
      { value: 'Australia/Sydney', label: 'Australia/Sydney' },
    ];
  }
})();

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

interface SchedulesTableProps {
  onSelectSchedule?: (schedule: ScheduleItem) => void;
}

// ============================================================================
// Create Schedule Panel
// ============================================================================

function CreateSchedulePanel({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [cronExpr, setCronExpr] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [workflowType, setWorkflowType] = useState('');
  const [taskQueue, setTaskQueue] = useState('default');
  const [namespace, setNamespace] = useState('default');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { namespaces: nsList } = useNamespaceList();
  const { workflows } = useWorkflowList();
  const { appearance } = useTheme();

  const handleWorkflowTypeChange = useCallback((type: string) => {
    setWorkflowType(type);
    // Auto-fill from the most recent workflow execution of this type
    const match = workflows.find((wf) => wf.workflowType === type);
    if (match) {
      if (match.namespace) setNamespace(match.namespace);
      if (match.taskQueue) setTaskQueue(match.taskQueue);
    }
  }, [workflows]);

  // Extract unique workflow types from existing workflows
  const workflowTypeOptions = useMemo(() => {
    const types = new Set<string>();
    for (const wf of workflows) {
      if (wf.workflowType) types.add(wf.workflowType);
    }
    return [...types].sort().map((t) => ({ value: t, label: t }));
  }, [workflows]);

  const [pos, setPos] = useState({ x: -1, y: -1 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 });

  useEffect(() => {
    if (open && pos.x === -1) {
      setPos({
        x: Math.max(0, (window.innerWidth - 560) / 2),
        y: Math.max(0, (window.innerHeight - 520) / 3),
      });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => { document.body.style.overflow = orig; document.removeEventListener('keydown', handler); };
  }, [open, onClose]);

  const onTitleMouseDown = useCallback((e: ReactMouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
  }, [pos]);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: globalThis.MouseEvent) => {
      setPos({
        x: Math.max(0, dragStart.current.px + e.clientX - dragStart.current.x),
        y: Math.max(0, dragStart.current.py + e.clientY - dragStart.current.y),
      });
    };
    const onUp = () => setIsDragging(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, [isDragging]);

  const handleCreate = async () => {
    if (!name.trim() || !cronExpr.trim() || !workflowType.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await apiCreateSchedule({
        name: name.trim(),
        cronExpression: cronExpr.trim(),
        timezone,
        workflowType: workflowType.trim(),
        taskQueue: taskQueue.trim() || 'default',
        namespace: namespace.trim() || 'default',
        description: description.trim() || undefined,
      });
      setName(''); setCronExpr(''); setWorkflowType(''); setDescription('');
      onClose();
      onCreated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  if (typeof window === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <Theme appearance={appearance} accentColor="gray">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            style={{
              position: 'fixed', left: pos.x, top: pos.y,
              width: 560, zIndex: 9999,
              display: 'flex', flexDirection: 'column',
              backgroundColor: 'var(--gray-1)',
              borderRadius: 0,
              border: '0.5px solid var(--gray-a6)',
              boxShadow: '0 16px 50px rgba(0, 0, 0, 0.5)',
              overflow: 'hidden',
            }}
          >
            {/* Title bar */}
            <Box
              onMouseDown={onTitleMouseDown}
              style={{
                display: 'flex', alignItems: 'center', height: '36px',
                backgroundColor: 'var(--gray-2)', borderBottom: '1px solid var(--gray-a5)',
                padding: '0 12px', cursor: isDragging ? 'grabbing' : 'grab',
                userSelect: 'none', flexShrink: 0,
              }}
            >
              <Text size="2" weight="medium" style={{ flex: 1 }}>Create Schedule</Text>
              <Button size="1" variant="ghost" color="gray" onClick={onClose}>
                <Cross1Icon width={14} height={14} />
              </Button>
            </Box>

            {/* Content */}
            <Box style={{ padding: '16px', overflow: 'auto', maxHeight: '70vh' }}>
              <Flex direction="column" gap="3">
                <label>
                  <Text style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 2 }}>Name *</Text>
                  <TextField.Root placeholder="e.g. daily-report" value={name} onChange={(e) => setName(e.target.value)} />
                </label>
                <Box>
                  <Text style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 2 }}>Workflow Type *</Text>
                  <SearchableSelect
                    value={workflowType}
                    onChange={handleWorkflowTypeChange}
                    width="100%"
                    placeholder="Select or type workflow type"
                    searchPlaceholder="Search workflow types..."
                    allowCustom
                    options={workflowTypeOptions}
                  />
                </Box>
                <Box>
                  <Text style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 2 }}>Schedule *</Text>
                  <CronBuilder value={cronExpr} onChange={setCronExpr} />
                </Box>
                <Flex gap="2">
                  <Box style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 2 }}>Timezone</Text>
                    <SearchableSelect
                      value={timezone}
                      onChange={setTimezone}
                      width="100%"
                      placeholder="Select timezone"
                      searchPlaceholder="Search timezones..."
                      options={TIMEZONE_OPTIONS}
                    />
                  </Box>
                  <label style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 2 }}>Task Queue</Text>
                    <TextField.Root placeholder="default" value={taskQueue} onChange={(e) => setTaskQueue(e.target.value)} />
                  </label>
                </Flex>
                <Box>
                  <Text style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 2 }}>Namespace</Text>
                  <SearchableSelect
                    value={namespace}
                    onChange={setNamespace}
                    placeholder="Select namespace"
                    searchPlaceholder="Search namespaces..."
                    options={[
                      { value: 'default', label: 'default' },
                      ...nsList
                        .filter((ns) => ns.status === 'active' && ns.name !== 'default')
                        .map((ns) => ({ value: ns.name, label: ns.name })),
                    ]}
                  />
                </Box>
                <label>
                  <Text style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 2 }}>Description</Text>
                  <TextArea placeholder="Optional description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                </label>
                {error && <Text style={{ fontSize: 12, color: 'var(--red-9)' }}>{error}</Text>}
              </Flex>
            </Box>

            {/* Footer */}
            <Flex gap="3" justify="end" style={{ padding: '12px 16px', flexShrink: 0 }}>
              <Button variant="soft" color="gray" onClick={onClose}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!name.trim() || !cronExpr.trim() || !workflowType.trim() || creating}>
                {creating ? <Spinner size="1" /> : 'Create'}
              </Button>
            </Flex>
          </motion.div>
        </Theme>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// ============================================================================
// Main table
// ============================================================================

export function SchedulesTable({ onSelectSchedule }: SchedulesTableProps) {
  const { schedules, loading, error, refresh } = useScheduleList();
  const { namespaces } = useNamespaceList();
  const { globalNamespace } = useGlobalNamespace();
  const [namespaceFilter, setNamespaceFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const toast = useToastActions();
  const { activeDrawerId } = useDrawer();

  const effectiveNs = resolveNamespace(namespaceFilter, globalNamespace);
  const filtered = effectiveNs
    ? schedules.filter((s) => s.namespace === effectiveNs)
    : schedules;

  const handlePause = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setActionLoading(id);
    try { await apiPauseSchedule(id); refresh(); }
    catch (err: any) { toast.error(err.message); }
    finally { setActionLoading(null); }
  };

  const handleResume = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setActionLoading(id);
    try { await apiResumeSchedule(id); refresh(); }
    catch (err: any) { toast.error(err.message); }
    finally { setActionLoading(null); }
  };

  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (!confirm(`Delete schedule "${name}"?`)) return;
    setActionLoading(id);
    try { await apiDeleteSchedule(id); refresh(); }
    catch (err: any) { toast.error(err.message); }
    finally { setActionLoading(null); }
  };

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
        style={{ borderBottom: '1px solid var(--gray-a5)', flexShrink: 0 }}
      >
        <Heading size="3">Schedules</Heading>
        <HelpTip content="Schedules run workflows automatically on a cron schedule. Each schedule triggers a new workflow execution at the specified interval" alwaysVisible />
        <Badge variant="soft" color="gray">{filtered.length}</Badge>
        <Box style={{ flex: 1 }} />
        <Button size="1" onClick={() => setCreateOpen(true)}>
          <PlusIcon width={12} height={12} /> Create
        </Button>
        <SearchableSelect
          value={namespaceFilter}
          onChange={setNamespaceFilter}
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
          <TableSkeleton rows={8} columns={8} />
        ) : filtered.length === 0 ? (
          <Flex direction="column" align="center" justify="center" p="6" gap="2">
            <Text size="2" color="gray">No schedules found</Text>
            <Text size="1" color="gray">Create a schedule to automate workflow executions</Text>
          </Flex>
        ) : (
          <Box p="3">
            <Table.Root variant="surface" size="1" className="orcher-compact-table">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Workflow</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell><Flex align="center" gap="1">Schedule <HelpTip content="Human-readable description of the cron schedule" alwaysVisible /></Flex></Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell><Flex align="center" gap="1">Cron <HelpTip content="Cron expression (min hour day month weekday). Example: */5 * * * * = every 5 minutes" alwaysVisible /></Flex></Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Next Run</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Last Run</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Runs</Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {filtered.map((s) => (
                  <Table.Row
                    key={s.id}
                    style={{ cursor: onSelectSchedule ? 'pointer' : 'default', background: activeDrawerId === s.id ? 'var(--gray-a3)' : undefined }}
                    onClick={() => onSelectSchedule?.(s)}
                  >
                    <Table.Cell>
                      <Text weight="medium">{s.name}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text style={{ fontSize: 'inherit' }}>{s.workflowType || '—'}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text style={{ fontSize: 'inherit' }}>
                        {cronToText(s.cronExpression)}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text color="gray" style={{ fontSize: 'inherit', fontFamily: 'monospace' }}>
                        {s.cronExpression}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge
                        size="1"
                        variant="soft"
                        color={s.status === 'paused' || !s.enabled ? 'orange' : s.status === 'active' || s.status === 'processing' ? 'green' : 'gray'}
                      >
                        {s.status === 'paused' || !s.enabled ? 'paused' : s.status}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Text color="gray" style={{ fontSize: 'inherit' }}>
                        {timeAgo(s.nextRunAt)}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text color="gray" style={{ fontSize: 'inherit' }}>
                        {timeAgo(s.lastRunAt)}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text style={{ fontSize: 'inherit' }}>{s.runCount}</Text>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Box>
        )}
      </ScrollArea>

      <CreateSchedulePanel
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={refresh}
      />
    </Flex>
  );
}
