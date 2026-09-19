# vercel-workflow
Query: Vercel Workflow durable workflow use step sleep retries limits Next.js
Retrieved: 2026-09-19T01:53:59.749203+00:00

## https://flaviocopes.com/vercel-workflows/
ID: web:https://flaviocopes.com/vercel-workflows/
Build a durable Vercel Workflow with use workflow, use step, sleep, automatic retries, local inspection, and deployment-safe execution.

## https://jhak.im/blog/building-reliable-onboarding-flows-with-vercel-workflows
ID: web:https://jhak.im/blog/building-reliable-onboarding-flows-with-vercel-workflows
"use workflow" makes the entire function durable; "use step" adds automatic retries to individual operations; sleep() pauses without consuming

## https://vercel.com/academy/llms-full.txt
ID: doc:https://vercel.com/academy/llms-full.txt
# Your First Workflow
## Workflows vs Steps

If a step fails, the Workflow SDK retries it automatically (3 times by default) without re-running completed steps.

# Parallel Steps and Sleep
## Solution

# Workflow Error Handling
## Advanced: Custom Retry Limits
By default, steps retry 3 times (4 total attempts). You can customize this per step:

Set `maxRetries = 0` for steps that should never retry (one attempt only). Combine this with `FatalError` for steps where any failure is permanent.

## Troubleshooting

\*\*Warning: Steps run sequentially instead of in parallel\*\*

Make sure you're passing the step calls to `Promise.all`, not awaiting each one individually. `await evaluateResort(...)` inside a `for` loop runs them sequentially. `Promise.all(resortIds.map(...))` runs them in parallel.

\*\*Warning: Sleep doesn't seem to work locally\*\*

The local Workflow SDK processes steps synchronously. Short sleeps like `sleep('5s')` should work, but the timing may not be precise. Deploy to Vercel to test production sleep behavior where the workflow suspends and resumes.

## Advanced: Racing Steps Against a Timeout

`Promise.race` lets you set a deadline on a group of steps:

```typescript
import { sleep } from 'workflow';

const results = await Promise.race([
  Promise.all(
    resortIds.map((id) => evaluateResort(id, alertsByResort[id]!))
  ),
  sleep('30s').then(() => 'timeout' as const)
]);

if (results === 'timeout') {
  console.warn('[Workflow] Evaluation timed out after 30s');
  return { results: [], timedOut: true };
}
```

The workflow returns whatever finishes first: the actual results or the timeout. Useful when you'd rather return partial data than wait indefinitely.

---
title: "Error Handling"
description: "Handle errors in workflows using FatalError for permanent failures, RetryableError with retryAfter for transient failures, and getStepMetadata for attempt-aware backoff."
… (20 more lines)
