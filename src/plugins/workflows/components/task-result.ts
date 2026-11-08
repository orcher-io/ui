/**
 * A task's result as the journal records it.
 *
 * The engine journals a task's result in the StepCompleted entry it appends
 * when the task's step settles, named by the task's id, as JSON. A
 * TaskCompleted journaled by an earlier engine carries the result itself, as
 * base64.
 */

type Payload = Record<string, unknown>;

/** The task id and pretty-printed result of a StepCompleted entry that completed with one. */
export function stepResult(payload: Payload): { taskId: string; result: string } | undefined {
  const taskId = (payload.stepName ?? payload.step_name ?? '') as string;
  const completed = String(payload.status ?? '').toLowerCase() === 'completed';
  if (!taskId || !completed || payload.result === undefined) return undefined;
  return { taskId, result: JSON.stringify(payload.result, null, 2) };
}

/** The result a TaskCompleted entry carries itself, if any, pretty-printed when it is JSON. */
export function journaledTaskResult(payload: Payload): string | undefined {
  if (typeof payload.result !== 'string') return undefined;
  try {
    return JSON.stringify(JSON.parse(atob(payload.result)), null, 2);
  } catch {
    return payload.result;
  }
}
