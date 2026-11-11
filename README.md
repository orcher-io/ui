<p>
  <img alt="ORCHER Dashboard" src="https://raw.githubusercontent.com/orcher-io/ui/main/assets/banner.svg#gh-dark-mode-only" width="100%">
  <img alt="ORCHER Dashboard" src="https://raw.githubusercontent.com/orcher-io/ui/main/assets/banner-light.svg#gh-light-mode-only" width="100%">
</p>

<p align="center"><sub>See every workflow the engine runs, from the engine itself.</sub></p>

<br />

<div>
  <a href="https://github.com/orcher-io/ui/releases/latest"><img src="https://img.shields.io/github/v/release/orcher-io/ui?style=flat-square&labelColor=0a0a0a&color=04B385&logo=github&logoColor=white&label=release" alt="release"></a>
  <a href="https://github.com/orcher-io/ui/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/orcher-io/ui/ci.yml?branch=main&style=flat-square&labelColor=0a0a0a&color=38BDF0&logo=github&logoColor=white&label=CI" alt="CI"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-Apache_2.0-04B385?style=flat-square&labelColor=0a0a0a" alt="Apache 2.0"></a>
</div>

<br />

The ORCHER dashboard is static files the engine serves on its HTTP port, beside
its REST API. It has no server of its own: it calls the engine from the browser.

- <img height="14" src="https://octicons-col.vercel.app/workflow/38BDF0"> **Workflows**: list and filter runs; open one for its tasks, timeline, graph, journal and logs
- <img height="14" src="https://octicons-col.vercel.app/clock/38BDF0"> **Schedules**: create, pause, resume and delete, with each schedule's runs
- <img height="14" src="https://octicons-col.vercel.app/server/38BDF0"> **Workers**: who is connected, their host and resources, and when each last checked in
- <img height="14" src="https://octicons-col.vercel.app/stack/38BDF0"> **Namespaces and batch operations**: manage both from the same shell
- <img height="14" src="https://octicons-col.vercel.app/key/38BDF0"> **Sign-in**: asks for an API key only when the engine requires one
- <img height="14" src="https://octicons-col.vercel.app/columns/38BDF0"> **Tabs and splits**: built on [Workbench](https://github.com/orcher-io/workbench), with a command palette

<br />

### <img height="16" src="https://octicons-col.vercel.app/play/38BDF0"> Use it

Open the engine's HTTP address, `http://localhost:8080` by default. The engine (0.7.0 or
later) serves the files in `ui.dir`, `/usr/share/orcher/ui` unless set; `--no-ui` turns
it off. To serve a release yourself:

```bash
gh release download v0.2.1 --repo orcher-io/ui -p 'orcher-ui-*'
sha256sum -c orcher-ui-0.2.1.tar.gz.sha256
gh attestation verify orcher-ui-0.2.1.tar.gz --repo orcher-io/ui
tar -xzf orcher-ui-0.2.1.tar.gz
ORCHER_UI_DIR=$PWD/orcher-ui-0.2.1 orchestrator
```

> [!NOTE]
> When the engine requires a credential, the dashboard asks for an API key
> (`orcher api-key create`) and keeps it in this browser until you sign out. The
> files themselves are public; the engine decides what a key may see.

<br />

### <img height="16" src="https://octicons-col.vercel.app/tools/38BDF0"> Development

```bash
pnpm install
ORCHER_ENGINE_URL=http://localhost:8080 pnpm dev   # http://localhost:3000
```

`pnpm dev` proxies `/api/v1` to the engine, as if the engine served the page.
`pnpm build` writes the static files to `out/`, plus
`out/_next/static/third-party-notices.txt`: the licence of every package in the
bundle. A licence not on `ALLOWED_LICENSES` in `next.config.js` fails the build.

To work on Workbench at the same time, point `WORKBENCH_DIR` at a checkout and its
sources replace the npm packages:

```bash
git clone https://github.com/orcher-io/workbench.git ../workbench
(cd ../workbench && pnpm install)
WORKBENCH_DIR=../workbench pnpm dev
```

<br />

### <img height="16" src="https://octicons-col.vercel.app/git-merge/38BDF0"> How it reaches the engine

The data hooks request the dashboard's `/api/*` routes through `apiFetch`
([`src/lib/api-transport.ts`](src/lib/api-transport.ts)). This dashboard answers
them in the browser ([`src/lib/engine-routes.ts`](src/lib/engine-routes.ts)) by
calling the engine's REST API, same-origin, with the signed-in key as a Bearer
token. An app that embeds these components and serves `/api/*` itself keeps the
default transport, plain `fetch`.

<br />

### <img height="16" src="https://octicons-col.vercel.app/rocket/38BDF0"> Releasing

Bump `version` in `package.json` in a pull request, merge it, then push the tag:

```bash
git tag v0.2.2 && git push origin v0.2.2
```

The Release workflow publishes `orcher-ui-<version>.tar.gz` (the static files,
`LICENSE` and `THIRD_PARTY_NOTICES`), built reproducibly, with its SHA-256 and a
build-provenance attestation. The engine image pins a release of it.

<br />

### <img height="16" src="https://octicons-col.vercel.app/heart/38BDF0"> Contributing

Issues and pull requests are welcome. CI typechecks and builds every pull request,
the build checking every bundled licence; run `pnpm build` before proposing a change.

### <img height="16" src="https://octicons-col.vercel.app/law/38BDF0"> License

Licensed under the [Apache License, Version 2.0](LICENSE).
