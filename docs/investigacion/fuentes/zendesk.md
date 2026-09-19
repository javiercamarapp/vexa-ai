# zendesk
Query: Zendesk incremental export tickets cursor ticket comments rate limits OAuth scopes
Retrieved: 2026-09-19T01:53:55.198528+00:00

## https://github.com/airbytehq/airbyte/blob/6b952b3172970315a0f8ca552171ae137c7550d5/docs/integrations/sources/zendesk-support.md
ID: doc:https://github.com/airbytehq/airbyte/blob/6b952b3172970315a0f8ca552171ae137c7550d5/docs/integrations/sources/zendesk-support.md
# Zendesk Support
## Setup guide
### Set up the Zendesk Support connector in Airbyte
#### For Airbyte Open Source:
9. (Optional) For **Page Size (ticket_comments)**, enter the number of records per page for the `ticket_comments` stream. The default is 100 and the maximum is 1000. Lower values may help prevent timeouts on large Zendesk instances.

## Supported Streams
- Tickets (Incremental)
- Ticket Audits (Client-Side Incremental)
- Ticket Comments (Incremental)
- Ticket Events (Incremental)

## Limitations & Troubleshooting
### Connector limitations
#### Rate limiting
The connector's **Number of concurrent threads** setting (default: 4) controls how many streams sync in parallel. If your plan supports higher rate limits, increase this value for faster syncs. The minimum is 2 and the maximum is 40. A single thread leaves no other stream emitting while the `tickets` stream reads, so a saved value of 1 is treated as 2 from the first sync after upgrading to 5.6.0, and the stored configuration is updated to match. If the source settings form flags the field before that first sync, set it to 2 or more.

Zendesk's incremental export endpoints have a stricter rate limit of 10 requests per minute, regardless of plan tier. This applies to the `tickets`, `ticket_comments`, `ticket_events`, `ticket_metric_events`, `users`, and `organizations` streams that use incremental exports. The `deleted_tickets` stream has a rate limit of 10 requests per minute. The connector includes a built-in API budget that automatically throttles requests to stay within these limits.

If the connector receives a 429 (Too Many Requests) response, it respects the `Retry-After` header and waits before retrying. The `ticket_comments` stream also retries on 504 (Gateway Timeout) errors with exponential backoff, which can occur on large Zendesk instances.

#### Side conversations access
- `404`, when the ticket no longer exists. The `tickets` stream returns deleted tickets, so this is expected.

## Changelog
| 5.0.0 | 2026-01-22 | 70990 | Add OAuth2.0 with refresh token support. | | | | | | |

| | | | |

| | | 0.1.5 | 2021-10-26 | 7679 | Add ticket_id and ticket_comments | | 0.1.2 | 2021-10-16 | 6513 | Fixed TicketComments stream | | 0.1.1 | 2021-09-02 | 5787 | Fixed incremental logic for the ticket_comments stream |

## Supported sync modes

The Zendesk Support source connector supports the following sync modes:

- Full Refresh | Overwrite
- Full Refresh | Append
- Incremental Sync | Append
- Incremental Sync | Deduped History

:::note
There are two types of incremental sync:

1. Incremental (standard server-side, where the API returns only data updated or created since the last sync).
2. Client-Side Incremental (the API returns all available data, and the connector filters out only new records).
:::

## Supported Streams

The Zendesk Support source connector supports the following streams:

- Account Attributes \(Enterprise only\)
- Articles \(Incremental\)
- Article Votes \(Incremental\)
- Article Comments \(Incremental\)
- Article Comment Votes \(Incremental\)
- Article Attachments \(Incremental\) \(Supports file transfer\)
- Attribute Definitions \(Enterprise only\)
- Audit Logs \(Incremental\) \(Enterprise only\)
- Automations
- Brands
- Custom Roles \(Client-Side Incremental\)
- Groups \(Client-Side Incremental\)
- Group Memberships \(Client-Side Incremental\)
- Macros \(Incremental\)
- Organizations \(Incremental\)
- Organization Fields \(Client-Side Incremental\)
- Organization Memberships \(Client-Side Incremental\)
- Posts \(Incremental\)
- Post Comments \(Incremental\)
… (26 more lines)

## https://developer.zendesk.com/api-reference/ticketing/ticket-management/incremental_exports/
ID: doc:https://developer.zendesk.com/api-reference/ticketing/ticket-management/incremental_exports/
# Incremental Exports
### incremental ticket export cursor based permalink Incremental Ticket Export, Cursor Based
#### code samples permalink Code Samples

#### example responses permalink Example response(s)

### incremental user export cursor based permalink Incremental User Export, Cursor Based
#### limits permalink Limits
This endpoint has its own rate limit that is different from the account wide rate limit. When calls are made to this endpoint, this limit will be consumed and you will get a `429 Too Many Requests` response code if the allocation is exhausted.

##### headers permalink Headers

##### details permalink Details
Please refer to the general account limits for more information.

#### exclude_deleted permalink exclude\_deleted

If true, excludes deleted tickets from the response. By default, deletions will appear in the ticket stream. If used in combination with the Incremental Ticket Export, you can separate your deleted ticket activity from your live data.

Example:

```
https://{subdomain}.zendesk.com/api/v2/incremental/tickets/cursor?exclude_deleted=true&cursor=MTU3NjYxMzUzOS4wfHw0Njd8
```

### incremental ticket metric event export permalink Incremental Ticket Metric Event Export

See List Ticket Metric Events.

### incremental custom object record export permalink Incremental Custom Object Record Export

See Incremental Custom Object Record Export, Cursor Based in the Custom Object API docs.

### incremental article export permalink Incremental Article Export

See List Articles in the Help Center API docs.

### incremental ticket export cursor based permalink Incremental Ticket Export, Cursor Based

- `GET /api/v2/incremental/tickets/cursor`

Returns the tickets that changed since the start time. For more information,
see Exporting tickets in Using the Incremental Exports API.

This endpoint supports cursor-based incremental exports.
Cursor-based exports are highly encouraged because they provide more consistent performance and
response body sizes. For more information, see Cursor-based incremental exports in Using the Incremental Exports API.

## https://developer.zendesk.com/documentation/ticketing/data-and-reporting/exporting-a-ticket-to-a-csv-file-with-python/
ID: doc:https://developer.zendesk.com/documentation/ticketing/data-and-reporting/exporting-a-ticket-to-a-csv-file-with-python/
# Tutorial: Exporting updated tickets to a CSV file
## what you need permalink What you need
- Environment variables set for `ZENDESK_ACCESS_TOKEN` and `ZENDESK_SUBDOMAIN` for authentication

## exporting zendesk tickets permalink Exporting Zendesk tickets
- The number of retries is limited to avoid indefinite waiting. If exceeded, the script stops and reports the failure.

### how it works permalink How it works
- Uses the `fetch_incremental_tickets` function to retrieve tickets updated since the start time. This function:
  - Implements rate limit handling by detecting HTTP 429 responses.
