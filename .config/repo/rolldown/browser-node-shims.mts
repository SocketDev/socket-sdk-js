/**
 * @file Browser-safe shims for the Node builtins that survive in the socket-sdk
 *   browser module graph, plus the rolldown plugin that swaps them in. Consumed
 *   by `.config/repo/rolldown.browser.config.mts`. Split out to keep that
 *   config under the file-size cap and to keep the shim bodies (which are
 *   inline JS strings, not typed TS) in one place. Each shim is authored as CJS
 *   (`module.exports = …`) so both `import x from 'node:x'` (default) and
 *   `import { y } from 'node:x'` (named) resolve through rolldown's interop,
 *   and so lib's `require("node:x")` + `__toESM(...)` sees the members it
 *   reads. Builtins the browser genuinely can't provide (`fs`, `crypto`,
 *   `stream/promises`, the `createRequire`-returned loader) throw a clear "not
 *   available in the browser build" error when CALLED — they are only reached
 *   by the SDK's node-only file/upload/hash methods, which a browser consumer
 *   never invokes. The members touched at MODULE-EVAL time are eval-safe (see
 *   the per-shim notes).
 */

import type { Plugin } from 'rolldown'

// `@socketsecurity/lib/dist/node/os.js` is a node-only runtime wrapper: its
// `getNodeOs()` returns `require("os")` when `IS_NODE`, else `undefined`. lib's
// `constants/platform.js` EAGERLY evaluates `const DARWIN = getOs() === 'darwin'`
// at module load, and `getOs()` unconditionally calls `getNodeOs().platform()`.
// In a browser `getNodeOs()` is `undefined`, so that eager line throws at load —
// crashing the whole service worker before any SDK code runs. lib ships no
// `browser` condition for this leaf, so replace it with a browser-safe wrapper
// whose `getNodeOs()` returns empty-but-callable accessors. `getOs()`/`getArch()`
// then resolve to '' (the platform vocab is only read by node-only pack tooling
// the SDK never invokes in a browser).
export const LIB_NODE_OS_PATTERN = /@socketsecurity\/lib\/dist\/node\/os\.js$/
export const LIB_NODE_OS_STUB = `'use strict'
const osShim = {
  arch() { return '' },
  platform() { return '' },
  homedir() { return '/' },
  tmpdir() { return '/tmp' },
  release() { return '' },
  type() { return '' },
  EOL: '\\n',
}
function getNodeOs() { return osShim }
module.exports = {
  getNodeOs,
  osArch: osShim.arch,
  osHomedir: osShim.homedir,
  osPlatform: osShim.platform,
  osTmpdir: osShim.tmpdir,
}`

