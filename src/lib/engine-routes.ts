/**
 * The dashboard's `/api/*` routes, answered in the browser.
 *
 * The data hooks speak to `/api/*` (see api-transport.ts). Hosted next to a
 * server, those paths are server routes; the standalone dashboard is static
 * files the engine serves, so the same routes run here instead, calling the
 * engine's REST API directly. Each keeps the response shape its server
 * counterpart had, which is what the hooks and components read.
 */
import {
  EngineError,
  cancelExecution,
  createBatchOperation,
  createNamespace,
  createSchedule,
  deleteNamespace,
  deleteSchedule,
  deprecateNamespace,
  getExecutionJournal,
  getExecutionLogs,
  getExecutionStatus,
  getNamespace,
  getSchedule,
  listBatchOperations,
  listExecutions,
  listNamespaces,
  listScheduleExecutions,
  listSchedules,
  listWorkers,
  pauseSchedule,
  resetExecution,
  resumeSchedule,
  terminateBatchOperation,
  updateNamespace,
} from './gateway-client';

type Params = Record<string, string>;
type Handler = (request: Request, params: Params, url: URL) => Promise<Response>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** An engine failure as the server routes reported it: 401 passes through, the rest is 502. */
function failure(err: unknown, fallback: string): Response {
  const message = err instanceof Error && err.message ? err.message : fallback;
  if (err instanceof EngineError && err.status === 401) {
    return json({ error: message }, 401);
  }
  return json({ error: message }, 502);
}

function attempt(fallback: string, run: () => Promise<Response>): Promise<Response> {
  return run().catch((err) => failure(err, fallback));
}

const num = (url: URL, name: string, fallback: number) =>
  Number(url.searchParams.get(name) ?? String(fallback));

interface Route {
  method: string;
  pattern: RegExp;
  names: string[];
  handler: Handler;
}

const routes: Route[] = [];

function route(method: string, path: string, handler: Handler): void {
  const names: string[] = [];
  const pattern = new RegExp(
    '^' +
      path.replace(/:(\w+)/g, (_, name: string) => {
        names.push(name);
        return '([^/]+)';
      }) +
      '$',
  );
  routes.push({ method, pattern, names, handler });
}

// ── Workflows ────────────────────────────────────────────────────────────────

route('GET', '/api/workflows', (_req, _p, url) =>
  attempt('Failed to list workflows', async () => {
    const result = await listExecutions({
      status: url.searchParams.get('status') ?? undefined,
      workflowName: url.searchParams.get('workflowName') ?? undefined,
      namespace: url.searchParams.get('namespace') ?? undefined,
      limit: num(url, 'limit', 10000),
      offset: num(url, 'offset', 0),
    });
    return json({
      workflows: (result.executions ?? []).map((exec) => ({
        executionId: exec.executionId,
        workflowId: exec.executionId,
        workflowType: exec.workflowName,
        status: exec.status.toLowerCase(),
        startedAt: exec.submittedAt,
        completedAt: exec.completedAt,
        namespace: exec.namespace ?? '',
        taskQueue: exec.taskQueue ?? '',
        durationMs: exec.durationMs,
      })),
      totalCount: result.total ?? 0,
    });
  }),
);

route('GET', '/api/workflows/:id', (_req, { id }) =>
  attempt('Failed to get workflow status', async () => {
    const result = await getExecutionStatus(id);
    return json({
      executionId: result.executionId,
      workflowId: result.executionId,
      status: result.status.toLowerCase(),
      workflowType: result.workflowName,
      // Older engines leave these out of the status
      taskQueue: result.taskQueue ?? '',
      namespace: result.namespace ?? '',
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      error: result.error,
    });
  }),
);

route('GET', '/api/workflows/:id/journal', (_req, { id }) =>
  attempt('Failed to get execution journal', async () =>
    json({ entries: await getExecutionJournal(id) }),
  ),
);

route('GET', '/api/workflows/:id/logs', (_req, { id }) =>
  attempt('Failed to get execution logs', async () => json({ logs: await getExecutionLogs(id) })),
);

route('POST', '/api/workflows/:id/cancel', (req, { id }) =>
  attempt('Failed to cancel workflow', async () => {
    const body = await req.json().catch(() => ({}));
    return json(await cancelExecution(id, body.reason ?? ''));
  }),
);

route('POST', '/api/workflows/:id/reset', async (req, { id }) => {
  const body = await req.json().catch(() => ({}));
  try {
    return json(await resetExecution(id, Number(body.target_event_id), body.reason ?? ''));
  } catch (err) {
    // What the engine refused, and why, is the caller's to know: a bad entry
    // (400), an unknown execution (404), a run that may not be reset now (409)
    if (err instanceof EngineError && [400, 404, 409].includes(err.status)) {
      return json({ error: err.message }, err.status);
    }
    return failure(err, 'Failed to reset workflow');
  }
});

