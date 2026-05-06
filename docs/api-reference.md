# API Reference

The Socket SDK is a TypeScript client for the Socket.dev REST API. You construct one client, call methods on it, and get back a typed result object.

> Looking for the full per-method type signatures? Your IDE has them — every method on `SocketSdk` is fully typed from the OpenAPI spec. The official endpoint docs live at <https://docs.socket.dev/reference/>. This page covers the parts that aren't obvious from autocomplete.

## Creating a client

```typescript
import { SocketSdk } from '@socketsecurity/sdk'

const client = new SocketSdk('your-api-token')
```

The token is the only required argument. Everything else is options:

```typescript
const client = new SocketSdk('your-api-token', {
  retries: 3, // number of retry attempts on failure
  retryDelay: 1000, // initial delay in ms; exponential backoff after
  timeout: 30_000, // per-request timeout in ms (5_000–300_000)
  baseUrl: 'https://api.socket.dev/v0/',
  userAgent: 'my-app/1.0.0',
})
```

### Option reference

| Option             | Type                            | Default                        | What it does                                                                       |
| ------------------ | ------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------- |
| `retries`          | `number`                        | `3`                            | How many times to retry a failed request before giving up.                         |
| `retryDelay`       | `number`                        | `1000`                         | Initial backoff in ms. Doubles each attempt (1s, 2s, 4s…).                         |
| `timeout`          | `number`                        | `30_000`                       | Per-request timeout in ms. Must be between `5_000` and `300_000`.                  |
| `baseUrl`          | `string`                        | `'https://api.socket.dev/v0/'` | Useful for staging environments or proxies.                                        |
| `userAgent`        | `string`                        | SDK default                    | Identifier sent on every request. Set this so Socket can attribute traffic to you. |
| `agent`            | `http.Agent` / `https.Agent`    | none                           | Bring your own agent for connection pooling or a corporate proxy.                  |
| `cache`            | `boolean`                       | `false`                        | Cache `getQuota()` and `listOrganizations()` responses in memory.                  |
| `cacheTtl`         | `number` or per-endpoint object | `5 * 60_000`                   | Cache lifetime. See `SocketSdkOptions` JSDoc for the per-endpoint shape.           |
| `hooks`            | `{ onRequest, onResponse }`     | none                           | Observe every request and response (logging, metrics).                             |
| `onFileValidation` | `FileValidationCallback`        | warn-and-continue              | Called when an upload method hits an unreadable file. See "File uploads" below.    |

## The result shape

Every API method returns a _result object_, not a raw response. You always check `success` first:

```typescript
const result = await client.getQuota()

if (result.success) {
  // result.data is fully typed for this endpoint
  console.log(result.data.quota)
} else {
  // result.error is a human-readable message
  console.error(`HTTP ${result.status}: ${result.error}`)
}
```

The shapes:

```typescript
// Success
{
  success: true,
  status: number,  // HTTP status code
  data: T,         // typed response body
}

// Failure
{
  success: false,
  status: number,  // HTTP status code (0 if the request never sent)
  error: string,   // short summary, suitable for logging
  cause?: string,  // longer detail when the API returned one
  url?: string,    // request URL — handy for debugging
}
```

**Why a result object instead of throwing?** Network failures, auth failures, and validation failures are normal control flow when you're talking to a remote API. Treating them as exceptions would force every caller to wrap every call in `try`/`catch`. The result object lets you handle them as data.

The exception: methods that talk to your filesystem (uploads) or that don't fit the pattern still throw on programmer errors — bad arguments, missing files, etc. Network errors from those methods are still returned in the result.

## Pagination and streaming

Endpoints that return lots of data come in two flavors:

- **List methods** (`listFullScans`, `listRepositories`, `listOrgDiffScans`, …) take a page/cursor and return one page at a time. Loop over them yourself.
- **Stream methods** (`batchPackageStream`, `streamFullScan`, `streamPatchesFromScan`) return an `AsyncGenerator`. Use `for await`:

```typescript
for await (const artifact of client.batchPackageStream({
  components: [{ purl: 'pkg:npm/react@18.2.0' }, { purl: 'pkg:npm/vue@3.3.4' }],
})) {
  console.log(artifact.name, artifact.version)
}
```

Streams are the right choice when you don't know how big the response is, or when you want to start processing before the whole response arrives.

## File uploads

`createFullScan`, `createDependenciesSnapshot`, and `uploadManifestFiles` take an array of file paths and stream them to the API. Two things to know:

1. **Pass absolute paths.** The SDK won't `chdir`; it reads files relative to the process cwd unless you pass an absolute path. Use `path.resolve()` if you have relative paths.
2. **Unreadable files don't crash by default.** If a file is missing or unreadable, the SDK logs a warning and continues with the rest. If _every_ file is unreadable, it throws. Override with `onFileValidation`:

```typescript
const client = new SocketSdk('token', {
  onFileValidation: ({ file, error }) => {
    // return 'skip' | 'fail' | 'continue'
    return 'fail' // make any unreadable file abort the upload
  },
})
```

## Quota costs

Every method has a fixed quota cost: **0**, **10**, or **100** units. Free methods (status checks, listing your own resources) cost 0; standard reads cost 10; expensive batch and scan operations cost 100.

See [Quota Management](./quota-management.md) for the helpers (`getQuotaCost`, `hasQuotaForMethods`, `calculateTotalQuotaCost`) and a per-method cost table.

## Escape hatches

For endpoints the SDK doesn't wrap, or when you need the raw response:

- **`getApi(urlPath, options?)`** — `GET` against any path under `baseUrl`. By default it throws on non-2xx; pass `{ throws: false }` to get the result object.
- **`sendApi(urlPath, options?)`** — `POST` or `PUT` with a JSON body. Pass `{ method: 'PUT' }` to switch verbs.

```typescript
const result = await client.getApi('orgs/my-org/custom-endpoint', {
  responseType: 'json',
  throws: false,
})
```

These are the only methods that take a free-form URL path. Everything else is named after its endpoint and validated by TypeScript.

## Errors you'll actually hit

| Status | Meaning                                       | What to do                                                         |
| ------ | --------------------------------------------- | ------------------------------------------------------------------ |
| `400`  | Bad request — usually a malformed argument.   | Read `result.error`; fix the call site.                            |
| `401`  | Bad or missing API token.                     | Check the token. Tokens are case-sensitive.                        |
| `403`  | Token lacks the required permission.          | See `getMethodRequirements(methodName)` for what the method needs. |
| `404`  | Resource doesn't exist (or you can't see it). | Check the slug/ID and your org membership.                         |
| `429`  | Rate-limited or out of quota.                 | Back off; check `getQuota()` before retrying expensive calls.      |
| `5xx`  | Server error.                                 | The SDK retries automatically up to `retries` times.               |

The SDK retries `5xx` and network failures automatically. It does **not** retry `4xx` — those won't change on retry.
