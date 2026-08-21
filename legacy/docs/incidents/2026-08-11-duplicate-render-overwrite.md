# Incident: a gateway retry silently replaced an approved image

- Date of incident: 2026-08-11
- Detected by: Grey, on reopening approved work and finding a different image
- Severity: data integrity. An approved artifact was replaced by one the user never saw.
- Status: fixed and covered by regression tests

## What was observed

A Columbia render completed with a female subject. It was reviewed and approved on the evaluation screen. The user navigated away, returned to Design Studio, and opened the same record through Recent Work. The image was a different render, with a male subject. No retry, regenerate, or any other action that starts a render had been taken.

## What actually happened

Vercel logs for the session show two invocations of `/api/production/generate`:

```
16:01:12  POST /api/production/generate   200   76,308ms
16:02:12  POST /api/production/generate   200   73,504ms
```

Exactly sixty seconds apart, each running about seventy-six seconds. The second began while the first was still rendering. Only one output record exists for the session, `render-abe3301b-0e2d-467d-b2e8-ad209bc60165`, so both invocations carried the same job id.

Blob paths are derived from the job id:

```
brand-world-system/clients/{clientId}/production/jobs/{jobId}/output.png
```

Both renders therefore wrote to the same path. The second overwrote the first. The output record still pointed at that path, so reopening it showed whichever render finished last.

## Root cause

Two faults compounding.

**The idempotency guard could only recognize a finished job.**

```js
if (current?.jobId === jobId && current.status === "complete") return readProductionJob(options);
```

A render takes over a minute, and the `working` record is written after this check. A duplicate arriving mid-render sees `working`, not `complete`, falls through, and starts a second render.

**Nothing prevented one attempt writing over another's output.** The path is a function of the job id alone, with no notion of which attempt owns it, so the last writer won regardless of what the user had already approved.

**What issued the second request.** A platform-level retry, not the client. The client generates a fresh UUID per render and sends one request. `maxDuration` is set to 300 seconds, so the function itself had room, but the response did not arrive within sixty seconds and the invocation was retried at exactly that mark. The sixty-second spacing and the identical job id are the signature.

## The fix

`src/production/service.js`, in `generateProductionImage`.

**A duplicate that arrives mid-render becomes a reader.** When a record for the same job is found in `working` status and started recently, the invocation polls for the original to finish and returns its result instead of rendering. A retry now costs a wait, not a second image.

**An abandoned job does not lock its id.** A record still marked `working` after five minutes, beyond any plausible render, is treated as dead so a crashed job can be retried rather than blocking its own id forever.

**Ownership is checked before anything durable is written.** Each invocation takes an `attemptId`, recorded on the working record. Immediately before writing the image blob, the attempt re-reads the record; if another attempt now owns it, this attempt discards its result rather than overwriting. This closes the narrow race where two invocations pass the first guard nearly simultaneously.

**A failing retry cannot mark a successful job failed.** The error path performs the same ownership check before writing an error record, so a retry that fails does not overwrite the completed record written by the attempt that succeeded.

## Verification

`test/duplicate-render.test.js`, five tests.

The tests were confirmed to reproduce the fault: with the guards removed, "a retry arriving mid-render waits for the original" and "the image the user approved is never replaced by a later attempt" both fail. With the guards in place, all five pass. A regression test that passes against the unfixed code proves nothing, so this check was run explicitly.

Coverage: a completed job is not re-rendered; a retry mid-render does not start a second render; the surviving blob is the first attempt's; an abandoned job may be rendered again; a different job id is unaffected.

## What this leaves open

**The client waits synchronously on a request that outlives the gateway.** The fix makes duplicate invocations harmless; it does not change the fact that a seventy-six second render is being awaited over one HTTP request whose gateway gives up at sixty seconds. The client already has `recoverProductionJob` for the dropped-connection case, so the user-visible behavior is tolerable, but a job-and-poll shape would be the structural answer. Not attempted here.

**Approval attaches to a path, not to an artifact.** The immediate hole is closed, but an approved output still references a location whose contents could in principle change. Content-addressing the image, or recording a digest on the output record and checking it on read, would make approval attach to the artifact itself. Worth considering before anything else can write to a job path.

**Other long-running endpoints have the same shape.** Brain synthesis and product synthesis also run long and are invoked over a single request. They were not examined during this fix. Whether they carry the same duplicate-invocation exposure is unverified and worth checking.