// Keyed by the builtin name (no `node:` prefix). Kept alphabetical.
export const NODE_SHIMS: Record<string, string> = {
  // Functional no-op: lib's env isolated-overrides (used for test isolation)
  // constructs `new AsyncLocalStorage()` at module load via debug/namespace →
  // getEnvValue. The browser has no async-context tracking; a store that always
  // runs the callback inline and holds no value is the correct browser behavior.
  async_hooks: `'use strict'
class AsyncLocalStorage {
  getStore() { return undefined }
  run(_store, callback) {
    return callback.apply(null, Array.prototype.slice.call(arguments, 2))
  }
  enterWith() {}
  exit(callback) {
    return callback.apply(null, Array.prototype.slice.call(arguments, 1))
  }
  disable() {}
}
class AsyncResource {
  runInAsyncScope(fn, thisArg) {
    return fn.apply(thisArg, Array.prototype.slice.call(arguments, 2))
  }
  bind(fn) { return fn }
  emitDestroy() { return this }
}
module.exports = {
  AsyncLocalStorage,
  AsyncResource,
  executionAsyncId() { return 0 },
  triggerAsyncId() { return 0 },
  createHook() { return { enable() {}, disable() {} } },
}
module.exports.default = module.exports`,

  crypto: `'use strict'
function unavailable() {
  throw new Error('node:crypto is not available in the browser build of @socketsecurity/sdk; use SubtleCrypto (globalThis.crypto.subtle) instead')
}
module.exports = {
  hash: unavailable,
  createHash: unavailable,
  randomUUID() {
    const g = globalThis
    if (g.crypto && typeof g.crypto.randomUUID === 'function') {
      return g.crypto.randomUUID()
    }
    return unavailable()
  },
}
module.exports.default = module.exports`,

  // Eval-safe: lib `constants/platform` calls `existsSync` at load to probe for
  // musl linkers; returning false means "not musl", which is correct for a
  // browser. Everything else throws only when a node-only method calls it.
  fs: `'use strict'
function unavailable() {
  throw new Error('node:fs is not available in the browser build of @socketsecurity/sdk')
}
const promisesShim = new Proxy({}, { get() { return unavailable } })
module.exports = {
  existsSync() { return false },
  readFileSync: unavailable,
  writeFileSync: unavailable,
  appendFileSync: unavailable,
  statSync: unavailable,
  lstatSync: unavailable,
  readdirSync: unavailable,
  mkdirSync: unavailable,
  rmSync: unavailable,
  createReadStream: unavailable,
  createWriteStream: unavailable,
  promises: promisesShim,
  default: undefined,
}
module.exports.default = module.exports`,

  // Eval-safe: SDK `file-upload` binds `createRequire(import.meta.url)` at load;
  // the returned loader is called (`requireHere('form-data')`) only inside the
  // node-only upload path. lib `node/module` reads `.isBuiltin`/`.createRequire`.
  module: `'use strict'
function browserRequire() {
  throw new Error('createRequire is not available in the browser build of @socketsecurity/sdk')
}
function createRequire() { return browserRequire }
function isBuiltin() { return false }
module.exports = { createRequire, isBuiltin, builtinModules: [] }
module.exports.default = module.exports`,

  // Functional-empty: SDK user-agent reads os.platform/release/arch at call time
  // for the node UA enrichment; empty strings yield a UA without OS info.
  os: `'use strict'
module.exports = {
  EOL: '\\n',
  platform() { return '' },
  release() { return '' },
  type() { return '' },
  arch() { return '' },
  hostname() { return '' },
  homedir() { return '/' },
  tmpdir() { return '/tmp' },
  cpus() { return [] },
  totalmem() { return 0 },
  freemem() { return 0 },
  networkInterfaces() { return {} },
  userInfo() { return { username: '', homedir: '/', shell: null, uid: -1, gid: -1 } },
}
module.exports.default = module.exports`,

  // Functional posix path. Only reached by the SDK's node-only file methods, but
  // implemented correctly (not stubbed) so it never silently misbehaves.
  path: `'use strict'
function assertPath(p) {
  if (typeof p !== 'string') {
    throw new TypeError('Path must be a string. Received ' + JSON.stringify(p))
  }
}
function normalizeStringPosix(p, allowAboveRoot) {
  let res = ''
  let lastSegmentLength = 0
  let lastSlash = -1
  let dots = 0
  let code
  for (let i = 0; i <= p.length; ++i) {
    if (i < p.length) { code = p.charCodeAt(i) }
    else if (code === 47) { break }
    else { code = 47 }
    if (code === 47) {
      if (lastSlash === i - 1 || dots === 1) {
        // noop
      } else if (lastSlash !== i - 1 && dots === 2) {
        if (res.length < 2 || lastSegmentLength !== 2 || res.charCodeAt(res.length - 1) !== 46 || res.charCodeAt(res.length - 2) !== 46) {
          if (res.length > 2) {
            const lastSlashIndex = res.lastIndexOf('/')
            if (lastSlashIndex !== res.length - 1) {
              if (lastSlashIndex === -1) { res = ''; lastSegmentLength = 0 }
              else { res = res.slice(0, lastSlashIndex); lastSegmentLength = res.length - 1 - res.lastIndexOf('/') }
              lastSlash = i; dots = 0; continue
            }
          } else if (res.length === 2 || res.length === 1) {
            res = ''; lastSegmentLength = 0; lastSlash = i; dots = 0; continue
          }
        }
        if (allowAboveRoot) {
          res += res.length > 0 ? '/..' : '..'
          lastSegmentLength = 2
        }
      } else {
        if (res.length > 0) { res += '/' + p.slice(lastSlash + 1, i) }
        else { res = p.slice(lastSlash + 1, i) }
        lastSegmentLength = i - lastSlash - 1
      }
      lastSlash = i; dots = 0
    } else if (code === 46 && dots !== -1) { ++dots }
    else { dots = -1 }
  }
  return res
}
function resolve() {
  let resolvedPath = ''
  let resolvedAbsolute = false
  for (let i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    const p = i >= 0 ? arguments[i] : '/'
    assertPath(p)
    if (p.length === 0) { continue }
    resolvedPath = p + '/' + resolvedPath
    resolvedAbsolute = p.charCodeAt(0) === 47
  }
  resolvedPath = normalizeStringPosix(resolvedPath, !resolvedAbsolute)
  if (resolvedAbsolute) { return '/' + resolvedPath }
  return resolvedPath.length > 0 ? resolvedPath : '.'
}
function normalize(p) {
  assertPath(p)
  if (p.length === 0) { return '.' }
  const isAbsolute = p.charCodeAt(0) === 47
  const trailingSeparator = p.charCodeAt(p.length - 1) === 47
  p = normalizeStringPosix(p, !isAbsolute)
  if (p.length === 0 && !isAbsolute) { p = '.' }
  if (p.length > 0 && trailingSeparator) { p += '/' }
  if (isAbsolute) { return '/' + p }
  return p
}
function join() {
  if (arguments.length === 0) { return '.' }
  let joined
  for (let i = 0; i < arguments.length; ++i) {
    const arg = arguments[i]
    assertPath(arg)
    if (arg.length > 0) {
      if (joined === undefined) { joined = arg }
      else { joined += '/' + arg }
    }
  }
  if (joined === undefined) { return '.' }
  return normalize(joined)
}
function dirname(p) {
  assertPath(p)
  if (p.length === 0) { return '.' }
  let code = p.charCodeAt(0)
  const hasRoot = code === 47
  let end = -1
  let matchedSlash = true
  for (let i = p.length - 1; i >= 1; --i) {
    code = p.charCodeAt(i)
    if (code === 47) { if (!matchedSlash) { end = i; break } }
    else { matchedSlash = false }
  }
  if (end === -1) { return hasRoot ? '/' : '.' }
  if (hasRoot && end === 1) { return '//' }
  return p.slice(0, end)
}
function basename(p, ext) {
  assertPath(p)
  let start = 0
  let end = -1
  let matchedSlash = true
  let i
  if (ext !== undefined && ext.length > 0 && ext.length <= p.length) {
    if (ext.length === p.length && ext === p) { return '' }
    let extIdx = ext.length - 1
    let firstNonSlashEnd = -1
    for (i = p.length - 1; i >= 0; --i) {
      const code = p.charCodeAt(i)
      if (code === 47) { if (!matchedSlash) { start = i + 1; break } }
      else {
        if (firstNonSlashEnd === -1) { matchedSlash = false; firstNonSlashEnd = i + 1 }
        if (extIdx >= 0) {
          if (code === ext.charCodeAt(extIdx)) { if (--extIdx === -1) { end = i } }
          else { extIdx = -1; end = firstNonSlashEnd }
        }
      }
    }
    if (start === end) { end = firstNonSlashEnd }
    else if (end === -1) { end = p.length }
    return p.slice(start, end)
  }
  for (i = p.length - 1; i >= 0; --i) {
    if (p.charCodeAt(i) === 47) { if (!matchedSlash) { start = i + 1; break } }
    else if (end === -1) { matchedSlash = false; end = i + 1 }
  }
  if (end === -1) { return '' }
  return p.slice(start, end)
}
function extname(p) {
  assertPath(p)
  let startDot = -1
  let startPart = 0
  let end = -1
  let matchedSlash = true
  let preDotState = 0
  for (let i = p.length - 1; i >= 0; --i) {
    const code = p.charCodeAt(i)
    if (code === 47) { if (!matchedSlash) { startPart = i + 1; break } continue }
    if (end === -1) { matchedSlash = false; end = i + 1 }
    if (code === 46) { if (startDot === -1) { startDot = i } else if (preDotState !== 1) { preDotState = 1 } }
    else if (startDot !== -1) { preDotState = -1 }
  }
  if (startDot === -1 || end === -1 || preDotState === 0 || (preDotState === 1 && startDot === end - 1 && startDot === startPart + 1)) {
    return ''
  }
  return p.slice(startDot, end)
}
function isAbsolute(p) { assertPath(p); return p.length > 0 && p.charCodeAt(0) === 47 }
function relative(from, to) {
  assertPath(from); assertPath(to)
  if (from === to) { return '' }
  from = resolve(from); to = resolve(to)
  if (from === to) { return '' }
  const fromParts = from.slice(1).split('/').filter(Boolean)
  const toParts = to.slice(1).split('/').filter(Boolean)
  let i = 0
  while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) { i++ }
  const up = fromParts.slice(i).map(() => '..')
  return up.concat(toParts.slice(i)).join('/')
}
const posix = { resolve, normalize, join, dirname, basename, extname, isAbsolute, relative, sep: '/', delimiter: ':' }
posix.posix = posix
module.exports = posix`,

  // Eval-safe: lib `perf/timer` binds `require("node:process")` at load and
  // reads `.memoryUsage` lazily; SDK `utils`/`socket-sdk-class` read
  // `process.cwd()`/`process.stdout` only inside node-only methods.
  process: `'use strict'
const noop = () => {}
const processShim = {
  env: {},
  argv: [],
  platform: '',
  arch: '',
  version: '',
  versions: {},
  pid: 0,
  cwd() { return '/' },
  chdir: noop,
  nextTick(cb) {
    const args = Array.prototype.slice.call(arguments, 1)
    Promise.resolve().then(() => cb.apply(null, args))
  },
  memoryUsage() {
    return { rss: 0, heapTotal: 0, heapUsed: 0, external: 0, arrayBuffers: 0 }
  },
  hrtime: Object.assign(() => [0, 0], { bigint: () => BigInt(0) }),
  exit: noop,
  on() { return processShim },
  once() { return processShim },
  off() { return processShim },
  emit() { return false },
  stdout: { write() { return true }, isTTY: false },
  stderr: { write() { return true }, isTTY: false },
}
module.exports = processShim`,

  'stream/promises': `'use strict'
function unavailable() {
  throw new Error('node:stream/promises is not available in the browser build of @socketsecurity/sdk')
}
module.exports = { pipeline: unavailable, finished: unavailable }
module.exports.default = module.exports`,

  // Functional: pRetry backoff (lib promises/_internal) awaits setTimeout.
  'timers/promises': `'use strict'
module.exports = {
  setTimeout(ms, value) {
    return new Promise(resolve => setTimeout(() => resolve(value), ms || 0))
  },
  setImmediate(value) { return Promise.resolve(value) },
  setInterval() {
    throw new Error('node:timers/promises setInterval is not available in the browser build of @socketsecurity/sdk')
  },
}
module.exports.default = module.exports`,

  // Functional: lib paths/_internal lazily uses fileURLToPath; URL globals exist
  // in every browser / service-worker context.
  url: `'use strict'
const g = globalThis
module.exports = {
  URL: g.URL,
  URLSearchParams: g.URLSearchParams,
  fileURLToPath(input) {
    const href = typeof input === 'string' ? input : (input && input.href) || String(input)
    return href.startsWith('file://') ? decodeURIComponent(href.slice(7)) : href
  },
  pathToFileURL(p) { return new g.URL('file://' + p) },
}
module.exports.default = module.exports`,
}

