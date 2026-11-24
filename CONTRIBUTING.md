# Contributing

Issues and pull requests are welcome. For anything larger than a fix, open an
issue first so the approach can be agreed before you write it. Issues labelled
[good first issue](https://github.com/orcher-io/ui/labels/good%20first%20issue)
are a good place to start.

## Set up

You need Node.js 22 or later, [pnpm](https://pnpm.io/installation), and an
engine to point the dashboard at. The
[quickstart](https://github.com/orcher-io/quickstart) starts one with
`docker compose up -d --wait`, and its examples give you workflows to look at.

```bash
git clone https://github.com/orcher-io/ui.git
cd ui
pnpm install
ORCHER_ENGINE_URL=http://localhost:8080 pnpm dev   # http://localhost:3000
```

`pnpm dev` proxies `/api/v1` to the engine, so the page behaves as if the
engine served it.

## Check a change

These are the checks CI runs on every pull request:

```bash
pnpm exec tsc --noEmit -p .   # typecheck
pnpm build                    # static build into out/
```

The build also checks the licence of every package in the bundle. A new
dependency whose licence is not on `ALLOWED_LICENSES` in `next.config.js` fails
it; say so in the pull request rather than adding the licence to the list.

There are no automated tests of the pages yet, so look at your change in the
browser, against a real engine, before you propose it. A screenshot in the pull
request helps when the change is visible.

## Where things are

- `src/plugins/` holds the pages, one directory per area of the dashboard.
- `src/hooks/` holds the data hooks. They request `/api/*` through `apiFetch`
  in `src/lib/api-transport.ts`.
- `src/lib/engine-routes.ts` answers those requests in the browser by calling
  the engine's REST API.

The shell around the pages (the window manager, explorer, header and settings)
comes from [Workbench](https://github.com/orcher-io/workbench). To change both
at once, point `WORKBENCH_DIR` at a checkout and its sources replace the npm
packages:

```bash
git clone https://github.com/orcher-io/workbench.git ../workbench
(cd ../workbench && pnpm install)
WORKBENCH_DIR=../workbench pnpm dev
```

## Pull requests

Keep a pull request to one change. A change that needs something new from the
engine's REST API starts as an issue on
[orcher-io/orcher](https://github.com/orcher-io/orcher).
