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
  Theme,
} from '@radix-ui/themes';
import { ReloadIcon, PlusIcon, Cross1Icon, StopIcon } from '@radix-ui/react-icons';
import {
  useBatchOperations,
  useNamespaceList,
  useWorkflowList,
  apiCreateBatchOperation,
  apiTerminateBatchOperation,
  type BatchOperationItem,
} from '../../../hooks/use-orcher-api';
import { SearchableSelect } from '../../../components/searchable-select';
import { HelpTip } from '../../../components/help-tip';
import { useTheme, useToastActions } from '@orcher/workbench-ui';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { TableSkeleton } from '../../../components/loading-skeleton';

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

const STATUS_COLORS: Record<string, 'green' | 'blue' | 'red' | 'orange' | 'gray'> = {
  pending: 'gray',
  processing: 'blue',
  completed: 'green',
  failed: 'red',
  terminated: 'orange',
};

const OP_LABELS: Record<string, string> = {
  terminate: 'Terminate',
  cancel: 'Cancel',
  send_event: 'Send Event',
  reset: 'Reset',
};

// ============================================================================
// Create Batch Operation Panel
// ============================================================================

function CreateBatchPanel({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [opType, setOpType] = useState('terminate');
  const [namespace, setNamespace] = useState('default');
  const [filterStatus, setFilterStatus] = useState('running');
  const [filterWorkflowType, setFilterWorkflowType] = useState('');
  const [rateLimit, setRateLimit] = useState('50');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { namespaces } = useNamespaceList();
  const { workflows } = useWorkflowList();
  const { appearance } = useTheme();

  const workflowTypeOptions = useMemo(() => {
    const types = new Set(workflows.map((wf) => wf.workflowType).filter(Boolean));
    return [
      { value: '', label: 'All workflow types' },
      ...Array.from(types).sort().map((t) => ({ value: t, label: t })),
    ];
  }, [workflows]);

  // Dragging
  const [pos, setPos] = useState({ x: -1, y: -1 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 });

  useEffect(() => {
    if (open && pos.x === -1) {
      setPos({
        x: Math.max(0, (window.innerWidth - 460) / 2),
        y: Math.max(0, (window.innerHeight - 500) / 3),
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
    setCreating(true);
    setError(null);
    try {
      await apiCreateBatchOperation({
        operationType: opType,
        namespace,
        filterStatus: filterStatus || undefined,
        filterWorkflowType: filterWorkflowType.trim() || undefined,
        rateLimitPerSecond: Number(rateLimit) || 50,
      });
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
              position: 'fixed',
              left: pos.x, top: pos.y,
              width: 460, zIndex: 9999,
              display: 'flex', flexDirection: 'column',
              backgroundColor: 'var(--gray-1)',
              borderRadius: 0,
              border: '0.5px solid var(--gray-a6)',
              boxShadow: '0 16px 50px rgba(0, 0, 0, 0.5)',
              overflow: 'hidden',
            }}
          >
            <Box
              onMouseDown={onTitleMouseDown}
              style={{
                display: 'flex', alignItems: 'center', height: 36,
                backgroundColor: 'var(--gray-2)', borderBottom: '1px solid var(--gray-a5)',
                padding: '0 12px',
                cursor: isDragging ? 'grabbing' : 'grab',
                userSelect: 'none', flexShrink: 0,
              }}
            >
              <Text size="2" weight="medium" style={{ flex: 1 }}>Create Batch Operation</Text>
              <Button size="1" variant="ghost" color="gray" onClick={onClose}>
                <Cross1Icon width={14} height={14} />
              </Button>
            </Box>

            <Box style={{ padding: 16, overflow: 'auto', maxHeight: '60vh' }}>
              <Flex direction="column" gap="3">
                <Box>
                  <Text style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 2 }}>Operation Type *</Text>
                  <SearchableSelect
                    value={opType}
                    onChange={setOpType}
                    width="100%"
                    options={[
                      { value: 'terminate', label: 'Terminate — stop matching workflows' },
                      { value: 'cancel', label: 'Cancel — gracefully cancel matching workflows' },
                      { value: 'send_event', label: 'Send Event — deliver event to matching workflows' },
                      { value: 'reset', label: 'Reset — reset matching workflows to a journal point' },
                    ]}
                  />
                </Box>
                <Box>
                  <Text style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 2 }}>Namespace *</Text>
                  <SearchableSelect
                    value={namespace}
                    onChange={setNamespace}
                    width="100%"
                    placeholder="Select namespace"
                    options={[
                      { value: 'default', label: 'default' },
                      ...namespaces.filter((ns) => ns.status === 'active' && ns.name !== 'default').map((ns) => ({ value: ns.name, label: ns.name })),
                    ]}
                  />
                </Box>
                <Box>
                  <Text style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 2 }}>Filter by Status</Text>
                  <SearchableSelect
                    value={filterStatus}
                    onChange={setFilterStatus}
                    width="100%"
                    options={[
                      { value: '', label: 'Any status' },
                      { value: 'running', label: 'Running' },
                      { value: 'completed', label: 'Completed' },
                      { value: 'failed', label: 'Failed' },
                      { value: 'pending', label: 'Pending' },
                    ]}
                  />
                </Box>
                <Box>
                  <Text style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 2 }}>Filter by Workflow Type</Text>
                  <SearchableSelect
                    value={filterWorkflowType}
                    onChange={setFilterWorkflowType}
                    width="100%"
                    placeholder="Select or type workflow type"
                    searchPlaceholder="Search workflow types..."
                    allowCustom
                    options={workflowTypeOptions}
                  />
                </Box>
                <label>
                  <Flex align="center" gap="1"><Text style={{ fontSize: 12, fontWeight: 500 }}>Rate Limit (operations/sec)</Text><HelpTip content="Max workflows processed per second. Higher values complete faster but increase server load" /></Flex>
                  <TextField.Root
                    type="number"
                    value={rateLimit}
                    onChange={(e) => setRateLimit(e.target.value)}
                    min="1"
                    max="1000"
                  />
                </label>
                {error && <Text style={{ fontSize: 12, color: 'var(--red-9)' }}>{error}</Text>}
              </Flex>
            </Box>

            <Flex gap="3" justify="end" style={{ padding: '12px 16px', flexShrink: 0 }}>
              <Button variant="soft" color="gray" onClick={onClose}>Cancel</Button>
              <Button onClick={handleCreate} disabled={creating} color={opType === 'terminate' ? 'red' : undefined}>
                {creating ? <Spinner size="1" /> : `Create ${OP_LABELS[opType] ?? opType}`}
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
// Main Table
// ============================================================================