/**
 * Replace `node:*` builtins (and the bare builtin specifiers lib's node/*
 * wrappers use, e.g. `require("os")` / `require("module")`) with browser-safe
 * virtual modules. Any `node:*` builtin without a shim throws a build error —
 * so a newly-introduced node dependency fails the build loudly rather than
 * silently shipping an unresolvable `node:` import into an MV3 service worker.
 */
export function createNodeBuiltinShimPlugin(): Plugin {
  const prefix = '\0node-shim:'
  return {
    name: 'node-builtin-browser-shim',
    resolveId(source) {
      // Intercept both `node:*` specifiers and BARE builtin names: lib's node/*
      // wrappers deliberately use bare `require("os")` / `require("module")` (a
      // `node:` prefix throws `UnhandledSchemeError` in some browser bundlers),
      // so a bare builtin here is always the Node core module, never an npm dep.
      const isNodePrefixed = source.startsWith('node:')
      const name = isNodePrefixed ? source.slice(5) : source
      const isBareBuiltin =
        !isNodePrefixed &&
        Object.prototype.hasOwnProperty.call(NODE_SHIMS, name)
      if (isNodePrefixed || isBareBuiltin) {
        if (!Object.prototype.hasOwnProperty.call(NODE_SHIMS, name)) {
          throw new Error(
            `[node-builtin-browser-shim] No browser shim for '${source}'. ` +
              `The browser bundle must be node-free; add a shim in ` +
              `.config/repo/rolldown/browser-node-shims.mts or drop the dependency.`,
          )
        }
        return { id: `${prefix}${name}`, moduleSideEffects: false }
      }
      return undefined
    },
    load(id) {
      if (id.startsWith(prefix)) {
        const name = id.slice(prefix.length)
        return {
          code: NODE_SHIMS[name]!,
          moduleType: 'js',
          moduleSideEffects: false,
        }
      }
      return undefined
    },
  }
}
