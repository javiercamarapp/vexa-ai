# vercel-functions
Query: Vercel functions duration payload size limits streaming background jobs
Retrieved: 2026-09-19T01:53:59.749806+00:00

## https://github.com/vercel/vercel-plugin/issues/177
ID: pull_request:vercel/vercel-plugin#177
## New sections
**Plan Limits at a Glance** — one table, plus a "What changed for Hobby" note: duration went **60s → 300s for both default and maximum**, and the Basic CPU instance was replaced by Standard (1 vCPU / 2 GB).

## Corrections to existing content
| Was | Now |
|-|-|
| "Max duration: 10s (Hobby)" | 300s default **and** max |
| "5 GB package size on Fluid Compute" | 250 MB standard; 5 GB requires the opt-in beta |
| "Edge Functions have 25s hard limit" | 25s to _first byte_, then up to 300s streaming |

## https://vercel.com/docs/functions
ID: web:https://vercel.com/docs/functions
Stream responses to deliver content as it's generated. Limits. Review function limits including duration, payload size, and memory.

## https://github.com/vercel/workflow/blob/20ad2b358240819c6e590fd4752b97da1c64b390/docs/content/docs/v5/comparisons/workflow-sdk-vs-aws-step-functions.mdx
ID: doc:https://github.com/vercel/workflow/blob/20ad2b358240819c6e590fd4752b97da1c64b390/docs/content/docs/v5/comparisons/workflow-sdk-vs-aws-step-functions.mdx
## At a glance
|  | Workflow SDK | AWS Step Functions |
|-|-|-|
| **Streaming** | Native durable, resumable streaming to clients | No native client streaming |
| **Limits** | 50 MB payload; 2 GB/run; no duration cap (Vercel World limits) | 256 KB payload between states; Standard 25K history events / 1 year; Express 5 minutes |

**What the limits mean in practice:** The 256 KB cap on payloads between states is the binding constraint for AI workloads. The Vercel World limits are 50 MB per payload and 2 GB of state per run.
