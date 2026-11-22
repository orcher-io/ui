/**
 * A task's result as the journal records it.
 *
 * The engine journals a task's result in the StepCompleted entry it appends
 * when the task's step settles, named by the task's id, as JSON. A
 * TaskCompleted journaled by an earlier engine carries the result itself, as
 * base64.
 *
 * Either may be a sealed payload rather than the value: `PayloadValue` shows
 * what these return, opening it when a key is set.
 */
import type { ShownPayload } from '../../../components/payload-value';
import { decodeBase64Json } from '../../../lib/payload-seal';

type Payload = Record<string, unknown>;

/** The task id and result of a StepCompleted entry that completed with one. */
export function stepResult(payload: Payload): { taskId: string; result: ShownPayload } | undefined {
  const taskId = (payload.stepName ?? payload.step_name ?? '') as string;
  const completed = String(payload.status ?? '').toLowerCase() === 'completed';
  if (!taskId || !completed || payload.result === undefined) return undefined;
  return { taskId, result: { value: payload.result } };
}

/** The result a TaskCompleted entry carries itself, if any: the value when it is base64 JSON, else the text. */
export function journaledTaskResult(payload: Payload): ShownPayload | undefined {
  if (typeof payload.result !== 'string') return undefined;
  return decodeBase64Json(payload.result) ?? { text: payload.result };
}
