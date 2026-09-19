# supabase-queue
Query: Supabase queues pgmq visibility timeout read archive message durable postgres queue
Retrieved: 2026-09-19T01:53:59.014049+00:00

## https://pigsty.io/ext/e/pgmq/
ID: doc:https://pigsty.io/ext/e/pgmq/
# pgmq
Like AWS SQS and RSMQ but on Postgres.

## Usage Link to this heading
pgmq implements durable message queues as PostgreSQL tables and SQL functions. It supports delayed delivery, visibility timeouts, FIFO groups, message headers, polling, topics, and archival.

### Read with a Visibility Timeout Link to this heading

Reading hides each message for vt seconds. On success, delete or archive it:

### Queue Administration Index Link to this heading
- pgmq.read: claim visible messages for a visibility timeout.

## https://github.com/supabase/supabase/blob/24e8333c54374b94645d77c2170c089c249a7173/apps/www/content/md/modules/queues.md
ID: doc:https://github.com/supabase/supabase/blob/24e8333c54374b94645d77c2170c089c249a7173/apps/www/content/md/modules/queues.md
# Supabase Queues
Durable message queues with guaranteed delivery, powered by Postgres and pgmq.

Supabase Queues is a Postgres module that uses the pgmq extension to provide durable message queues with exactly-once delivery within a visibility window.

## Key Features
- **100% open source**: built on pgmq, a trusted community-driven extension

## Technical Details
- Extension: pgmq (open source)
- Delivery guarantee: exactly-once within visibility window

## https://supabase.com/docs/guides/queues/pgmq
ID: web:https://supabase.com/docs/guides/queues/pgmq
Read 1 or more messages from a queue. The VT specifies the duration of time in seconds that the message is invisible to other consumers. At the end of that
