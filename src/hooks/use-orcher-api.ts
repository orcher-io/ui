'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api-transport';

// ============================================================================
// Types
// ============================================================================

export interface WorkflowListItem {
  executionId: string;
  workflowId: string;
  workflowType: string;
  status: string;
  startedAt?: string;
  completedAt?: string;
  namespace: string;
  taskQueue: string;
  durationMs?: number;
}

export interface WorkflowStatus {
  executionId: string;
  workflowId: string;
  status: string;
  workflowType: string;
  taskQueue: string;
  namespace: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface NamespaceItem {
  name: string;
  status: string;
  description: string;
  owner_email: string;
  retention_period_days: number;
  created_at: string;
  updated_at: string;
}

export interface JournalEntry {
  eventId: number;
  eventType: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Resolves the effective namespace.
 * If localFilter is set (not 'all'), use it.
 * Otherwise fall back to globalNamespace.
 * Returns undefined for 'all' (no filter).
 */
export function resolveNamespace(localFilter: string, globalNamespace: string): string | undefined {
  if (localFilter && localFilter !== 'all') return localFilter;
  if (globalNamespace && globalNamespace !== 'all') return globalNamespace;
  return undefined;
}

export function useWorkflowList(namespace?: string) {
  const [workflows, setWorkflows] = useState<WorkflowListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (namespace) params.set('namespace', namespace);
      const qs = params.toString();
      const res = await apiFetch(`/api/workflows${qs ? '?' + qs : ''}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setWorkflows(data.workflows ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch workflows');
      setWorkflows([]);
    } finally {
      setLoading(false);
    }
  }, [namespace]);

  useEffect(() => { refresh(); }, [refresh]);

  return { workflows, loading, error, refresh };
}

export function useWorkflowStatus(workflowId: string) {
  const [status, setStatus] = useState<WorkflowStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!workflowId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/workflows/${workflowId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setStatus(await res.json());
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch workflow status');
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { status, loading, error, refresh };
}

export function useJournal(workflowId: string, executionId: string) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!workflowId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/workflows/${workflowId}/journal`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setEntries(data.entries ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch journal');
    } finally {
      setLoading(false);
    }
  }, [workflowId, executionId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { entries, loading, error, refresh };
}

export interface LogEntry {
  id: number;
  timestamp: string;
  level: string;
  message: string;
  step?: string;
  taskId?: string;
}

export function useLogs(workflowId: string) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!workflowId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/workflows/${workflowId}/logs`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setLogs(data.logs ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { logs, loading, error, refresh };
}

// ============================================================================
// Batch Operation Hooks
// ============================================================================

export interface BatchOperationItem {
  id: string;
  operationType: string;
  namespace: string;
  filterStatus?: string;
  filterWorkflowType?: string;
  status: string;
  totalCount: number;
  processedCount: number;
  successCount: number;
  failureCount: number;
  rateLimitPerSecond: number;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export function useBatchOperations() {
  const [operations, setOperations] = useState<BatchOperationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/batch-operations');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setOperations(data.batchOperations ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch batch operations');
      setOperations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { operations, loading, error, refresh };
}

export async function apiCreateBatchOperation(data: {
  operationType: string;
  namespace: string;
  filterStatus?: string;
  filterWorkflowType?: string;
  rateLimitPerSecond?: number;
}) {
  const res = await apiFetch('/api/batch-operations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? `HTTP ${res.status}`); }
  return res.json();
}

export async function apiTerminateBatchOperation(id: string) {
  const res = await apiFetch(`/api/batch-operations/${encodeURIComponent(id)}/terminate`, { method: 'POST' });
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? `HTTP ${res.status}`); }
  return res.json();
}

// ============================================================================
// Schedule Hooks
// ============================================================================

export interface ScheduleItem {
  id: string;
  name: string;
  description?: string;
  cronExpression: string;
  timezone: string;
  enabled: boolean;
  status: string;
  workflowType?: string;
  namespace?: string;
  taskTemplate?: Record<string, unknown>;
  maxInstances?: number;
  overlapPolicy?: string;
  nextRunAt?: string;
  lastRunAt?: string;
  runCount: number;
  successCount: number;
  failureCount: number;
  tags?: string[];
  createdAt: string;
  updatedAt?: string;
}

export function useScheduleList() {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/schedules');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      const items = (data.schedules ?? []).map((s: any) => ({
        ...s,
        workflowType: s.workflowType || s.taskTemplate?.workflowType || s.taskTemplate?.workflow_type,
        namespace: s.namespace || s.taskTemplate?.namespace,
      }));
      setSchedules(items);
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch schedules');
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { schedules, loading, error, refresh };
}

export async function apiPauseSchedule(id: string) {
  const res = await apiFetch(`/api/schedules/${encodeURIComponent(id)}?action=pause`, { method: 'POST' });
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? `HTTP ${res.status}`); }
  return res.json();
}

export async function apiResumeSchedule(id: string) {
  const res = await apiFetch(`/api/schedules/${encodeURIComponent(id)}?action=resume`, { method: 'POST' });
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? `HTTP ${res.status}`); }
  return res.json();
}

export interface ScheduleExecutionItem {
  id: string;
  executionNumber: number;
  scheduledAt: string;
  startedAt?: string;
  completedAt?: string;
  status: string;
  durationMs?: number;
  triggerType: string;
  errorMessage?: string;
  workflowExecutionId?: string;
  workflowName?: string;
  workflowStatus?: string;
}

export function useScheduleExecutions(scheduleId: string) {
  const [executions, setExecutions] = useState<ScheduleExecutionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!scheduleId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/schedules/${encodeURIComponent(scheduleId)}/executions`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setExecutions(data.executions ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch schedule executions');
      setExecutions([]);
    } finally {
      setLoading(false);
    }
  }, [scheduleId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { executions, loading, error, refresh };
}

export async function apiCreateSchedule(data: {
  name: string;
  cronExpression: string;
  timezone?: string;
  workflowType: string;
  taskQueue?: string;
  namespace?: string;
  description?: string;
}) {
  const res = await apiFetch('/api/schedules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: data.name,
      description: data.description,
      cronExpression: data.cronExpression,
      timezone: data.timezone || 'UTC',
      taskTemplate: {
        workflowType: data.workflowType,
        taskQueue: data.taskQueue || 'default',
        namespace: data.namespace || 'default',
        input: {},
      },
    }),
  });
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? `HTTP ${res.status}`); }
  return res.json();
}

