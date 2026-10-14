# desk-web

Pure JavaScript client library for the [DESK](https://github.com/valette/desk)
remote desktop server. It exposes the non-UI core as
promise-based ES modules so you can build web apps that talk to a desk server
directly.

- Promise-based API (no callback / `*Async` duality, no `promisify`).
- No browser globals created — import or `require` by name.
- Ships as both **ESM** (browser `<script type="module">`) and **CommonJS**
  (`require()`).
- Single runtime dependency: `socket.io-client`.
- License: BSD-3-Clause.

## Install

```bash
npm install desk-web
```

## Quick start

Connect to a running desk server, then execute actions and use the virtual
filesystem:

```js
import { Actions, FileSystem } from 'desk-web';

// connect to the desk server (same origin, or pass baseURL/username/password)
await Actions.connect();

// execute an RPC action
const res = await Actions.execute( { action : 'mkdirp', directory : 'data/demo' } );

// read / write files (paths are relative to the server root, exposed dirs)
await FileSystem.writeFile( 'data/demo/hello.txt', 'hello\n' );
const content = await FileSystem.readFile( 'data/demo/hello.txt' );
```

From CommonJS:

```js
const { Actions, FileSystem } = require( 'desk-web' );
```

## API

### `Actions`

Singleton RPC dispatcher over Socket.IO.

| Method | Description |
|--------|-------------|
| `connect(options)` | Connect to the server. `options` = `{ baseURL, username, password, static }`. Returns a Promise. |
| `disconnect()` | Disconnect the socket. |
| `execute(params, options)` | Run an action. Returns an **augmented Promise** (see below). |
| `getSettings()` | Snapshot of the server settings / available actions. |
| `getAction(name)` | JSON snapshot of a single action definition. |
| `getEngine()` | `'node'` or `'static'`. |
| `getBaseURL()` | Resolved server base URL. |
| `isConnected()` | Whether the socket is connected. |
| `init()` | Resolves once settings/actions are ready. |
| `on/once/off(event, cb)` | Listen to `'connect'`, `'disconnect'`, `'log'`, `'actionEvent'`, `'action finished'`, `'actions updated'`, `'changeReady'`. |

`Actions` extends a tiny internal `EventEmitter` (`on`, `once`, `off`, `emit`).

#### `execute()` and the augmented Promise

`execute(params, options)` returns a native `Promise` with extra members, giving
you streaming and kill support without callbacks:

```js
const run = Actions.execute( { action : 'sleep', time_in_seconds : 10 }, { stream : true } );

run.handle;              // action handle, available synchronously
run.stream( msg => ... ) // register per-run stdout/stderr listener (msg = {handle,type,data})
await run.kill();        // send { manage:'kill', actionHandle:handle }

const res = await run;   // resolves with the response on success
```

- The promise **resolves** with the full response on success.
- It **rejects** on error or kill. The thrown `Error` carries `.response`,
  `.status` and `.killed` so nothing is lost.
- `options.stream` routes `actionEvent` messages (stdout/stderr/outputDirectory)
  for that run to any `run.stream(cb)` subscribers.

#### Static / recorded mode

If you `connect({ static: true })` (or a `desk_startup_script` global is
present), `Actions` runs against `actions.json` and `cache/responses.json`
without a socket, replaying recorded responses.

### `FileSystem`

Promise-based virtual filesystem. Reads use `fetch`; writes and directory
operations go through the RPC engine.

| Method | Description |
|--------|-------------|
| `readFile(file, options)` | Read a file as text. |
| `readURL(url, options)` | Read an arbitrary URL as text. |
| `writeFile(file, content, options)` | Write a file (`options.binary` for binary). |
| `writeJSON(file, content)` | Write an object as JSON. |
| `writeCachedFile(name, content)` | Content-addressed cache write (SHA-1). |
| `mkdirp(dir)` | Create a directory (idempotent). |
| `exists(path)` | Test for existence. |
| `readDir(path)` | List a directory (array of `{ name, isDirectory, ... }`). |
| `traverse(directory, iterator, opts)` | Walk a tree (`opts.asynchronous`). |
| `executeScript(file)` | Load and run a JS file in the document. |
| `includeScripts(scripts)` | Load script URLs. |
| `downloadFile(file, name)` | Trigger a browser download. |
| `getFileURL(file)` | Translate a server path to a URL. |
| `getFileDirectory(file)` | Directory portion (with trailing `/`). |
| `getFileName(file)` | Basename. |
| `getFileExtension(file)` | Extension. |
| `setBaseURL(url)` / `getBaseURL()` | Override / read the base URL. |

### `URLParameters`

Parses `window.location.href` query parameters (with JSON typing).

| Method | Description |
|--------|-------------|
| `getParameter(name)` | Returns the URL parameter value (or `undefined`). |
| `parseParameters(params)` | Apply URL-provided values onto a params object. |

## Paths and exposed directories

Paths sent to the server are **relative to the server root**. Only the exposed
sub-directories are accessible (defaults: `data`, `code`, plus hidden `cache`,
`actions`, and `home`). Writing to the root itself or arbitrary absolute paths
is rejected by the server. Use `data/...` or `code/...` prefixes.

## Examples

See [`examples/`](examples/) — small HTML pages served over HTTP
(`<script type="module">` importing the bundled `dist/desk-web.mjs`):

- `example-01-actions.html` — connect and list/run actions
- `example-02-filesystem.html` — list a directory and read/write a file
- `example-03-streaming.html` — run an action with streaming output + kill

Run any static server from the package root, e.g.:

```bash
npx serve .
# then open http://localhost:3000/examples/example-01-actions.html?baseURL=...&username=...&password=...
```

The desk server itself can serve these by placing them under an exposed
directory (e.g. `data/`).

## Development

```bash
npm install
npm run build          # esbuild -> dist/desk-web.mjs + dist/desk-web.cjs
npm test               # unit tests (node:test)
npm run test:integration   # launches a real desk server (DESK_ROOTDIR) and tests over Socket.IO
```

The integration test spawns the desk server with a temporary `DESK_ROOTDIR` on
a free `PORT`, connects with default credentials (`$USER` / `password`), and
verifies actions, filesystem round-trips, promise resolution, and kill.

## How it relates to DESK

`desk-web` is a clean-room promise-based reimplementation of the non-widget
core of the DESK client (`desk.Actions`, `desk.FileSystem`,
`desk.URLParameters`), without the UI toolkit. Excluded by design: the
widgets/UI, `AddLibs` (THREE/lodash/d3 injection), `Random`, and the
Electron/NW.js IPC transport.

## License

BSD-3-Clause. See [LICENSE](LICENSE).
