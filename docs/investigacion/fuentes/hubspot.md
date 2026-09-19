# hubspot
Query: HubSpot conversations API threads messages tickets associations read scopes pagination
Retrieved: 2026-09-19T01:53:55.197221+00:00

## https://developers.hubspot.com/custom-channels-api
ID: doc:https://developers.hubspot.com/custom-channels-api
## Documentation Index
`conversations.read`

`conversations.write`

## ​  Threads & messages
### ​  Retrieve threads
Threads are a group of related messages that make up a conversation in the inbox.

| Parameter | Type | Description |
|-|-|-|
| `after` | String | The paging cursor token of the last successfully read resource will be returned as the `paging.next.after` JSON property of a paged response containing more results. Use this parameter when sorting by ID. |
| `associatedTicketId` | String | Filter threads to only include threads that are associated with the provided ticket ID. |
| `association` | String | If you provide `association=TICKET` as a query parameter, any threads in the response will include a `threadAssociations` object if they have a ticket association. The `threadsAssociations` property includes a single nested `associatedTicketId` field, which provides the ID of the associated ticket. |

### ​  Retrieve a subset of messages associated with a specific contact or ticket
For example, to retrieve open threads associated with a contact whose ID is `53701`, you’d make a `GET` request to the following URL:`https://api.hubspot.com/conversations/v3/conversations/threads?associatedContactId=53701&threadStatus=OPEN`To filter for messages associated with a specific ticket, provide ticket ID as the `associatedTicketId` query parameter in the URL of your request.For example, to retrieve messages associated with a ticket ID of `12345`, you’d make the following `GET` request:`https://api.hubspot.com/conversations/v3/conversations/threads?associatedTicketId=53701`

## ​  Filter and sort results

When retrieving inboxes, channels, channel accounts, threads, and messages using the endpoints outlined in this article, you can use different query parameters to filter and sort your responses.

| Parameter | Type | Description |
| --- | --- | --- |
| `sort` | String | Set the sort order of the response. You can sort by multiple properties. |
| `after` | String | The paging cursor token of the last successfully read resource will be returned as the `paging.next.after` JSON property of a paged response containing more results. |
| `limit` | Integer | The maximum number of results to display per page. |

You can also sort your results by any field on the channel, channel accounts, or inbox objects. For example, you could sort inboxes by name, or channel accounts by both channel ID and name.

## ​  Inboxes

To retrieve a list of inboxes set up in your account, make a `GET` request to `/conversations/v3/conversations/inboxes`.When you make a successful request, the response will include the inbox IDs of the different inboxes set up in your account. Each entry in the response will also include a `type` property, which can be either `INBOX` or `HELP_DESK`, depending on whether you connected the inbox to a conversations inbox or the help desk workspace.An example response is shown below:

```
{
  "total": 3,
  "results": [\
    {\
      "id": "481939",\
      "name": "Main website chatflow inbox",\
      "createdAt": "2019-07-06T21:18:14.342Z",\
      "updatedAt": "2022-08-19T20:03:44.993Z",\
      "type": "INBOX",\
      "archived": false\
    },\
    {\
      "id": "273071781",\
      "name": "T1 support helpdesk",\
      "createdAt": "2023-05-31T21:53:12.704Z",\
      "updatedAt": "2023-05-31T21:53:12.704Z",\
      "type": "HELP_DESK",\
      "archived": false\
    }\
  ]
}
```
… (2 more lines)

## https://developers.hubspot.com/docs/api-reference/latest/conversations/conversations/guide
ID: doc:https://developers.hubspot.com/docs/api-reference/latest/conversations/conversations/guide
# Conversations API
Use the conversations API to manage inboxes, channels, threads, and messages.

## Threads & messages
### Retrieve threads
| Parameter | Type | Description |
|-|-|-|
| `after` | String | The paging cursor token of the last successfully read resource will be returned as the `paging.next.after` JSON property of a paged response containing more results. Use this parameter when sorting by ID. |
| `associatedContactId` | String | Filter threads by a specific contact ID. |
| `associatedTicketId` | String | Filter threads to only include threads that are associated with the provided ticket ID. |
| `association` | String | If you provide `association=TICKET` as a query parameter, any threads in the response will include a `threadAssociations` object if they have a ticket association. The `threadsAssociations` property includes a single nested `associatedTicketId` field, which provides the ID of the associated ticket. |

