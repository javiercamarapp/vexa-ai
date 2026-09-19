# mcp-vercel
Query: Vercel MCP server OAuth endpoint security deployment
Retrieved: 2026-09-19T01:54:11.516456+00:00

## https://github.com/koala73/worldmonitor/issues/2418
ID: pull_request:koala73/worldmonitor#2418
## Summary
- Implements spec-compliant MCP OAuth 2.0 so claude.ai's remote connector (Client ID + Secret UI) can authenticate with WorldMonitor's MCP server

## Post-Deploy Monitoring & Validation
This PR implements a spec-compliant OAuth 2.0 Client Credentials authorization server for WorldMonitor's MCP endpoint, enabling the claude.ai remote connector (which only accepts OAuth credentials) to authenticate.

- **`public/.well-known/oauth-authorization-server`**: RFC 8414 discovery document, consistent with the `/oauth/token` rewrite in `vercel.json`

### Important Files Changed
| Filename | Overview |
|-|-|
| api/oauth/token.js | New OAuth 2.0 token endpoint implementing client_credentials grant; missing rate limiting (P1 security gap), WWW-Authenticate header on 401 (P2 RFC compliance), and raw API keys stored in Redis |
| public/.well-known/oauth-authorization-server | RFC 8414 discovery document; token_endpoint URL is consistent with vercel.json rewrite, content is correct |

## https://vercel.com/docs/llms-full.txt
ID: doc:https://vercel.com/docs/llms-full.txt
"mcpServers": {
    "server-name": {
      "url": "https://my-mcp-server.vercel.app/api/mcp"
    }
  }
}
… (156 more lines)

| **Data model**           | Relational (Postgres) for structured data, key-value (Redis) for caching, NoSQL for flexible schemas, vector for AI embeddings                                                                                                                                                                                                                                                                                                                                                                                               |
| **Common use cases**     | Postgres for ACID transactions, complex queries, and foreign keys. Redis for session storage, rate limiting, and leaderboards. Vector for semantic search and recommendations. NoSQL for document storage, high write throughput, and horizontal scaling |
| **Latency requirements** | Choose providers with regions close to your Functions                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Scale**                | Evaluate pricing tiers and scaling capabilities for your expected workload                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Features**             | Compare provider-specific features like branching, point-in-time recovery, or real-time subscriptions                                                                                                                                                                                                                                                                                                                                                                                                                        |

## Best practices

- **Locate data close to your Functions:** Deploy databases in regions near your Functions to minimize latency.
- **Use connection pooling:** In serverless environments, use connection pooling (e.g., built-in pooling or PgBouncer) to manage database connections efficiently.
- **Implement caching strategies:**
  - Data Cache to cache fetch responses and reduce load
  - Global Config for low-latency reads of config data
  - Redis for frequently accessed, periodically changing data
  - CDN caching with cache headers for static content
- **Secure your connections:**
  - Store credentials only in environment variables, never in code
  - Use SSL/TLS connections when available

## More resources

- Add a Native Integration
- Integrations Overview
- Environment Variables
- Functions Regions

--------------------------------------------------------------------------------
title: "Deploy MCP servers to Vercel"
description: "Learn how to deploy Model Context Protocol (MCP) servers on Vercel with OAuth authentication and efficient scaling."
last_updated: "2018-10-20T01:46:40.000Z"
source: "https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel"
--------------------------------------------------------------------------------

# Deploy MCP servers to Vercel

Deploy your Model Context Protocol (MCP) servers on Vercel to take advantage of features like Vercel Functions, OAuth, and efficient scaling for AI applications.

- Get started with deploying MCP servers on Vercel
- Learn how to enable authorization to secure your MCP server
… (90 more lines)

## https://nhimg.org/articles/vercel-oauth-breach-exposes-the-governance-gap-in-mcp-security/
ID: web:https://nhimg.org/articles/vercel-oauth-breach-exposes-the-governance-gap-in-mcp-security/
Key takeaways · The Vercel incident shows that a compromised AI productivity tool can turn one OAuth grant into a broad internal access path.