export function BatchOperationsTable() {
  const { operations, loading, error, refresh } = useBatchOperations();
  const [createOpen, setCreateOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const toast = useToastActions();

  const handleTerminate = async (id: string) => {
    if (!confirm('Terminate this batch operation?')) return;
    setActionLoading(id);
    try { await apiTerminateBatchOperation(id); refresh(); }
    catch (err: any) { toast.error(err.message); }
    finally { setActionLoading(null); }
  };

  if (error) {
    return (
      <Box p="6" style={{ textAlign: 'center' }}>
        <Heading size="4" color="red" mb="2">Connection Error</Heading>
        <Text size="2" color="gray">{error}</Text>
        <Box mt="3"><Button variant="soft" onClick={refresh}><ReloadIcon /> Retry</Button></Box>
      </Box>
    );
  }

  return (
    <Flex direction="column" style={{ height: '100%' }}>
      <Flex p="3" gap="3" align="center" style={{ borderBottom: '1px solid var(--gray-a3)', flexShrink: 0 }}>
        <Heading size="3">Batch Operations</Heading>
        <HelpTip content="Batch operations apply bulk actions (terminate, cancel, reset) to workflows matching a filter. Use the CLI: orcher batch start --type terminate" alwaysVisible />
        <Badge variant="soft" color="gray">{operations.length}</Badge>
        <Box style={{ flex: 1 }} />
        <Button size="1" onClick={() => setCreateOpen(true)}>
          <PlusIcon width={12} height={12} /> New Batch
        </Button>
        <Button variant="ghost" size="2" onClick={refresh}><ReloadIcon /></Button>
      </Flex>

      <ScrollArea style={{ flex: 1 }}>
        {loading ? (
          <TableSkeleton rows={5} columns={6} />
        ) : operations.length === 0 ? (
          <Flex direction="column" align="center" justify="center" p="6" gap="2">
            <Text size="2" color="gray">No batch operations</Text>
            <Text size="1" color="gray">Create a batch operation to perform bulk actions on workflows</Text>
          </Flex>
        ) : (
          <Box p="3">
            <Table.Root variant="surface" size="1" className="orcher-compact-table">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell><Flex align="center" gap="1">Type <HelpTip content="The action to apply: terminate, cancel, send event, or reset" alwaysVisible /></Flex></Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell><Flex align="center" gap="1">Filter <HelpTip content="Namespace, status, and workflow type filter that selects which workflows are affected" alwaysVisible /></Flex></Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell><Flex align="center" gap="1">Progress <HelpTip content="Number of workflows processed out of total matching the filter" alwaysVisible /></Flex></Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Created</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell style={{ width: 60 }}></Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {operations.map((op) => {
                  const pct = op.totalCount > 0 ? Math.round((op.processedCount / op.totalCount) * 100) : 0;
                  const isActive = op.status === 'pending' || op.status === 'processing';
                  return (
                    <Table.Row key={op.id}>
                      <Table.Cell>
                        <Badge size="1" variant="soft" color={op.operationType === 'terminate' ? 'red' : op.operationType === 'cancel' ? 'orange' : 'gray'}>
                          {OP_LABELS[op.operationType] ?? op.operationType}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>
                        <Flex direction="column" gap="0">
                          <Text style={{ fontSize: 'inherit' }}>{op.namespace}</Text>
                          <Text style={{ fontSize: 10, color: 'var(--gray-8)' }}>
                            {[op.filterStatus, op.filterWorkflowType].filter(Boolean).join(' · ') || 'all workflows'}
                          </Text>
                        </Flex>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge size="1" variant="soft" color={STATUS_COLORS[op.status] ?? 'gray'}>
                          {op.status}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>
                        <Flex align="center" gap="2">
                          <div style={{ width: 60, height: 6, background: 'var(--gray-a3)', overflow: 'hidden' }}>
                            <div style={{
                              width: `${pct}%`, height: '100%',
                              background: op.failureCount > 0 ? 'var(--red-9)' : 'var(--gray-9)',
                              transition: 'width 0.3s',
                            }} />
                          </div>
                          <Text style={{ fontSize: 10, color: 'var(--gray-8)', whiteSpace: 'nowrap' }}>
                            {op.processedCount}/{op.totalCount}
                          </Text>
                        </Flex>
                      </Table.Cell>
                      <Table.Cell>
                        <Text color="gray" style={{ fontSize: 'inherit' }}>{timeAgo(op.createdAt)}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        {isActive && (
                          <Button size="1" variant="ghost" color="red"
                            disabled={actionLoading === op.id}
                            onClick={() => handleTerminate(op.id)}
                            title="Stop batch operation"
                          >
                            <StopIcon width={12} height={12} />
                          </Button>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Root>
          </Box>
        )}
      </ScrollArea>

      <CreateBatchPanel open={createOpen} onClose={() => setCreateOpen(false)} onCreated={refresh} />
    </Flex>
  );
}
