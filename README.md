# Orcher Dashboard

Workflow orchestration dashboard for [Orcher](https://github.com/orcher-io/orcher), built on [Workbench](https://github.com/orcher-io/workbench), a plugin-based React shell.

## Prerequisites

- Node.js >= 20
- pnpm

## Setup

The dashboard talks to a running engine. `pnpm dev` proxies `/api/v1` to
`ORCHER_ENGINE_URL` (default `http://localhost:8080`), as if the engine served
the page:

```bash
git clone https://github.com/orcher-io/ui.git
cd ui
pnpm install
ORCHER_ENGINE_URL=http://localhost:8080 pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). If the engine requires a
credential, the dashboard asks for an API key (`orcher api-key create`); an
engine without authentication opens straight to the dashboard.

## Build

`pnpm build` writes static files to `out/`. The engine serves them on its HTTP
port, beside `/api/v1`, so the dashboard has no server of its own: it calls the
engine's REST API from the browser, same-origin, with the signed-in key as a
Bearer token. Whatever serves `out/` must answer unknown paths with
`index.html`.

The build also writes `out/_next/static/third-party-notices.txt`: the licence of
every third-party package in the browser bundle. A package under a licence not
on `ALLOWED_LICENSES` in `next.config.js` fails the build.

## Releasing

Bump `version` in `package.json` in a pull request, merge it, then push the tag:

```bash
git tag v0.2.0 && git push origin v0.2.0
```

The Release workflow builds the dashboard and publishes `orcher-ui-<version>.tar.gz`
(the static files, `LICENSE` and `THIRD_PARTY_NOTICES`) with its SHA-256 and a
build-provenance attestation on a GitHub release. The engine image is built
from a pinned release of it.

## Developing Workbench alongside

The `@orcher/workbench-*` packages come from npm. To change Workbench and see
it here immediately, point `WORKBENCH_DIR` at a Workbench checkout and its
sources are used in place of the packages:

```bash
git clone https://github.com/orcher-io/workbench.git ../workbench
(cd ../workbench && pnpm install)
WORKBENCH_DIR=../workbench pnpm dev
```

## Architecture

The data hooks request the dashboard's `/api/*` routes through `apiFetch`
(`src/lib/api-transport.ts`). The standalone dashboard answers those routes in
the browser (`src/lib/engine-routes.ts`) by calling the engine
(`src/lib/gateway-client.ts`). An app that embeds these components and serves
`/api/*` itself, as the hosted console does, keeps the default transport,
plain `fetch`.

The dashboard uses the Workbench shell (tabs, splits, command palette, plugin system) and adds Orcher-specific plugins:

- **orcher-connection** — Server connection management and settings
- **orcher-workflows** — Workflow explorer, detail views, lifecycle commands (cancel, terminate, reset)
- **orcher-journal** — Execution journal timeline viewer with color-coded event types

## License

Apache-2.0 — see [LICENSE](LICENSE).