// ── Namespaces ───────────────────────────────────────────────────────────────

route('GET', '/api/namespaces', (_req, _p, url) =>
  attempt('Failed to list namespaces', async () =>
    json({ namespaces: await listNamespaces(num(url, 'limit', 100), num(url, 'offset', 0)) }),
  ),
);

route('POST', '/api/namespaces', (req) =>
  attempt('Failed to create namespace', async () => json(await createNamespace(await req.json()))),
);

route('GET', '/api/namespaces/:name', (_req, { name }) =>
  attempt('Failed to get namespace', async () => json(await getNamespace(name))),
);

route('PUT', '/api/namespaces/:name', (req, { name }) =>
  attempt('Failed to update namespace', async () => json(await updateNamespace(name, await req.json()))),
);

route('DELETE', '/api/namespaces/:name', (_req, { name }) =>
  attempt('Failed to delete namespace', async () => {
    await deleteNamespace(name);
    return json({ ok: true });
  }),
);

// POST on a namespace deprecates it
route('POST', '/api/namespaces/:name', (_req, { name }) =>
  attempt('Failed to deprecate namespace', async () => {
    await deprecateNamespace(name);
    return json({ ok: true });
  }),
);

// ── Schedules ────────────────────────────────────────────────────────────────

route('GET', '/api/schedules', (_req, _p, url) =>
  attempt('Failed to list schedules', async () =>
    json(await listSchedules(num(url, 'limit', 100), num(url, 'offset', 0))),
  ),
);

route('POST', '/api/schedules', (req) =>
  attempt('Failed to create schedule', async () => json(await createSchedule(await req.json()))),
);

route('GET', '/api/schedules/:id', (_req, { id }) =>
  attempt('Failed to get schedule', async () => json(await getSchedule(id))),
);

route('DELETE', '/api/schedules/:id', (_req, { id }) =>
  attempt('Failed to delete schedule', async () => {
    await deleteSchedule(id);
    return json({ ok: true });
  }),
);

// POST ?action=pause|resume
route('POST', '/api/schedules/:id', async (_req, { id }, url) => {
  const action = url.searchParams.get('action');
  if (action !== 'pause' && action !== 'resume') {
    return json({ error: 'Unknown action' }, 400);
  }
  return attempt(`Failed to ${action} schedule`, async () => {
    await (action === 'pause' ? pauseSchedule(id) : resumeSchedule(id));
    return json({ ok: true });
  });
});

route('GET', '/api/schedules/:id/executions', (_req, { id }, url) =>
  attempt('Failed to list schedule executions', async () =>
    json(await listScheduleExecutions(id, num(url, 'limit', 20), num(url, 'offset', 0))),
  ),
);

// ── Workers ──────────────────────────────────────────────────────────────────

route('GET', '/api/workers', (_req, _p, url) =>
  attempt('Failed to list workers', async () =>
    json(await listWorkers(num(url, 'limit', 500), num(url, 'offset', 0))),
  ),
);

// ── Batch operations ─────────────────────────────────────────────────────────

route('GET', '/api/batch-operations', (_req, _p, url) =>
  attempt('Failed to list batch operations', async () =>
    json(
      await listBatchOperations(
        num(url, 'limit', 50),
        num(url, 'offset', 0),
        url.searchParams.get('status') ?? undefined,
      ),
    ),
  ),
);

route('POST', '/api/batch-operations', (req) =>
  attempt('Failed to create batch operation', async () =>
    json(await createBatchOperation(await req.json())),
  ),
);

route('POST', '/api/batch-operations/:id/terminate', (_req, { id }) =>
  attempt('Failed to terminate batch operation', async () => json(await terminateBatchOperation(id))),
);

// ── Dashboard ────────────────────────────────────────────────────────────────

// Where the dashboard's engine is: the origin that served it
route('GET', '/api/config', async () =>
  json({ gatewayUrl: typeof window === 'undefined' ? '' : window.location.origin }),
);

/** Answer a dashboard `/api/*` request; 404 for a path no route claims. */
export async function handleApiRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  for (const { method, pattern, names, handler } of routes) {
    if (method !== request.method) continue;
    const match = pattern.exec(url.pathname);
    if (!match) continue;
    const params: Params = {};
    names.forEach((name, i) => {
      params[name] = decodeURIComponent(match[i + 1]);
    });
    return handler(request, params, url);
  }
  return json({ error: `No route for ${request.method} ${url.pathname}` }, 404);
}
