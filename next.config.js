const path = require('path');
const fs = require('fs');

// The workbench packages come from npm. To edit workbench and this app
// together, point WORKBENCH_DIR at a workbench checkout
// (e.g. `WORKBENCH_DIR=../workbench pnpm dev`) and its sources are used instead.
const workbenchRoot = process.env.WORKBENCH_DIR
  ? path.resolve(__dirname, process.env.WORKBENCH_DIR)
  : null;
if (workbenchRoot && !fs.existsSync(path.join(workbenchRoot, 'packages/core/src'))) {
  throw new Error(`WORKBENCH_DIR=${process.env.WORKBENCH_DIR} is not a workbench checkout`);
}

const workbenchSources = {
  '@orcher/workbench-di': 'packages/di/src',
  '@orcher/workbench-plugin-api': 'packages/plugin-api/src',
  '@orcher/workbench-services': 'packages/services/src',
  '@orcher/workbench-ui': 'packages/ui/src',
  '@orcher/workbench-window-manager': 'packages/window-manager/src',
  '@orcher/workbench-core': 'packages/core/src',
  '@orcher/workbench-plugin-header': 'plugins/builtin/header/src',
  '@orcher/workbench-plugin-breadcrumb-bar': 'plugins/builtin/breadcrumb-bar/src',
  '@orcher/workbench-plugin-settings': 'plugins/builtin/settings/src',
  '@orcher/workbench-plugin-explorer': 'plugins/builtin/explorer/src',
};

const { PHASE_DEVELOPMENT_SERVER } = require('next/constants');
const { LicenseWebpackPlugin } = require('license-webpack-plugin');

// Licences a package bundled into the browser build may carry. Anything else
// fails the build until it has been looked at and added here.
const ALLOWED_LICENSES = new Set([
  'MIT',
  'ISC',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  '0BSD',
  'CC0-1.0',
]);

// The engine `next dev` talks to; a build has none, being served by the engine.
const engineUrl = process.env.ORCHER_ENGINE_URL || 'http://localhost:8080';

/**
 * Next vendors React's packages as `<name>-builtin` with no licence field in
 * their package.json; each has its LICENSE file beside it. Claim MIT only for
 * those whose file is the MIT licence, so anything else still fails the build.
 */
function vendoredByNext() {
  const compiled = path.join(path.dirname(require.resolve('next/package.json')), 'dist/compiled');
  const overrides = {};
  for (const dir of fs.readdirSync(compiled)) {
    const manifest = path.join(compiled, dir, 'package.json');
    const license = path.join(compiled, dir, 'LICENSE');
    if (!fs.existsSync(manifest) || !fs.existsSync(license)) continue;
    const { name, license: declared } = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    if (declared || !name?.endsWith('-builtin')) continue;
    if (fs.readFileSync(license, 'utf8').startsWith('MIT License')) overrides[name] = 'MIT';
  }
  return overrides;
}

/** @type {import('next').NextConfig} */
const baseConfig = {
  reactStrictMode: true,
  // Allow an isolated build dir (e.g. to run a second dev server without
  // clobbering the primary .next). Defaults to the standard .next.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  transpilePackages: Object.keys(workbenchSources),
  webpack: (config, { isServer, dev }) => {
    if (!isServer && !dev) {
      // The licence of every third-party package in the browser bundle, which
      // ships beside it (out/_next/static/third-party-notices.txt)
      config.plugins.push(
        new LicenseWebpackPlugin({
          outputFilename: 'static/third-party-notices.txt',
          perChunkOutput: false,
          licenseTypeOverrides: vendoredByNext(),
          // This app's own code is covered by its LICENSE
          excludedPackageTest: (name) => name === require('./package.json').name,
          unacceptableLicenseTest: (license) => !ALLOWED_LICENSES.has(license),
          handleUnacceptableLicense: (name, license) => {
            throw new Error(`${name} is licensed ${license}, which is not on next.config.js's allow-list`);
          },
          handleMissingLicenseType: (name) => {
            throw new Error(`${name} declares no licence`);
          },
        }),
      );
    }
    if (workbenchRoot) {
      config.resolve.alias = {
        ...config.resolve.alias,
        ...Object.fromEntries(
          Object.entries(workbenchSources).map(([name, dir]) => [name, path.join(workbenchRoot, dir)]),
        ),
      };
      // The aliased sources live outside this app's node_modules, so resolve
      // their third-party deps (react, radix, zustand, …) from this app's
      // node_modules. One copy also keeps React a singleton — a duplicate
      // would trigger "invalid hook call".
      config.resolve.modules = [path.join(__dirname, 'node_modules'), 'node_modules'];
    }
    return config;
  },
};

module.exports = (phase) => {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    return {
      ...baseConfig,
      async rewrites() {
        return {
          // The engine's REST API, as if the engine served this page
          beforeFiles: [{ source: '/api/v1/:path*', destination: `${engineUrl}/api/v1/:path*` }],
          // Every other path is the single page, as the engine answers it
          fallback: [{ source: '/:path*', destination: '/' }],
        };
      },
    };
  }
  // A build is static files (out/) that the engine serves on its HTTP port
  return { ...baseConfig, output: 'export' };
};
