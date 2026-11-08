'use client';

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { useTheme, useToastActions } from '@orcher/workbench-ui';
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
  TextArea,
  Theme,
} from '@radix-ui/themes';
import {
  PlusIcon,
  ReloadIcon,
  TrashIcon,
  Cross1Icon,
} from '@radix-ui/react-icons';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useNamespaceList,
  apiCreateNamespace,
  apiDeleteNamespace,
  apiDeprecateNamespace,
  type NamespaceItem,
} from '../../../hooks/use-orcher-api';
import { HelpTip } from '../../../components/help-tip';
import { TableSkeleton } from '../../../components/loading-skeleton';

const STATUS_COLORS: Record<string, 'green' | 'orange' | 'red' | 'gray'> = {
  active: 'green',
  deprecated: 'orange',
  deleted: 'red',
};

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '\u2014';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

const INITIAL_SIZE = { width: 440, height: 480 };
const MIN_SIZE = { width: 340, height: 360 };

function CreateNamespacePanel({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;

}) {
  const { appearance } = useTheme();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [retention, setRetention] = useState('7');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dragging state
  const [pos, setPos] = useState({ x: -1, y: -1 });
  const [size, setSize] = useState(INITIAL_SIZE);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDir, setResizeDir] = useState<string | null>(null);
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0, px: 0, py: 0 });

  // Center on first open
  useEffect(() => {
    if (open && pos.x === -1) {
      setPos({
        x: Math.max(0, (window.innerWidth - INITIAL_SIZE.width) / 2),
        y: Math.max(0, (window.innerHeight - INITIAL_SIZE.height) / 3),
      });
    }
  }, [open]);

  // Lock body scroll when open
  useEffect(() => {
    if (!open) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = orig; };
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Drag handlers
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
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [isDragging]);

  // Resize handlers
  const onEdgeMouseDown = useCallback((dir: string) => (e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeDir(dir);
    resizeStart.current = {
      x: e.clientX, y: e.clientY,
      w: size.width, h: size.height,
      px: pos.x, py: pos.y,
    };
  }, [size, pos]);

  useEffect(() => {
    if (!isResizing || !resizeDir) return;
    const onMove = (e: globalThis.MouseEvent) => {
      const dx = e.clientX - resizeStart.current.x;
      const dy = e.clientY - resizeStart.current.y;
      let w = resizeStart.current.w;
      let h = resizeStart.current.h;
      let px = resizeStart.current.px;
      let py = resizeStart.current.py;

      if (resizeDir.includes('e')) w = Math.max(MIN_SIZE.width, w + dx);
      if (resizeDir.includes('s')) h = Math.max(MIN_SIZE.height, h + dy);
      if (resizeDir.includes('w')) {
        const wd = Math.min(dx, w - MIN_SIZE.width);
        w -= wd;
        px += wd;
      }
      if (resizeDir.includes('n')) {
        const hd = Math.min(dy, h - MIN_SIZE.height);
        h -= hd;
        py += hd;
      }
      setSize({ width: w, height: h });
      setPos({ x: Math.max(0, px), y: Math.max(0, py) });
    };
    const onUp = () => { setIsResizing(false); setResizeDir(null); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [isResizing, resizeDir]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await apiCreateNamespace({
        name: name.trim(),
        description: description.trim() || undefined,
        retention_period_days: Number(retention) || 7,
        owner_email: ownerEmail.trim() || undefined,
      });
      setName('');
      setDescription('');
      setRetention('7');
      setOwnerEmail('');
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
            left: pos.x,
            top: pos.y,
            width: size.width,
            height: size.height,
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
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
              display: 'flex',
              alignItems: 'center',
              height: '36px',
              backgroundColor: 'var(--gray-2)',
              borderBottom: '1px solid var(--gray-a5)',
              padding: '0 12px',
              cursor: isDragging ? 'grabbing' : 'grab',
              userSelect: 'none',
              flexShrink: 0,
            }}
          >
            <Text size="2" weight="medium" style={{ flex: 1 }}>
              Create Namespace
            </Text>
            <Button size="1" variant="ghost" color="gray" onClick={onClose}>
              <Cross1Icon width={14} height={14} />
            </Button>
          </Box>

          {/* Content */}
          <Box style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
            <Text size="2" color="gray" mb="3" as="p">
              Create a new namespace to organize workflow executions.
            </Text>
            <Flex direction="column" gap="3">
              <label>
                <Text size="2" weight="medium" mb="1" as="div">Name</Text>
                <TextField.Root
                  placeholder="e.g. production, staging"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>

              <label>
                <Text size="2" weight="medium" mb="1" as="div">Description</Text>
                <TextArea
                  placeholder="Optional description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </label>

              <label>
                <Text size="2" weight="medium" mb="1" as="div">Retention (days)</Text>
                <TextField.Root
                  type="number"
                  value={retention}
                  onChange={(e) => setRetention(e.target.value)}
                  min="1"
                />
              </label>

              <label>
                <Text size="2" weight="medium" mb="1" as="div">Owner Email</Text>
                <TextField.Root
                  placeholder="owner@example.com"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                />
              </label>

              {error && <Text size="2" color="red">{error}</Text>}
            </Flex>
          </Box>

          {/* Footer */}
          <Flex
            gap="3"
            justify="end"
            style={{
              padding: '12px 16px',
              flexShrink: 0,
            }}
          >
            <Button variant="soft" color="gray" onClick={onClose}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!name.trim() || creating}>
              {creating ? <Spinner size="1" /> : 'Create'}
            </Button>
          </Flex>

          {/* Resize handles — edges */}
          <div onMouseDown={onEdgeMouseDown('n')} style={{ position: 'absolute', top: 0, left: 12, right: 12, height: 6, cursor: 'n-resize' }} />
          <div onMouseDown={onEdgeMouseDown('s')} style={{ position: 'absolute', bottom: 0, left: 12, right: 12, height: 6, cursor: 's-resize' }} />
          <div onMouseDown={onEdgeMouseDown('w')} style={{ position: 'absolute', top: 12, bottom: 12, left: 0, width: 6, cursor: 'w-resize' }} />
          <div onMouseDown={onEdgeMouseDown('e')} style={{ position: 'absolute', top: 12, bottom: 12, right: 0, width: 6, cursor: 'e-resize' }} />
          {/* Resize handles — corners */}
          <div onMouseDown={onEdgeMouseDown('nw')} style={{ position: 'absolute', top: 0, left: 0, width: 12, height: 12, cursor: 'nw-resize' }} />
          <div onMouseDown={onEdgeMouseDown('ne')} style={{ position: 'absolute', top: 0, right: 0, width: 12, height: 12, cursor: 'ne-resize' }} />
          <div onMouseDown={onEdgeMouseDown('sw')} style={{ position: 'absolute', bottom: 0, left: 0, width: 12, height: 12, cursor: 'sw-resize' }} />
          <div onMouseDown={onEdgeMouseDown('se')} style={{ position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, cursor: 'se-resize' }} />
        </motion.div>
        </Theme>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function NamespacesTable() {
  const { namespaces, loading, error, refresh } = useNamespaceList();
  const [createOpen, setCreateOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const toast = useToastActions();

  const handleDeprecate = async (name: string) => {
    if (!confirm(`Deprecate namespace "${name}"?`)) return;
    setActionLoading(name);
    try {
      await apiDeprecateNamespace(name);
      refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete namespace "${name}"? This cannot be undone.`)) return;
    setActionLoading(name);
    try {
      await apiDeleteNamespace(name);
      refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  if (error) {
    return (
      <Box p="6" style={{ textAlign: 'center' }}>
        <Heading size="4" color="red" mb="2">Connection Error</Heading>
        <Text size="2" color="gray">{error}</Text>
        <Box mt="3">
          <Button variant="soft" onClick={refresh}>
            <ReloadIcon /> Retry
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Flex direction="column" style={{ height: '100%' }}>
      {/* Toolbar */}
      <Flex p="3" gap="3" align="center"
        style={{ borderBottom: '1px solid var(--gray-a3)', flexShrink: 0 }}
      >
        <Heading size="3">Namespaces</Heading>
        <HelpTip content="Namespaces isolate workflows, schedules, and workers. Use them to separate environments (dev/staging/prod) or teams" alwaysVisible />
        <Badge variant="soft" color="gray">{namespaces.length}</Badge>
        <Box style={{ flex: 1 }} />
        <Button size="1" onClick={() => setCreateOpen(true)}>
          <PlusIcon width={12} height={12} /> Create
        </Button>
        <Button variant="ghost" size="2" onClick={refresh}>
          <ReloadIcon />
        </Button>
      </Flex>

      {/* Table */}
      <ScrollArea style={{ flex: 1 }}>
        {loading ? (
          <TableSkeleton rows={6} columns={6} />
        ) : namespaces.length === 0 ? (
          <Flex direction="column" align="center" justify="center" p="6" gap="2">
            <Text size="2" color="gray">No namespaces found</Text>
            <Text size="1" color="gray">Create a namespace to organize workflow executions</Text>
          </Flex>
        ) : (
          <Box p="3">
          <Table.Root variant="surface" size="1" className="orcher-compact-table">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Description</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell><Flex align="center" gap="1">Retention <HelpTip content="How long completed workflow data is kept before automatic cleanup (in days)" alwaysVisible /></Flex></Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Owner</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Created</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {namespaces.map((ns) => (
                <Table.Row key={ns.name}>
                  <Table.Cell>
                    <Text weight="medium">{ns.name}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge
                      size="1"
                      variant="soft"
                      color={STATUS_COLORS[ns.status] ?? 'gray'}
                    >
                      {ns.status}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Text color="gray" truncate style={{ fontSize: 'inherit', maxWidth: 300 }}>
                      {ns.description || '\u2014'}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text style={{ fontSize: 'inherit' }}>{ns.retention_period_days}d</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text color="gray" style={{ fontSize: 'inherit' }}>{ns.owner_email || '\u2014'}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text color="gray" style={{ fontSize: 'inherit' }}>{timeAgo(ns.created_at)}</Text>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
          </Box>
        )}
      </ScrollArea>

      <CreateNamespacePanel
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={refresh}
      />
    </Flex>
  );
}