| Parameter | Type | Description |
|-|-|-|
| `association` | String | If you provide `association=TICKET` as a query parameter and the thread has an associated ticket, the response will include a `threadAssociations` object, which in turn includes a single nested `associatedTicketId` property, which provides the ID of the associated ticket. |

### Retrieve a subset of messages associated with a specific contact or ticket
You can also fetch messages associated with a single contact or ticket, which can be helpful if you're creating a view where a customer can review the conversations they've had with your business, or you want to find all conversations associated with a specific ticket.

For example, to retrieve open threads associated with a contact whose ID is `53701`, you'd make a `GET` request to the following URL:

`https://api.hubspot.com/conversations/2026-09/conversations/threads?associatedContactId=53701&threadStatus=OPEN`

To filter for messages associated with a specific ticket, provide ticket ID as the `associatedTicketId` query parameter in the URL of your request.

For example, to retrieve messages associated with a ticket ID of `12345`, you'd make the following `GET` request:

`https://api.hubspot.com/conversations/2026-09/conversations/threads?associatedTicketId=12345`

## Threads & messages

### Retrieve threads

Threads are a group of related messages that make up a conversation in the inbox. To retrieve a list of all threads in your conversations inbox, make a `GET` request to `/conversations/2026-09/conversations/threads`. To filter and search your results, you can use the following query parameters in your request:

| Parameter                     | Type    | Description                                                                                                                                                                                                                                                                                                 |
| ----------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `after`                       | String  | The paging cursor token of the last successfully read resource will be returned as the `paging.next.after` JSON property of a paged response containing more results. Use this parameter when sorting by ID.                                                                                                |
| `archived`                    | Boolean | To retrieve archived threads, use the value `true`.                                                                                                                                                                                                                                                         |
| `associatedContactId`         | String  | Filter threads by a specific contact ID.                                                                                                                                                                                     |
| `associatedTicketId`          | String  | Filter threads to only include threads that are associated with the provided ticket ID.                                                                                                                                      |
| `association`                 | String  | If you provide `association=TICKET` as a query parameter, any threads in the response will include a `threadAssociations` object if they have a ticket association. The `threadsAssociations` property includes a single nested `associatedTicketId` field, which provides the ID of the associated ticket. |
| `inboxId`                     | String  | Filter threads by a specific inbox ID. Note that you can only filter a single inbox ID (multiple instances of this query parameter are *not* supported).                                                                                                                                                    |
| `latestMessageTimestampAfter` | String  | The minimum `latestMessageTimestamp`. This is required only when sorting by `latestMessageTimestamp`.                                                                                                                                                                                                       |
| `limit`                       | String  | The total number of results to display per page. The maximum limit is 500.                                                                                                                                                                                                                                  |
| `sort`                        | String  | Set the sort order of the response. Valid options include `id` , which is the default, and `latestMessageTimestamp` , which requires the `latestMessageTimestampAfter` field to also be set. Results are always returned in ascending order.                                                                |

When you make a successful request, the response will include the thread ID, which you can use to retrieve, update, or create a new message in a thread.

For example, if you make a `GET` request to `/conversations/2026-09/conversations/threads?association=TICKET`, the response would resemble the following:
… (50 more lines)

## https://api.hubspot.com/public/api/spec/v2/specs/release/75320/version/2026-09.json
ID: doc:https://api.hubspot.com/public/api/spec/v2/specs/release/75320/version/2026-09.json
# Threads
## GET /conversations/conversations/2026-09/threads
List threads

Retrieve a list of conversation threads from the specified inboxes. This endpoint allows filtering by associated contact or ticket, thread status, and other parameters. It supports pagination and sorting to help manage large sets of data effectively.

Parameters:

- `after` (query, string) — The paging cursor token of the last successfully read resource will be returned as the `paging.next.after` JSON property of a paged response containing more results.
- `associatedTicketId` (query, integer) — The unique identifier of the associated ticket to filter threads.
- `association` (query, array<string>) — A list of associations to filter the threads by. Valid values include 'TICKET'.

## GET /conversations/conversations/2026-09/threads/{threadId}
- `association` (query, array<string>) — A list of associations to include in the response. Valid values include 'TICKET'.

## PATCH /conversations/conversations/2026-09/threads/{threadId}
Parameters:

Responses: 200, default
