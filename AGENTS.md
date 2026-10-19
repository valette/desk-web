# AGENTS.md

Guidance for AI coding agents (and human contributors) working in this
repository. Read this before editing.

## What this repo is

`desk-web` is a **pure-JavaScript client library** for the DESK
remote desktop server. It re-implements the non-widget core
(`desk.Actions`, `desk.FileSystem`, `desk.URLParameters`) as promise-based ES
modules so web apps can talk to a desk server without the full UI stack.

- Language: JavaScript (ESM source, `"type": "module"`).
- Public API: `src/index.js` → `{ Actions, FileSystem, URLParameters }`.
- Build output: `dist/desk-web.mjs` (ESM, bundled) + `dist/desk-web.cjs`
  (CommonJS, `socket.io-client` external), produced by `scripts/build.mjs`.
- Only runtime dependency: `socket.io-client`.
- License: BSD-3-Clause.

## Design invariants (do not break these)

1. **No browser globals.** Never assign `window.desk` or any other global.
   Everything is imported/exported by name. (`window`/`document` are only
   touched lazily inside methods, guarded so the module loads in Node too.)
2. **Promise-only API.** No callback parameters, no `*Async` suffixes, no
   `promisify`. Public methods return native Promises. If a method is
   synchronous by nature (path helpers), keep it synchronous but do not add
   callback overloads.
3. **Reject on failure.** `Actions.execute` resolves with the response on
   success and **rejects** on error or kill; attach `.response`, `.status`,
   `.killed` to the thrown `Error` (see `toError` in `src/actions.js`).
4. **The augmented execute promise.** `execute()` must return a native Promise
   augmented with `.handle` and `.kill()` so cancellation works without
   callbacks. Streaming output is **launch-time only**: the server only emits
   `actionEvent` when the request carries `stream: true`, so the stream
   listener must be passed in `execute(params, { listener: cb })`, not attached
   after the run starts. Keep this contract.
5. **Paths are root-relative and restricted.** Server file paths must start
   with an exposed directory (`data/`, `code/`, ...). Root (`/`) or arbitrary
   absolute paths are rejected server-side ("path not allowed"). Prefer
   `data/...` in examples and tests.
6. **Browser + Node dual-runtime.** Code must not break when imported in Node
   (used by the CJS build and tests). Guard browser-only APIs
   (`window`, `document`, `fetch`, `crypto.subtle`) and access them lazily.
7. **Internal helpers are not exported.** `src/internals/` (`event-emitter.js`,
   `dom.js`, `sha1.js`) stays private; do not add it to `src/index.js`.

## Public API surface (from `src/index.js`)

- `Actions` — RPC dispatcher: `connect`, `disconnect`, `execute` (augmented
  promise), `getSettings`, `getAction`, `getEngine`, `getBaseURL`, `getSocket`,
  `isConnected`, `init`, plus `on/once/off/emit` (extends the internal
  `EventEmitter`). Transports: `'node'` (Socket.IO) and `'static'` (recorded).
- `FileSystem` — virtual FS: `readFile`, `readURL`, `writeFile`, `writeJSON`,
  `writeCachedFile`, `mkdirp`, `exists`, `readDir`, `traverse`, `executeScript`,
  `includeScripts`, `downloadFile`, `getFileURL`, `getFileDirectory`,
  `getFileName`, `getFileExtension`, `setBaseURL`/`getBaseURL`.
- `URLParameters` — `getParameter`, `parseParameters`.

## Build & test commands

- Build both bundles: `npm run build`
- Unit tests: `npm test` (node:test, `test/*.test.js`)
- Integration test: `npm run test:integration`
  (spawns the real desk server with a temp `DESK_ROOTDIR` + free `PORT`,
  connects with `$USER`/`password`, exercises actions/fs/kill plus streaming
  output and cached-result log replay)

## Conventions

- ESM `import`/`export`; use `async`/`await`.
- Singleton objects are exported as `export const X = new XManager()`.
  Avoid name clashes between the class and the exported const (the classes are
  named `*Manager` for this reason).
- `socket.io-client` is the only runtime dependency; add more only when
  justified and well-maintained (prefer built-ins like `fetch`, `btoa/atob`,
  `crypto.subtle` over extra deps).
- Use `data/...` (not `.` or `/`) when tests/examples need writable paths.
- Rebuild `dist/` after changing `src/` before running the integration test.
