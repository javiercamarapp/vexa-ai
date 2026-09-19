# shopify
Query: Shopify GraphQL Admin API orders refunds protected customer data bulk operations webhooks HMAC
Retrieved: 2026-09-19T01:54:07.477948+00:00

## https://github.com/useairfoil/typescript-sdk/blob/7cc74f8b304f86e9fccc4e65f871b1aff444abf6/connectors/producer-shopify/AGENTS.md
ID: doc:https://github.com/useairfoil/typescript-sdk/blob/7cc74f8b304f86e9fccc4e65f871b1aff444abf6/connectors/producer-shopify/AGENTS.md
# Shopify Agent Notes
## Source Of Truth
- GraphQL Admin API: [https://shopify.dev/docs/api/admin-graphql](https://shopify.dev/docs/api/admin-graphql)
- Webhook HTTPS delivery and HMAC: [https://shopify.dev/docs/apps/build/webhooks/subscribe/https](https://shopify.dev/docs/apps/build/webhooks/subscribe/https)

## Platform Resource Map
- Customers: GraphQL `Query.customers`; REST `/customers.json`; webhooks
`customers/create`, `customers/update`, `customers/delete`; mandatory privacy
topics may include `customers/data_request`, `customers/redact`, and
`shop/redact`; scope `read_customers` plus protected-data approval as needed.
- Orders: GraphQL `Query.orders`; REST `/orders.json`; webhooks include
`orders/create`, `orders/updated`, `orders/cancelled`, `orders/fulfilled`,
`orders/paid`, `orders/edited`, and `orders/delete`; scopes `read_orders` and
gated `read_all_orders` for older history.

## Current Connector Implementation
- Webhook path: `/webhooks/shopify`.

## Safety Rules
- Do not print or commit `.env`, Shopify tokens, client secrets, webhook secrets,
or HMAC inputs.
- Do not add new resource coverage without checking scopes, protected-data
requirements, webhook topics, and deterministic replay coverage.

# Shopify Agent Notes

Use this file before editing the Shopify producer. It combines provider-wide
facts for future upgrades with the current connector implementation map.

Research retrieval date for provider facts: 2026-07-23.

## Source Of Truth

- API index: https://shopify.dev/docs/api
- GraphQL Admin API: https://shopify.dev/docs/api/admin-graphql
- REST Admin API, legacy as of 2024-10-01: https://shopify.dev/docs/api/admin-rest
- Changelog: https://shopify.dev/changelog
- API versioning: https://shopify.dev/docs/api/usage/versioning
- Auth overview: https://shopify.dev/docs/apps/build/authentication-authorization
- Admin access scopes: https://shopify.dev/docs/api/usage/access-scopes
- Dev Dashboard client credentials: https://shopify.dev/docs/apps/build/dev-dashboard/get-api-access-tokens
- REST pagination: https://shopify.dev/docs/api/usage/pagination-rest
- Webhook overview: https://shopify.dev/docs/apps/build/webhooks
- Webhook HTTPS delivery and HMAC: https://shopify.dev/docs/apps/build/webhooks/subscribe/https
- Webhook topic catalog: https://shopify.dev/docs/api/webhooks
- Development stores: https://shopify.dev/docs/apps/build/dev-dashboard/stores

## API Versioning

- Prefer GraphQL Admin API for new work. REST Admin API is legacy.
- Current stable version from this research is `2026-07`; release candidate is
  `2026-10`.
- Version selection is in the URL path, for example
  `/admin/api/2026-07/graphql.json`.
- Shopify releases a new stable version quarterly. Stable versions are supported
  for at least 12 months with at least 9 months of overlap.
- Unsupported requested versions fall forward to the oldest supported stable
  version. Confirm served version with `X-Shopify-API-Version` on API responses
  and webhook deliveries.
- OAuth endpoints are unversioned. Webhook payloads are versioned by the
  subscription configuration.
… (24 more lines)

## https://shopify.dev/docs/api/admin-graphql/latest/objects/Order
ID: web:https://shopify.dev/docs/api/admin-graphql/latest/objects/Order
Webhooks GraphQL. Create orders for phone sales, wholesale customers, Process returns, exchanges, and partial refunds. fulfillment data within the GraphQL

## https://community.shopify.com/t/modernizing-legacy-shopify-custom-app-php-7-1-rest-api-to-fastapi-graphql-app-bridge-architecture-looking-for-best-practices-and-migration-guidance/672273
ID: web:https://community.shopify.com/t/modernizing-legacy-shopify-custom-app-php-7-1-rest-api-to-fastapi-graphql-app-bridge-architecture-looking-for-best-practices-and-migration-guidance/672273
Customer and order data is protected customer data, Perform bulk operations with the GraphQL Admin API
