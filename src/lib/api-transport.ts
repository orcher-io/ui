/**
 * How the dashboard's data hooks reach `/api/*`.
 *
 * By default they `fetch` it, for an app that serves those routes itself (the
 * hosted console does, behind its own sign-in). The standalone dashboard has no
 * server of its own, so it installs `engineTransport()`, which answers the same
 * routes in the browser against the engine's REST API.
 */
import { handleApiRequest } from './engine-routes';

export type ApiTransport = (path: string, init?: RequestInit) => Promise<Response>;

let transport: ApiTransport = (path, init) => fetch(path, init);

export function setApiTransport(next: ApiTransport): void {
  transport = next;
}

/** Request one of the dashboard's `/api/*` routes. */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return transport(path, init);
}

/** Answers `/api/*` in the browser by calling the engine directly. */
export function engineTransport(): ApiTransport {
  return (path, init) => handleApiRequest(new Request(new URL(path, window.location.origin), init));
}
