#!/bin/bash
set -euo pipefail
D=$(mktemp -d); export LANG=C LC_ALL=C
cleanup(){ pg_ctl -D "$D/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$D"; }
trap cleanup EXIT
initdb -D "$D/data" -U fx --auth=trust --no-locale --encoding=UTF8 >/dev/null
mkdir "$D/s"
pg_ctl -D "$D/data" -l "$D/log" -o "-c listen_addresses='' -c unix_socket_directories='$D/s' -p 57643" -w start >/dev/null
P=(psql -X -q -h "$D/s" -p 57643 -U fx -d postgres -v ON_ERROR_STOP=1)
S=$(cd "$(dirname "$0")" && pwd)
M=$(cd "$S/../../../../supabase/migrations" && pwd)
"${P[@]}" -f "$S/fixture.sql"
"${P[@]}" -f "$M/0030_notification_email.sql"
"${P[@]}" -f "$M/20261127000000_pain_points_ia_semanal.sql"
"${P[@]}" -f "$M/20261127000100_weekly_email_delivery.sql"
# Empty up/down/up, then used-state refusal and normal receipt preservation.
"${P[@]}" -f "$M/../operations/20261127000100_weekly_email_delivery.rollback.sql"
"${P[@]}" -f "$M/20261127000100_weekly_email_delivery.sql"
"${P[@]}" -f "$S/test.sql"
before=$("${P[@]}" -Atc "select md5(string_agg(row_to_json(m)::text,',' order by idempotency_key)) from notification_email_messages m")
if "${P[@]}" -f "$M/../operations/20261127000100_weekly_email_delivery.rollback.sql" >"$D/rejected.log" 2>&1; then
 echo 'rollback accepted used weekly messages' >&2; exit 1
fi
grep -q WEEKLY_ROLLBACK_ALREADY_USED "$D/rejected.log"
after=$("${P[@]}" -Atc "select md5(string_agg(row_to_json(m)::text,',' order by idempotency_key)) from notification_email_messages m")
test "$before" = "$after"
echo 'rollback after use rejected; message references preserved'
# Reset only synthetic weekly fixture to exercise allowed rollback with normal receipts present.
"${P[@]}" -c "delete from notification_email_messages where weekly_report_id is not null"
normal_before=$("${P[@]}" -Atc "select md5((select json_agg(m order by idempotency_key)::text from notification_email_messages m)||(select json_agg(r order by event_id)::text from notification_email_receipts r))")
"${P[@]}" -f "$M/../operations/20261127000100_weekly_email_delivery.rollback.sql"
"${P[@]}" -f "$M/20261127000100_weekly_email_delivery.sql"
# Compare after reapplying, which restores exactly the original row shape.
normal_after=$("${P[@]}" -Atc "select md5((select json_agg(m order by idempotency_key)::text from notification_email_messages m)||(select json_agg(r order by event_id)::text from notification_email_receipts r))")
test "$normal_before" = "$normal_after"
echo 'normal messages and receipts identical after down/up'  
echo ALL-OK
