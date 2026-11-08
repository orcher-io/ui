/**
 * Client for the Orcher engine's REST API (`/api/v1`).
 *
 * The standalone dashboard runs it in the browser against the engine that
 * serves the page, so requests are same-origin and carry the API key the user
 * signed in with, if the engine asks for one. `configureEngine` points it
 * elsewhere (a development proxy, a test).
 */

/** A response from the engine that was not a success. */
export class EngineError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'EngineError';
  }
}

export interface EngineConnection {
  /** Origin of the engine; empty for the origin that served the page */
  baseUrl: string;
  /** The API key to send, if any */
  apiKey: () => string | null;
  /** Called whenever the engine refuses a request as unauthenticated */
  onUnauthorized?: () => void;
}

let connection: EngineConnection = { baseUrl: '', apiKey: () => null };

export function configureEngine(update: Partial<EngineConnection>): void {
  connection = { ...connection, ...update };
}

async function engineRequest(path: string, init: RequestInit | undefined, apiKey: string | null): Promise<Response> {
  return fetch(`${connection.baseUrl}/api/v1${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      ...init?.headers,
    },
  });
}

async function gatewayFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await engineRequest(path, init, connection.apiKey());

  if (!res.ok) {
    if (res.status === 401) connection.onUnauthorized?.();
    const body = await res.text().catch(() => '');
    throw new EngineError(res.status, `Engine ${res.status}: ${body || res.statusText}`);
  }

  // DELETE and some actions answer with no body
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/**
 * Whether the engine accepts requests with `apiKey` (or with none, when
 * `apiKey` is null): 'ok', 'unauthorized', or 'unreachable'.
 */
export async function checkEngineAccess(apiKey: string | null): Promise<'ok' | 'unauthorized' | 'unreachable'> {
  try {
    const res = await engineRequest('/namespaces?limit=1', undefined, apiKey);
    if (res.status === 401) return 'unauthorized';
    // 403: the key is accepted but may not list namespaces (a scoped key)
    return res.ok || res.status === 403 ? 'ok' : 'unreachable';
  } catch {
    return 'unreachable';
  }
}

// ============================================================================
// Types (matching gateway REST response models)
// ============================================================================

export interface ExecutionSummary {
  executionId: string;
  workflowName: string;
  workflowVersion: string;
  status: string;
  submittedAt: string;
  completedAt?: string;
  durationMs?: number;
  namespace?: string;
  taskQueue?: string;
  tags?: Record<string, string>;
}

export interface ExecutionStatusResponse {
  executionId: string;
  workflowName: string;
  workflowVersion: string;
  status: string;
  submittedAt: string;
  startedAt?: string;
  completedAt?: string;
  progress?: {
    currentStep: string;
    totalSteps: number;
    completedSteps: number;
    progressPercent: number;
    message?: string;
  };
  error?: string;
  tags?: Record<string, string>;
}

export interface LogEntry {
  id: number;
  executionId: string;
  timestamp: string;
  level: string;
  message: string;
  step?: string;
  taskId?: string;
  workerId?: string;
  metadata?: Record<string, unknown>;
  source?: string;
}

// ============================================================================
// Workflow / Execution API
// ============================================================================

export async function listExecutions(options: {
  workflowName?: string;
  status?: string;
  namespace?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ executions: ExecutionSummary[]; total: number }> {
  const params = new URLSearchParams();
  if (options.workflowName) params.set('workflowName', options.workflowName);
  if (options.status) params.set('status', options.status);
  if (options.namespace) params.set('namespace', options.namespace);
  if (options.limit) params.set('limit', String(options.limit));
  if (options.offset) params.set('offset', String(options.offset));

  const qs = params.toString();
  return gatewayFetch(`/executions${qs ? '?' + qs : ''}`);
}

export async function getExecutionStatus(
  executionId: string,
): Promise<ExecutionStatusResponse> {
  return gatewayFetch(`/executions/${executionId}/status`);
}

export async function getExecutionResult(executionId: string): Promise<any> {
  return gatewayFetch(`/executions/${executionId}/result`);
}

export async function cancelExecution(
  executionId: string,
  reason?: string,
): Promise<any> {
  const params = reason ? `?reason=${encodeURIComponent(reason)}` : '';
  return gatewayFetch(`/executions/${executionId}/cancel${params}`, {
    method: 'POST',
  });
}

export async function getExecutionLogs(
  executionId: string,
): Promise<LogEntry[]> {
  // Gateway returns a plain array, not wrapped in { logs: [...] }
  return gatewayFetch<LogEntry[]>(`/executions/${executionId}/logs`);
}

export interface JournalEntry {
  eventId: number;
  eventType: string;
  timestamp: string;
  payload: Record<string, unknown>;
  taskId: number;
}

export async function getExecutionJournal(
  executionId: string,
): Promise<JournalEntry[]> {
  const response = await gatewayFetch<{ entries: JournalEntry[]; total: number }>(
    `/executions/${executionId}/journal`,
  );
  return response.entries ?? [];
}

// ============================================================================
// Namespace API
// ============================================================================

export interface NamespaceInfo {
  name: string;
  status: string;
  description: string;
  owner_email: string;
  retention_period_days: number;
  created_at: string;
  updated_at: string;
}

export async function listNamespaces(limit = 100, offset = 0): Promise<NamespaceInfo[]> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const response = await gatewayFetch<{ namespaces: NamespaceInfo[] }>(
    `/namespaces?${params}`,
  );
  return response.namespaces ?? [];
}

export async function getNamespace(name: string): Promise<NamespaceInfo> {
  return gatewayFetch(`/namespaces/${encodeURIComponent(name)}`);
}

export async function createNamespace(data: {
  name: string;
  description?: string;
  retention_period_days?: number;
  owner_email?: string;
}): Promise<NamespaceInfo> {
  return gatewayFetch('/namespaces', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateNamespace(
  name: string,
  data: { description?: string; retention_period_days?: number },
): Promise<NamespaceInfo> {
  return gatewayFetch(`/namespaces/${encodeURIComponent(name)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteNamespace(name: string): Promise<void> {
  await gatewayFetch(`/namespaces/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
}

export async function deprecateNamespace(name: string): Promise<void> {
  await gatewayFetch(`/namespaces/${encodeURIComponent(name)}/deprecate`, {
    method: 'POST',
  });
}

// ============================================================================
// Schedule API
// ============================================================================

export interface Schedule {
  id: string;
  name: string;
  description?: string;
  cronExpression: string;
  timezone: string;
  enabled: boolean;
  taskTemplate: Record<string, unknown>;
  maxInstances: number;
  overlapPolicy: string;
  timeoutSeconds?: number;
  startDate?: string;
  endDate?: string;
  maxRuns?: number;
  status: string;
  nextRunAt?: string;
  lastRunAt?: string;
  runCount: number;
  successCount: number;
  failureCount: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export async function listSchedules(limit = 100, offset = 0): Promise<{ schedules: Schedule[]; total: number }> {
  return gatewayFetch(`/schedules?limit=${limit}&offset=${offset}`);
}

export async function getSchedule(id: string): Promise<Schedule> {
  return gatewayFetch(`/schedules/${encodeURIComponent(id)}`);
}

export async function createSchedule(data: {
  name: string;
  description?: string;
  cronExpression: string;
  timezone?: string;
  taskTemplate: { workflowType: string; taskQueue?: string; namespace?: string; input?: unknown };
  maxInstances?: number;
  overlapPolicy?: string;
}): Promise<Schedule> {
  return gatewayFetch('/schedules', { method: 'POST', body: JSON.stringify(data) });
}

export async function pauseSchedule(id: string): Promise<void> {
  await gatewayFetch(`/schedules/${encodeURIComponent(id)}/pause`, { method: 'POST' });
}

export async function resumeSchedule(id: string): Promise<void> {
  await gatewayFetch(`/schedules/${encodeURIComponent(id)}/resume`, { method: 'POST' });
}

export async function deleteSchedule(id: string): Promise<void> {
  await gatewayFetch(`/schedules/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export interface ScheduleExecution {
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

export async function listScheduleExecutions(
  scheduleId: string,
  limit = 20,
  offset = 0,
): Promise<{ executions: ScheduleExecution[]; count: number }> {
  return gatewayFetch(`/schedules/${encodeURIComponent(scheduleId)}/executions?limit=${limit}&offset=${offset}`);
}

// ============================================================================
// Batch Operations API
// ============================================================================

export interface BatchOperation {
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
  eventName?: string;
  resetEventId?: number;
  resetReason?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export async function listBatchOperations(limit = 50, offset = 0, status?: string): Promise<{ batchOperations: BatchOperation[]; total: number }> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (status) params.set('status', status);
  return gatewayFetch(`/batch-operations?${params}`);
}

export async function createBatchOperation(data: {
  operationType: string;
  namespace: string;
  filterStatus?: string;
  filterWorkflowType?: string;
  rateLimitPerSecond?: number;
  eventName?: string;
  eventPayload?: unknown;
  resetEventId?: number;
  resetReason?: string;
}): Promise<BatchOperation> {
  return gatewayFetch('/batch-operations', { method: 'POST', body: JSON.stringify(data) });
}

export async function terminateBatchOperation(id: string): Promise<BatchOperation> {
  return gatewayFetch(`/batch-operations/${encodeURIComponent(id)}/terminate`, { method: 'POST' });
}

// ============================================================================
// Workers API
// ============================================================================

export interface WorkerInfo {
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

export async function listWorkers(limit = 100, offset = 0): Promise<{ workers: WorkerInfo[]; total: number }> {
  return gatewayFetch(`/workers?limit=${limit}&offset=${offset}`);
}