export async function apiDeleteSchedule(id: string) {
  const res = await apiFetch(`/api/schedules/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? `HTTP ${res.status}`); }
  return res.json();
}

// ============================================================================
// Worker Hooks
// ============================================================================

export interface WorkerItem {
  id: string;
  workerId: string;
  name: string;
  workerType: string;
  status: string;
  healthStatus: string;
  maxConcurrentTasks: number;
  currentTaskCount: number;
  capabilities: string[];
  tags: string[];
  hostAddress: string;
  port: number;
  cpuCores?: number;
  memoryMb?: number;
  diskSpaceMb?: number;
  metadata?: Record<string, any>;
  lastHeartbeat?: string;
  createdAt: string;
}

export function useWorkerList() {
  const [workers, setWorkers] = useState<WorkerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/workers');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setWorkers(data.workers ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch workers');
      setWorkers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { workers, loading, error, refresh };
}

// ============================================================================
// Namespace Hooks
// ============================================================================

export function useNamespaceList() {
  const [namespaces, setNamespaces] = useState<NamespaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/namespaces');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setNamespaces(data.namespaces ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch namespaces');
      setNamespaces([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { namespaces, loading, error, refresh };
}

export async function apiCreateNamespace(data: {
  name: string;
  description?: string;
  retention_period_days?: number;
  owner_email?: string;
}) {
  const res = await apiFetch('/api/namespaces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export async function apiDeleteNamespace(name: string) {
  const res = await apiFetch(`/api/namespaces/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export async function apiDeprecateNamespace(name: string) {
  const res = await apiFetch(`/api/namespaces/${encodeURIComponent(name)}`, {
    method: 'POST',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ============================================================================
// Actions
// ============================================================================

export async function apiResetWorkflow(
  workflowId: string,
  targetEventId: number,
  reason: string,
) {
  const res = await apiFetch(`/api/workflows/${workflowId}/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_event_id: targetEventId, reason }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export async function apiCancelWorkflow(
  workflowId: string,
  reason: string = '',
  force: boolean = false,
) {
  const res = await apiFetch(`/api/workflows/${workflowId}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason, force }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}
