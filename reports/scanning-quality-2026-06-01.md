The threat-feed methods follow the established safe pattern (createGetRequest goes through http-client.ts which caps at MAX_RESPONSE_SIZE). All findings confirmed. Producing the report.

# Code Quality Audit: socket-sdk-js

**Grade: C+** — The mature, hand-maintained `SocketSdk` class and `http-client.ts` are solid and consistently apply a `maxResponseSize` cap; the new threat-feed methods correctly reuse that safe path. The grade is dragged down entirely by `src/blob.ts`, a new module that regressed from the established `downloadPatch` pattern: it omits the response-size cap on every blob/chunk/manifest fetch (memory-exhaustion DoS) and miscomputes truncation metadata on one manifest variant.

## Severity Summary

| Severity | Count | Area |
|----------|-------|------|
| Critical | 0 | — |
| High | 1 | `blob.ts` — unbounded response memory / fan-out |
| Medium | 1 | `blob.ts` — wrong `bytes`/`truncated` on offset-without-size manifest |
| Low | 1 | `blob.ts` — no content-hash verification of fetched bytes |

No Critical findings. One confirmed High.

---

## High

### 1. Blob fetch sets no `maxResponseSize` — unbounded memory allocation + request fan-out
**File:** `src/blob.ts:202` (request), `:158-162` (chunked fan-out), `:86-87` (post-buffer truncation)

**Why it's a bug.** `fetchRawBytes` calls `httpRequest(url, { headers })` with no `maxResponseSize`. In `@socketsecurity/lib` the byte cap is enforced only `if (maxResponseSize && totalBytes > maxResponseSize)`; when undefined, every chunk is pushed and `Buffer.concat`'d, so the *entire* response is buffered into memory at `new Uint8Array(res.arrayBuffer())` (line 212) before `fetchBlob` ever applies `buf.subarray(0, maxBytes)` (line 87). The `maxBytes` cap therefore bounds returned bytes, not peak memory — a multi-GB body OOMs the process first. The chunked path compounds this: `chunks.length` comes straight from the unverified manifest, and `Promise.all` (line 158) fans out one uncapped fetch per chunk concurrently, so peak memory is the sum of all in-flight unbounded bodies plus unbounded request fan-out. The sibling `downloadPatch` (`src/socket-sdk-class.ts:2153-2155`) correctly passes `maxResponseSize: MAX_PATCH_SIZE`, and `http-client.ts` passes `MAX_RESPONSE_SIZE` at all three call sites — `blob.ts` is the lone regression. All three functions are exported public API via `src/index.ts`.

**Fix.** Thread a cap into every `httpRequest` call in `fetchRawBytes` (e.g. `maxResponseSize` derived from `maxBytes` for single blobs/chunks, plus a sane separate cap for the manifest GET). Reject manifests whose `chunks.length` exceeds a sane bound before fanning out, and bound concurrency. For the no-offsets chunked case, stop fetching once accumulated bytes reach `maxBytes` rather than fetching all chunks then truncating.

---

## Medium

### 2. Chunked blob reports wrong `bytes`/`truncated` when manifest has `offset` but no `size`
**File:** `src/blob.ts:132, 148-156, 164-177` and `:78, 86-93`

**Why it's a bug.** `size` (line 54) and `offset` (line 53) are independent optional manifest fields with no cross-validation. When a valid per-chunk `offset` array is present but `size` is absent, `totalSize` is set to `-1` (line 132), and the early-stop loop (lines 148-156) fetches only `needed` chunks — terminating at the first chunk whose start offset is `>= maxBytes`. `total` (lines 164-167) is then the sum of *only the fetched chunks*, and line 177 falls back to that partial sum. In `fetchBlob`, `originalSize = chunked.totalSize` (line 78) is that partial sum (~`maxBytes`), so `truncated = originalSize > maxBytes` (line 86) and the reported `bytes` (line 93) both understate the true blob size. With power-of-two chunk sizes and the default 1 MB `maxBytes` (e.g. 256 KB chunks → fetch 4 → `total == 1MB` exactly), `truncated` can wrongly report **false** for a blob that is actually many MB — a silently-wrong completeness signal, violating the documented `ChunkedFetchResult.totalSize` contract ("regardless of how many chunks were fetched", lines 27-29). The `bytes` value is wrong on this path regardless of boundary alignment.

**Fix.** Gate the offset-based early-stop on `totalSize >= 0` (i.e. `manifest.size` present). When `size` is absent the true total is unknowable without fetching all chunks, so set `needed = chunks.length` and let `fetchBlob` truncate:
```ts
const offsets =
  totalSize >= 0 &&
  Array.isArray(rawOffset) && rawOffset.length === chunks.length &&
  rawOffset.every(n => typeof n === 'number')
    ? (rawOffset as number[]) : undefined
```

---

## Low

### 3. Content-addressed blob fetch never verifies returned bytes against the requested hash
**File:** `src/blob.ts:64-97, 105-179, 185-216`

**Why it's a (minor) bug.** The module is documented as content-addressed fetching "keyed by hash," but no path computes a digest of the fetched bytes and compares it to the requested `hash` — there is no `crypto`/`createHash`/`ssri` use anywhere. The hash is used only as a URL path component (line 189); the chunked manifest is fetched and `JSON.parse`'d (lines 114-122) with no verification, and each listed chunk is fetched by its declared hash with no check. Content-addressing's whole value is integrity, so a compromised first-party origin or an attacker-supplied `options.baseUrl` could substitute arbitrary bytes for a given hash.

**Severity rationale.** Kept Low: all traffic goes to `https://socketusercontent.com` over HTTPS (TLS covers the network-MITM vector), and the existing `downloadPatch` follows the identical no-verification convention — the hash is treated as a lookup key against a trusted first-party store, not an integrity assertion. `BlobResult.binary` is a UTF-8/NUL heuristic (`tryDecodeText`, lines 223-236), not a security control. This is defense-in-depth hardening, not a reachable exploitable break.

**Fix (hardening).** Recompute the digest of the concatenated bytes (single-blob case) and verify each chunk hash plus the manifest hash (chunked case), decoding the SSRI/hex form of `hash`, and throw on mismatch. Verify manifest bytes against `manifestHash` before `JSON.parse`.

---

**Note on adjacent surfaces (clean):** `getOrgThreatFeedItems`/`getThreatFeedItems` (`src/socket-sdk-class.ts:3026, 3431`) route through `createGetRequest` → `http-client.ts`, which applies `maxResponseSize: MAX_RESPONSE_SIZE` at all call sites — no defect. `http-client.ts` and `file-upload.ts` consistently cap responses. The blob module is the sole outlier.
---

## Resolution (2026-06-01, commit bcf26abf)

- **High #1 (no maxResponseSize)** — FIXED. `fetchRawBytes` now passes
  `maxResponseSize: max(maxResponseBytes ?? maxBytes, 1 MB floor)` so oversized
  bodies are rejected at the socket layer before buffering.
- **Medium #2 (offset-without-size truncation metadata)** — FIXED. The
  offset-based early-stop is now gated on a known `size` (`totalSize >= 0`);
  without it, all chunks are fetched so `bytes`/`truncated` are correct. Added a
  regression test.
- **Low #3 (no content-hash verification)** — DEFERRED (intentional). Matches
  `downloadPatch`'s trusted-first-party-store convention; defense-in-depth over
  HTTPS, not a reachable break. Tracked for a future hardening pass across both
  blob + patch download paths.
