# API clients and contracts

`SocketSdk` supports organization APIs in v0 and v1. The generated contracts
are available through `@socketsecurity/sdk/types/api` and
`@socketsecurity/sdk/types/api-v1`.

## Organization APIs

Use `batchOrgPackageFetch` or `batchOrgPackageStream` for organization PURL
analysis. Both accept alert options and one label string. Responses can include PURL error records.
Buffered calls return an array. Streaming calls yield one record at a time.

```typescript
for await (const result of sdk.batchOrgPackageStream(
  'example-org',
  { components: [{ purl: 'pkg:npm/example-package@1.0.0' }] },
  { queryParams: { alerts: true, purlErrors: true, labels: 'production' } },
)) {
  if (!result.success) throw new Error(result.error)
  const record = result.data
  if ('_type' in record) {
    if (record._type === 'purlError') throw new Error(record.value.error)
    continue
  }
  console.log(record.inputPurl, record.name)
}
```

Preserve `inputPurl` when correlating responses. Resolved package identifiers can
differ from input identifiers. `retryable` is optional on PURL errors.
Malformed records and interrupted streams fail instead of returning partial
analysis as a complete result. Closing a stream cancels its active requests.

<details>
<summary>Policies, package versions, and fixes</summary>

Policy methods cover policy and rule CRUD, alert resolution creation, migration
status, and triage translation. Write options accept `dry_run`. Results retain
the HTTP status, including `200` for previews and `201` for creation.
Policy identifiers can include the virtual `default` policy.

Check `getOrgAlertPolicyMigrationStatus` before using legacy policy writes.
Migration gates can reject legacy writes with `409`. Migration status requires
`alert-policy:list`. Translation accepts any one of `triage:alerts-update`,
`alert-policy:read`, or `alert-resolution:create`. It returns translations and
untranslatable entries without writing a policy.

`getOrgPurlVersions` uses v1. It preserves server ordering and nullable
`publishedAt` and `prerelease` fields. Its optional `limit` must be a positive
integer.

`getOrgFixes` accepts exactly one of `repo_slug`, `full_scan_id`, or `tar_hash`.
It also accepts `autofix_run_id` and `include_all_detected_ghsas`. Its typed
results distinguish available fixes, partial fixes, unavailable fixes,
inapplicable fixes, and computation failures.

</details>

## Public clients

<details>
<summary>Public PURL and patch client methods</summary>

| Client                      | Service                  | Authentication                                                   |
| --------------------------- | ------------------------ | ---------------------------------------------------------------- |
| `SocketPurlClient`          | `purl-api.socket.dev`    | Optional; organization methods need `apiToken` or `authProvider` |
| `SocketPatchClient`         | `patches-api.socket.dev` | Public requests                                                  |
| `SocketPublicMalwareClient` | `purl-api.socket.dev`    | Anonymous requests only                                          |

Public clients do not inherit credentials from `SocketSdk`. They send no
automatic telemetry.

`SocketPurlClient` supports PURL lookup, buffered batches, streaming batches,
and organization batches. Proxy query options include `alerts`, `actions`,
`compact`, `fixable`, `licenseattrib`, `licensedetails`, `purlErrors`, and
`cachedResultsOnly`. Organization calls also accept one `labels` string.
Unsupported proxy options are rejected.

Set `apiToken` for a static credential or `authProvider` to resolve a credential
for each request. The provider returns a token and its `basic` or `bearer`
scheme. Provider credentials take precedence over a valid static token. A
provider failure stops the request and does not select anonymous access.
Omitted or `undefined` credentials leave public PURL methods anonymous.

```typescript
const purlClient = new SocketPurlClient({
  authProvider: async () => ({
    token: await refreshApplicationToken(),
    authScheme: 'bearer',
  }),
})

const result = await purlClient.batchOrgPackageFetch('example-org', {
  components: [{ purl: 'pkg:npm/example-package@1.0.0' }],
})
```

The provider function must be valid. If you also set `apiToken`, the client
validates it even when the provider supplies request credentials.

`SocketPatchClient` supports searches by CVE, GHSA, and package; patch views;
batch searches; free package download grants; blobs; and diffs. Binary methods
return bytes. They do not extract or execute downloaded content.

`SocketPublicMalwareClient.checkPackages` posts package PURLs to the public v1
malware check endpoint. It preserves input order and duplicate entries. Results
use `confirmed_malware`, `no_known_malware`, `unknown`, `unsupported`, or
`error`. `no_known_malware` reports complete observations for the request; it
does not prove that a package is safe. The optional `candidateRevision` is
request context only. Results use `reuse: 'none'` and do not establish a
reusable revision.

This client rejects credential options and URLs with user information. It does
not read credentials from the environment or keychain. The production route
must be deployed and available before applications adopt this client; a
disabled route returns an unsuccessful 404 result.

```typescript
const publicMalwareClient = new SocketPublicMalwareClient()
const result = await publicMalwareClient.checkPackages({
  packages: [{ purl: 'pkg:npm/example-package@1.0.0' }],
})
```

`checkMalware` uses public PURL analysis and returns one entry per input,
including duplicate inputs. Each entry has `inputPurl` and a status:
`complete`, `pending`, `not_found`, or `error`. An empty alert list establishes
completed analysis only when the status is `complete`.

</details>

## Authentication and cancellation

`SocketSdk` uses Basic authentication by default. Set `authScheme: 'bearer'`
for a Bearer access token. Set `apiV1BaseUrl` when a custom deployment cannot
derive its v1 URL from a trailing `/v0/` segment.

The client `signal` cancels requests and retry waits. Batch streams and scan
polling also accept a per-operation signal. A stream never retries a response
after yielding records from that response.

## Advanced API contracts

These methods use contracts hidden from the public OpenAPI documents:

- `startOrgFixComputation` and `getOrgFixComputation` expose asynchronous fixes.
- `uploadBlobs` and `createFullScanFromManifest` create scans from hashed files.
- `getOrgFullScanV1` and `pollOrgFullScanV1` expose processing and terminal states.
- `downloadOrgPatchVerificationBundle` downloads an authorized gzip bundle.

The scan result's `data.status` distinguishes `processing`, `complete`, and
`failed`. A successful HTTP response can contain a failed scan. Complete scan
records include the final scores record. Consume or close the records iterator
to release the response. Polling stops on a complete or failed scan and has a
cancellable deadline.

Advanced methods require organization access and service eligibility. Patch
routes use membership and entitlement checks. `getPatchPackages` and
`streamPatchesFromScan` require organization-wide token access. Content routes
can accept repository grants. Verification bundles require verification access.

See [contract generation](openapi-contracts.md) for offline generation and
freshness checks.
